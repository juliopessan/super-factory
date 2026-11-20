import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

import { executarOnda, MAXIMO_DE_CARDS_POR_ONDA, ordemDeMerge, PADRAO_DE_CHAVE, validarOnda } from '../../factory/dependencias.ts'
import { paralelismoConfigurado, PARALELISMO_MAXIMO } from '../../factory/paralelo.ts'
import { pedidoSchema } from '../../factory/schemas.ts'

const chaveSchema = z.string().regex(PADRAO_DE_CHAVE, 'De 1 a 24 letras minúsculas, números e hífen.')

/** Um card da onda: o pedido de sempre, mais uma chave e, se for filho, a chave do pai. */
export const pedidoDaOndaSchema = pedidoSchema.extend({
  chave: chaveSchema.optional().describe('Nome curto deste card dentro da onda. Obrigatório só para quem tem filho.'),
  dependeDe: chaveSchema.optional().describe('Chave do card pai (um só). Este card nasce da branch do pai e abre o pull request contra ela (PR em pilha). O pai roda primeiro.'),
})

export const resultadoDoCartaoSchema = z.object({
  titulo: z.string(),
  ok: z.boolean(),
  desfecho: z.string(),
  pullRequestUrl: z.string().nullable(),
  motivo: z.string().nullable(),
  chave: z.string().nullable().default(null),
  /** Branch criada para este card. */
  branch: z.string().nullable().default(null),
  /** Branch de destino do pull request: a do pai, quando o card está empilhado. */
  base: z.string().nullable().default(null),
  pai: z.string().nullable().default(null),
})
export type ResultadoDoCartao = z.infer<typeof resultadoDoCartaoSchema>

const saidaSchema = z.object({
  cartoes: z.array(resultadoDoCartaoSchema),
  resumo: z.string(),
  ordemDeMerge: z.array(z.string()).describe('Títulos na ordem em que uma pessoa deve fazer o merge: do pai para o filho.'),
})

const entradaSchema = z.object({
  pedidos: z.array(pedidoDaOndaSchema).min(1).max(MAXIMO_DE_CARDS_POR_ONDA).describe(
    `De 1 a ${MAXIMO_DE_CARDS_POR_ONDA} cards, até ${PARALELISMO_MAXIMO} ao mesmo tempo. Cada um tem sandbox, branch e pull request próprios. Com "dependeDe", o filho espera o pai e empilha o PR sobre a branch dele.`,
  ),
  ensaio: z.boolean().optional().describe('Ensaio: cada card percorre as fases com sandbox de mentira, sem tocar repositório nem rede.'),
})

type CartaoDaOnda = z.infer<typeof pedidoDaOndaSchema> & { ensaio: boolean }

const receber = createStep({
  id: 'receber-onda',
  description: 'Confere as chaves e as dependências (um pai por card, sem ciclo) antes de rodar qualquer coisa.',
  inputSchema: entradaSchema,
  outputSchema: z.array(pedidoDaOndaSchema.extend({ ensaio: z.boolean() })),
  execute: async ({ inputData }) => {
    validarOnda(inputData.pedidos.map((p) => ({ chave: p.chave ?? null, dependeDe: p.dependeDe ?? null })))
    return inputData.pedidos.map((pedido) => ({ ...pedido, ensaio: inputData.ensaio ?? false }))
  },
})

const rodar = createStep({
  id: 'rodar-onda',
  description:
    'Roda os cards pelo modo autônomo, até o teto de simultâneos. O filho espera o pai, nasce da branch dele e abre o PR contra ela; se o pai para, o filho fica bloqueado. Um card que para não derruba os independentes.',
  inputSchema: z.array(pedidoDaOndaSchema.extend({ ensaio: z.boolean() })),
  outputSchema: saidaSchema,
  execute: async ({ inputData, mastra, loggerVNext }) => {
    const cartoes = inputData as CartaoDaOnda[]
    const nos = cartoes.map((c) => ({ chave: c.chave ?? null, dependeDe: c.dependeDe ?? null, cartao: c }))
    const fluxo = mastra.getWorkflow('autonomo')

    const resultados = await executarOnda<(typeof nos)[number], ResultadoDoCartao>(
      nos,
      paralelismoConfigurado(),
      async (no, pai) => {
        const { chave: _chave, dependeDe: _dependeDe, ...pedido } = no.cartao
        const inicio = Date.now()
        // O filho parte da branch que o pai acabou de enviar: é isso que faz o PR ficar empilhado.
        const base = pai?.branch ?? null
        const entrada = base ? { ...pedido, branchBase: base, empilhadoSobre: base } : pedido
        loggerVNext?.info('Card da onda iniciado', { titulo: pedido.titulo, ensaio: pedido.ensaio, pai: no.dependeDe, base })
        const execucao = await fluxo.createRun()
        const resultado = await execucao.start({ inputData: entrada })
        const duracaoMs = Date.now() - inicio
        if (resultado.status === 'success') {
          const estado = resultado.result as { desfecho?: string; card?: { branchHead?: string | null; branchBase?: string | null }; entrega?: { pullRequestUrl?: string | null } | null }
          loggerVNext?.info('Card da onda concluído', { titulo: pedido.titulo, duracaoMs })
          return {
            titulo: pedido.titulo,
            ok: true,
            desfecho: estado.desfecho ?? 'em-andamento',
            pullRequestUrl: estado.entrega?.pullRequestUrl ?? null,
            motivo: null,
            chave: no.chave,
            branch: estado.card?.branchHead ?? null,
            base: estado.card?.branchBase ?? base,
            pai: no.dependeDe,
          }
        }
        const motivo = resultado.status === 'failed' ? (resultado.error?.message ?? 'Falhou.') : `Terminou como ${resultado.status}.`
        loggerVNext?.warn('Card da onda parou', { titulo: pedido.titulo, duracaoMs, motivo: motivo.slice(0, 300) })
        return { titulo: pedido.titulo, ok: false, desfecho: 'parado', pullRequestUrl: null, motivo, chave: no.chave, branch: null, base, pai: no.dependeDe }
      },
      (no, pai) => {
        loggerVNext?.warn('Card da onda bloqueado', { titulo: no.cartao.titulo, pai: no.dependeDe })
        return {
          titulo: no.cartao.titulo,
          ok: false,
          desfecho: 'bloqueado',
          pullRequestUrl: null,
          motivo: `Bloqueado: o card pai "${pai.chave ?? pai.titulo}" não chegou ao pull request, e este nasce da branch dele. Resolva o pai e rode de novo.`,
          chave: no.chave,
          branch: null,
          base: null,
          pai: no.dependeDe,
        }
      },
    )

    const certos = resultados.filter((r) => r.ok).length
    const ordem = ordemDeMerge(resultados.map((r) => ({ chave: r.chave, dependeDe: r.pai, titulo: r.titulo, ok: r.ok }))).filter((r) => r.ok).map((r) => r.titulo)
    const empilhados = resultados.some((r) => r.pai !== null)
    const resumo = `${certos} de ${resultados.length} cards chegaram ao pull request.${empilhados && certos > 1 ? ` Há PRs em pilha: faça o merge de baixo para cima (${ordem.join(' → ')}).` : ''} Merge e deploy ficam com uma pessoa.`
    return { cartoes: resultados, resumo, ordemDeMerge: ordem }
  },
})

export const ondaWorkflow = createWorkflow({
  id: 'onda',
  description: `Modo autônomo em paralelo: até ${MAXIMO_DE_CARDS_POR_ONDA} cards por onda, ${PARALELISMO_MAXIMO} ao mesmo tempo no máximo (SUPER_FACTORY_PARALELISMO, padrão 3). Com "dependeDe", o card filho nasce da branch do pai e abre um PR em pilha. A Factory nunca faz merge nem deploy.`,
  inputSchema: entradaSchema,
  outputSchema: saidaSchema,
})
  .then(receber)
  .then(rodar)
  .commit()
