import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

import {
  FASES_AUTONOMO,
  contextoInicial,
  marcarEnsaio,
  type ContextoAutonomo,
  type DepsAutonomo,
  type FaseAutonomo,
  type SessaoAutonomo,
} from '../../factory/autonomo.ts'
import { parar } from '../../factory/pipeline.ts'
import { criarExecutorDocker } from '../../factory/sandbox.ts'
import { estadoSchema, pedidoSchema } from '../../factory/schemas.ts'
import { persistir } from '../../factory/store.ts'
import { implementadorComAgente } from '../agents/construtor.ts'
import { depsDeEnsaio } from './ensaio.ts'

/** Dependências de verdade: Docker local, agente construtor e credenciais do ambiente. */
export function depsDoAmbiente(): DepsAutonomo {
  return {
    criarExecutor: (cardId) => criarExecutorDocker({ cardId }),
    implementador: implementadorComAgente,
    credenciais: {
      githubToken: process.env.GITHUB_TOKEN,
      azureOrg: process.env.AZURE_DEVOPS_ORG,
      azurePat: process.env.AZURE_DEVOPS_PAT,
    },
  }
}

// O container vive entre os passos, mas não cabe no snapshot do workflow:
// fica aqui, pelo runId do card, e é encerrado na parada, no erro ou no fim.
const sessoes = new Map<string, SessaoAutonomo>()

async function encerrarSessao(runId: string): Promise<void> {
  const sessao = sessoes.get(runId)
  sessoes.delete(runId)
  await sessao?.executor?.encerrar().catch(() => {})
}

const contextoSchema = z.object({
  ensaio: z.boolean(),
  estado: estadoSchema,
  branch: z.string().nullable(),
  verificacao: z.object({ instalar: z.string().nullable(), verificar: z.string().nullable(), origem: z.string() }).nullable(),
  estatistica: z.string().nullable(),
})

function passo(fase: FaseAutonomo, ultima: boolean) {
  return createStep({
    id: fase.id,
    description: fase.descricao,
    inputSchema: contextoSchema,
    outputSchema: contextoSchema,
    execute: async ({ inputData }) => {
      const { ensaio, ...contexto } = inputData as ContextoAutonomo & { ensaio: boolean }
      const runId = contexto.estado.runId
      const sessao = sessoes.get(runId) ?? { executor: null }
      sessoes.set(runId, sessao)
      let saida: ContextoAutonomo
      try {
        saida = await fase.executar(contexto, ensaio ? depsDeEnsaio() : depsDoAmbiente(), sessao)
      } catch (erro) {
        saida = { ...contexto, estado: parar(contexto.estado, erro instanceof Error ? erro.message : `A fase ${fase.titulo} falhou.`) }
      }
      if (ensaio && ultima && !saida.estado.parado) saida = { ...saida, estado: marcarEnsaio(saida.estado) }
      if (saida.estado.parado || ultima) await encerrarSessao(runId)
      persistir(saida.estado)
      // Parou: o nó fica vermelho no canvas com o motivo, e as fases seguintes não começam.
      if (saida.estado.parado) throw new Error(`Parou em ${fase.titulo}: ${saida.estado.motivo ?? 'sem motivo registrado.'}`)
      return { ...saida, ensaio }
    },
  })
}

const entradaSchema = pedidoSchema.extend({
  ensaio: z
    .boolean()
    .optional()
    .describe('Ensaio: percorre as mesmas fases com um sandbox de mentira, sem tocar repositório nem rede e sem precisar de chave. Nada é feito de verdade: o card ganha o prefixo [ENSAIO] e nenhum pull request existe. Deixe desmarcado para executar a tarefa.'),
})

const preparar = createStep({
  id: 'receber-pedido',
  description: 'Recebe o pedido e confere se a chave do agente construtor está configurada (painel Chaves e acessos ou .env).',
  inputSchema: entradaSchema,
  outputSchema: contextoSchema,
  execute: async ({ inputData }) => {
    const { ensaio = false, ...pedido } = inputData
    // O card do ensaio entra no quadro de verdade; o prefixo evita confundir com trabalho real.
    const contexto = contextoInicial(ensaio ? { ...pedido, titulo: `[ENSAIO] ${pedido.titulo}`.slice(0, 120) } : pedido)
    const temModelo = ensaio || process.env.ANTHROPIC_API_KEY || process.env.SUPER_FACTORY_BUILDER_MODEL
    if (!temModelo) {
      const estado = persistir(parar(contexto.estado, 'O modo autônomo precisa de ANTHROPIC_API_KEY para o agente construtor escrever código. Cole a chave em Settings → Chaves e acessos, no Studio, ou marque ensaio para conhecer o fluxo.'))
      throw new Error(`Parou em Receber o pedido: ${estado.motivo}`)
    }
    return { ...contexto, ensaio }
  },
})

const concluir = createStep({
  id: 'entregar',
  description: 'Devolve o estado final do card: PR aberto e aguardando revisão humana, ou o motivo da parada.',
  inputSchema: contextoSchema,
  outputSchema: estadoSchema,
  execute: async ({ inputData }) => persistir(inputData.estado),
})

let fluxo = createWorkflow({
  id: 'autonomo',
  description:
    'Modo autônomo: do pedido ao pull request sem gate intermediário, em fases que acendem no canvas. Código e testes rodam num container Docker. A Factory nunca faz merge nem deploy.',
  inputSchema: entradaSchema,
  outputSchema: estadoSchema,
}).then(preparar)

FASES_AUTONOMO.forEach((fase, indice) => {
  fluxo = fluxo.then(passo(fase, indice === FASES_AUTONOMO.length - 1))
})

export const autonomoWorkflow = fluxo.then(concluir).commit()
