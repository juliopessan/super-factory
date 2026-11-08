import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

import { paralelismoConfigurado, PARALELISMO_MAXIMO } from '../../factory/paralelo.ts'
import { pedidoSchema } from '../../factory/schemas.ts'

const cartaoSchema = pedidoSchema.extend({ ensaio: z.boolean().optional() })

export const resultadoDoCartaoSchema = z.object({
  titulo: z.string(),
  ok: z.boolean(),
  desfecho: z.string(),
  pullRequestUrl: z.string().nullable(),
  motivo: z.string().nullable(),
})
export type ResultadoDoCartao = z.infer<typeof resultadoDoCartaoSchema>

const entradaSchema = z.object({
  pedidos: z.array(pedidoSchema).min(1).max(PARALELISMO_MAXIMO).describe(`De 1 a ${PARALELISMO_MAXIMO} cards independentes. Cada um tem o próprio sandbox, a própria branch e o próprio pull request.`),
  ensaio: z.boolean().optional().describe('Ensaio: cada card percorre as fases com sandbox de mentira, sem tocar repositório nem rede.'),
})

const receber = createStep({
  id: 'receber-onda',
  description: 'Separa os cards da onda. Cada um segue sozinho; um que para não derruba os outros.',
  inputSchema: entradaSchema,
  outputSchema: z.array(cartaoSchema),
  execute: async ({ inputData }) => inputData.pedidos.map((pedido) => ({ ...pedido, ensaio: inputData.ensaio ?? false })),
})

const cartao = createStep({
  id: 'rodar-cartao',
  description: 'Roda o workflow autonomo de um card: sandbox, código, testes e pull request. O resultado fica no relatório, parou ou não.',
  inputSchema: cartaoSchema,
  outputSchema: resultadoDoCartaoSchema,
  execute: async ({ inputData, mastra, loggerVNext }) => {
    const inicio = Date.now()
    loggerVNext?.info('Card da onda iniciado', { titulo: inputData.titulo, ensaio: inputData.ensaio ?? false })
    const fluxo = mastra.getWorkflow('autonomo')
    const execucao = await fluxo.createRun()
    const resultado = await execucao.start({ inputData })
    const duracaoMs = Date.now() - inicio
    if (resultado.status === 'success') {
      loggerVNext?.info('Card da onda concluído', { titulo: inputData.titulo, duracaoMs })
      const estado = resultado.result as { desfecho?: string; entrega?: { pullRequestUrl?: string | null } | null }
      return { titulo: inputData.titulo, ok: true, desfecho: estado.desfecho ?? 'em-andamento', pullRequestUrl: estado.entrega?.pullRequestUrl ?? null, motivo: null }
    }
    const motivo = resultado.status === 'failed' ? (resultado.error?.message ?? 'Falhou.') : `Terminou como ${resultado.status}.`
    loggerVNext?.warn('Card da onda parou', { titulo: inputData.titulo, duracaoMs, motivo: motivo.slice(0, 300) })
    return { titulo: inputData.titulo, ok: false, desfecho: 'parado', pullRequestUrl: null, motivo }
  },
})

const resumir = createStep({
  id: 'resumir-onda',
  description: 'Junta o resultado de cada card. Não faz merge nem aprova nada: os pull requests esperam uma pessoa.',
  inputSchema: z.array(resultadoDoCartaoSchema),
  outputSchema: z.object({ cartoes: z.array(resultadoDoCartaoSchema), resumo: z.string() }),
  execute: async ({ inputData }) => {
    const certos = inputData.filter((item) => item.ok).length
    return { cartoes: inputData, resumo: `${certos} de ${inputData.length} cards chegaram ao pull request. Merge e deploy ficam com uma pessoa.` }
  },
})

export const ondaWorkflow = createWorkflow({
  id: 'onda',
  description: `Modo autônomo em paralelo: até ${PARALELISMO_MAXIMO} cards independentes ao mesmo tempo (SUPER_FACTORY_PARALELISMO, padrão 3). A Factory nunca faz merge nem deploy.`,
  inputSchema: entradaSchema,
  outputSchema: z.object({ cartoes: z.array(resultadoDoCartaoSchema), resumo: z.string() }),
})
  .then(receber)
  .foreach(cartao, { concurrency: paralelismoConfigurado() })
  .then(resumir)
  .commit()
