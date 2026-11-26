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
import { lerConfigDeMelhoria } from '../../factory/melhoria.ts'
import { bloqueioDoDisjuntor, registrarDesfecho } from '../../factory/disjuntor.ts'
import { melhoradorComAgente } from '../agents/melhorador.ts'
import { gastoDoDia, lerTetos, registrarGasto } from '../../factory/custo.ts'
import { guardarCapturaDoApp, guardarMapaDoRepositorio } from '../../factory/artefatos.ts'
import { redigirSegredos } from '../../factory/guards.ts'
import { parar } from '../../factory/pipeline.ts'
import { criarExecutorDocker } from '../../factory/sandbox.ts'
import { estadoSchema, pedidoSchema } from '../../factory/schemas.ts'
import { persistir } from '../../factory/store.ts'
import { implementadorDeComando, lerConfigDoImplementador } from '../../factory/implementadores.ts'
import { implementadorComAgente } from '../agents/construtor.ts'
import { depsDeEnsaio } from './ensaio.ts'

/** Dependências de verdade: Docker local, agente construtor e credenciais do ambiente. */
export function depsDoAmbiente(): DepsAutonomo {
  // Config inválida lança aqui, com a mensagem do que corrigir no .env: o card não roda com o implementador errado.
  const config = lerConfigDoImplementador()
  return {
    criarExecutor: (cardId) => criarExecutorDocker({ cardId }),
    implementador: config.id === 'comando' ? implementadorDeComando(config) : implementadorComAgente,
    // No ambiente real a verificação é completa. SUPER_FACTORY_VERIFICACAO=minima volta ao teste único, para suítes muito longas.
    verificacaoCompleta: process.env.SUPER_FACTORY_VERIFICACAO?.trim().toLowerCase() !== 'minima',
    // Navegador no sandbox: só com a imagem construída com --com-browser (o script liga esta variável).
    navegador: ['1', 'sim', 'true'].includes(process.env.SUPER_FACTORY_NAVEGADOR?.trim().toLowerCase() ?? ''),
    // Teto de custo em tokens (card e dia); o da onda vale no workflow onda. 0 desliga. Padrões em factory/custo.ts.
    tetos: lerTetos(),
    // Melhoria recursiva (fraca): desligada por padrão; SUPER_FACTORY_MELHORIA=sim liga. Custa um Improver e uma tentativa a mais por card que tenha o que melhorar.
    melhoria: lerConfigDeMelhoria(),
    melhorador: melhoradorComAgente,
    gastoDoDia: () => gastoDoDia(),
    registrarGasto: (origem, tokens) => registrarGasto(origem, tokens),
    guardarMapa: (repositorio, mapa) => void guardarMapaDoRepositorio(repositorio, mapa),
    guardarCaptura: guardarCapturaDoApp,
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
  verificacao: z
    .object({
      instalar: z.string().nullable(),
      verificar: z.string().nullable(),
      origem: z.string(),
      pasta: z.string().optional(),
      extras: z.array(z.object({ nome: z.enum(['lint', 'typecheck', 'build']), comando: z.string() })).optional(),
    })
    .nullable(),
  convencoes: z.string().nullable().optional(),
  mapa: z.string().nullable().optional(),
  atencao: z.array(z.string()).optional(),
  estatistica: z.string().nullable(),
  pilha: z.string().nullable().optional(),
})

function passo(fase: FaseAutonomo, ultima: boolean) {
  return createStep({
    id: fase.id,
    description: fase.descricao,
    inputSchema: contextoSchema,
    outputSchema: contextoSchema,
    execute: async (args) => {
      const { inputData, loggerVNext } = args
      const { ensaio, ...contexto } = inputData as ContextoAutonomo & { ensaio: boolean }
      const inicio = Date.now()
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
      // Disjuntor: uma execução que parou depois da triagem é falha do repositório (ensaio não conta; teto e disjuntor também não).
      if (!ensaio && saida.estado.parado && fase.id !== 'triar') registrarDesfecho({ repositorio: saida.estado.card.repositorio, cardId: saida.estado.card.id, ok: false, motivo: saida.estado.motivo })
      // Logs do Studio: uma linha por fase, com o card, o tempo e, se parou, o motivo (sem segredo).
      const dados = { card: saida.estado.card.id, fase: fase.id, ensaio, duracaoMs: Date.now() - inicio }
      if (saida.estado.parado) loggerVNext?.warn(`Fase ${fase.titulo} parou`, { ...dados, motivo: redigirSegredos(saida.estado.motivo ?? '').slice(0, 300) })
      else loggerVNext?.info(`Fase ${fase.titulo} concluída`, dados)
      if (saida.estado.parado || ultima) await encerrarSessao(runId)
      persistir(saida.estado)
      // Parou: o nó fica vermelho no canvas com o motivo, e as fases seguintes não começam.
      if (saida.estado.parado) throw new Error(`Parou em ${fase.titulo}: ${saida.estado.motivo ?? 'sem motivo registrado.'}`)
      return { ...saida, ensaio }
    },
  })
}

const entradaSchema = pedidoSchema.extend({
  issue: z.number().int().min(1).max(9_999_999).optional().describe('Número da issue (no mesmo repositório) de onde veio o pedido. O PR passa a referenciá-la (Closes #N com os testes verdes, Refs #N no rascunho) e a Factory comenta nela quando o PR abre.'),
  cardId: z.string().regex(/^C-\d+$/).optional().describe('Uso interno: a execução parte deste card que já está no quadro (mesmo ID), em vez de abrir um card novo.'),
  empilhadoSobre: z.string().min(1).max(120).optional().describe('Uso interno da onda: branch do card pai. O PR deste card avisa que está empilhado sobre ela.'),
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
    const { ensaio = false, empilhadoSobre, issue, cardId, ...pedido } = inputData
    // O card do ensaio entra no quadro de verdade; o prefixo evita confundir com trabalho real.
    const contexto = contextoInicial(ensaio ? { ...pedido, titulo: `[ENSAIO] ${pedido.titulo}`.slice(0, 120) } : pedido, issue, ensaio ? undefined : cardId)
    // Disjuntor aberto neste repositório: nada novo começa até uma pessoa retomar (não gasta sandbox nem tokens).
    const bloqueio = ensaio ? null : bloqueioDoDisjuntor(contexto.estado.card.repositorio)
    if (bloqueio) {
      const estado = persistir(parar(contexto.estado, bloqueio))
      throw new Error(`Parou em Receber o pedido: ${estado.motivo}`)
    }
    const temModelo = ensaio || process.env.ANTHROPIC_API_KEY || process.env.SUPER_FACTORY_BUILDER_MODEL
    if (!temModelo) {
      const estado = persistir(parar(contexto.estado, 'O modo autônomo precisa de ANTHROPIC_API_KEY para o agente construtor escrever código. Cole a chave em Settings → Chaves e acessos, no Studio, ou marque ensaio para conhecer o fluxo.'))
      throw new Error(`Parou em Receber o pedido: ${estado.motivo}`)
    }
    return { ...contexto, ensaio, pilha: empilhadoSobre ?? null }
  },
})

const concluir = createStep({
  id: 'entregar',
  description: 'Devolve o estado final do card: PR aberto e aguardando revisão humana, ou o motivo da parada.',
  inputSchema: contextoSchema,
  outputSchema: estadoSchema,
  execute: async ({ inputData }) => {
    // Chegou ao fim sem parar: sucesso para o disjuntor (zera a sequência de falhas do repositório).
    if (!inputData.ensaio && !inputData.estado.parado) registrarDesfecho({ repositorio: inputData.estado.card.repositorio, cardId: inputData.estado.card.id, ok: true })
    return persistir(inputData.estado)
  },
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
