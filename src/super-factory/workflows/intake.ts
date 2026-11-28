// Intake: da demanda ao pull request. Cada fase acende no canvas (receber, especificar, validar, abrir cards, executar a onda, entregar).
// A partir do PR o trabalho é do aprovador: a Factory não aprova, não mescla e não faz deploy. Cada card tem a própria branch nova.

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

import { gastoDoDia, lerTetos, registrarGasto } from '../../factory/custo.ts'
import { anotarDemanda, faseAbrirCards, faseEntregar, faseEspecificar, faseExecutar, faseValidar, lerDemandaGravada, registrarDemanda, visaoDaDemanda, type DepsDoIntake } from '../../factory/intake.ts'
import { especificadorComAgente } from '../agents/especificador.ts'
import { depsDoPreflight } from '../preflight.ts'

const entradaSchema = z.object({
  demandaId: z.string().regex(/^DM-\d+$/).optional().describe('Uso interno: a demanda já registrada (o Chief registra antes de iniciar).'),
  demanda: z.string().min(20).max(6000).optional().describe('O que a pessoa quer: o problema, para quem e o que fica de fora. Obrigatório quando não há demandaId.'),
  repositorio: z.string().min(3).max(140).optional().describe('owner/repo. Obrigatório quando não há demandaId.'),
  branchBase: z.string().max(120).optional().describe('Branch de destino do PR. Vazio é main.'),
  issue: z.number().int().min(1).max(9_999_999).optional(),
  soPlano: z.boolean().optional().describe('Para depois do plano validado, sem abrir cards nem gastar sandbox.'),
  ensaio: z.boolean().optional().describe('Percorre o fluxo sem modelo, sem chave e sem tocar repositório.'),
  revisar: z.boolean().optional().describe('O agente revisor comenta em cada PR (padrão: sim). Só comenta.'),
})
const contextoSchema = z.object({ demandaId: z.string() })
const saidaSchema = z.object({ demandaId: z.string(), estagio: z.string(), situacao: z.string(), resumo: z.string(), prs: z.array(z.string()), aguardaPessoa: z.array(z.string()) })

function depsDoAmbiente(mastra: { getWorkflow: (id: string) => unknown } | undefined): DepsDoIntake {
  return {
    especificar: especificadorComAgente,
    executarOnda: async (entrada) => {
      const fluxo = mastra?.getWorkflow('onda') as { createRun: () => Promise<{ start: (a: { inputData: unknown }) => Promise<{ status: string; result?: unknown; error?: { message?: string } }> }> } | undefined
      if (!fluxo) throw new Error('O workflow onda não está registrado neste servidor.')
      const execucao = await fluxo.createRun()
      const r = await execucao.start({ inputData: entrada })
      if (r.status !== 'success') throw new Error(r.status === 'failed' ? (r.error?.message ?? 'A onda falhou.') : `A onda terminou como ${r.status}.`)
      return r.result as Awaited<ReturnType<DepsDoIntake['executarOnda']>>
    },
    preflight: depsDoPreflight(),
    custo: { tetos: lerTetos(), gastoDoDia: () => gastoDoDia() },
    registrarGasto: (origem, tokens) => registrarGasto(origem, tokens),
  }
}

/** Uma fase que lança erro marca a demanda como bloqueada e falha o passo (o nó fica vermelho com o motivo). */
async function protegida(demandaId: string, estagio: 'triage' | 'specification' | 'implementation' | 'verification', fase: () => Promise<unknown> | unknown, nome: string) {
  try {
    await fase()
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : `A fase ${nome} falhou.`
    anotarDemanda(demandaId, estagio, `A fase ${nome} falhou: ${motivo}`, { situacao: 'bloqueada', motivo })
    throw new Error(`Parou em ${nome}: ${motivo}`)
  }
  return { demandaId }
}

const receber = createStep({
  id: 'receber-demanda',
  description: 'Registra a demanda (ou retoma a que o Chief já registrou). Texto com segredo é recusado.',
  inputSchema: entradaSchema,
  outputSchema: contextoSchema,
  execute: async ({ inputData }) => {
    if (inputData.demandaId) {
      if (!lerDemandaGravada(inputData.demandaId)) throw new Error(`Não achei a demanda ${inputData.demandaId}.`)
      return { demandaId: inputData.demandaId }
    }
    if (!inputData.demanda || !inputData.repositorio) throw new Error('Informe a demanda e o repositório (owner/repo).')
    const r = registrarDemanda({ texto: inputData.demanda, repositorio: inputData.repositorio, branchBase: inputData.branchBase, issue: inputData.issue, soPlano: inputData.soPlano, ensaio: inputData.ensaio, revisar: inputData.revisar, origem: 'api' })
    if (!r.ok || !r.demanda) throw new Error(r.nota)
    return { demandaId: r.demanda.id }
  },
})

const especificar = createStep({
  id: 'especificar',
  description: 'O especificador lê a demanda e o repositório e devolve o plano (por padrão, um card: uma branch, um PR).',
  inputSchema: contextoSchema,
  outputSchema: contextoSchema,
  execute: async ({ inputData, mastra }) => protegida(inputData.demandaId, 'specification', () => faseEspecificar(inputData.demandaId, depsDoAmbiente(mastra)), 'Especificar'),
})

const validar = createStep({
  id: 'validar-plano',
  description: 'A triagem de qualquer card, em cada card do plano: critério observável, segredo, duplicata e dependências. Uma correção, no máximo.',
  inputSchema: contextoSchema,
  outputSchema: contextoSchema,
  execute: async ({ inputData, mastra }) => protegida(inputData.demandaId, 'specification', () => faseValidar(inputData.demandaId, depsDoAmbiente(mastra)), 'Validar o plano'),
})

const abrirCards = createStep({
  id: 'abrir-cards',
  description: 'Abre os cards do plano no quadro, em ready.',
  inputSchema: contextoSchema,
  outputSchema: contextoSchema,
  execute: async ({ inputData }) => protegida(inputData.demandaId, 'implementation', () => faseAbrirCards(inputData.demandaId), 'Abrir os cards'),
})

const executar = createStep({
  id: 'executar-onda',
  description: 'Disjuntor, teto e sandbox conferidos; depois a onda: cada card com a própria branch nova, testes no container e pull request.',
  inputSchema: contextoSchema,
  outputSchema: contextoSchema,
  execute: async ({ inputData, mastra }) => protegida(inputData.demandaId, 'implementation', () => faseExecutar(inputData.demandaId, depsDoAmbiente(mastra)), 'Executar a onda'),
})

const entregar = createStep({
  id: 'entregar',
  description: 'Entrega os PRs ao aprovador. Dali em diante, revisar e fazer o merge é de uma pessoa.',
  inputSchema: contextoSchema,
  outputSchema: saidaSchema,
  execute: async ({ inputData }) => {
    faseEntregar(inputData.demandaId)
    const v = visaoDaDemanda(inputData.demandaId)!
    return { demandaId: v.demanda.id, estagio: v.estagio, situacao: v.situacao, resumo: v.resumo, prs: v.demanda.entrega?.prs.map((p) => p.url) ?? [], aguardaPessoa: v.aguardaPessoa }
  },
})

export const intakeWorkflow = createWorkflow({
  id: 'intake',
  description: 'Da demanda ao pull request: especifica, valida, abre os cards, roda o modo autônomo (uma branch nova por card) e entrega os PRs ao aprovador. Não aprova, não mescla e não faz deploy.',
  inputSchema: entradaSchema,
  outputSchema: saidaSchema,
})
  .then(receber)
  .then(especificar)
  .then(validar)
  .then(abrirCards)
  .then(executar)
  .then(entregar)
  .commit()
