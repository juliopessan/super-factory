// Intake: da demanda ao pull request, no mesmo ritmo do Claude Code. A pessoa descreve o que quer; a Factory especifica, parte em cards
// (por padrão UM: uma demanda, uma branch nova, um PR), abre os cards, roda o modo autônomo e entrega os PRs ao aprovador.
// A partir do PR o trabalho é de uma pessoa: revisar e fazer o merge. A Factory não aprova, não mescla e não faz deploy.
//
// As fases seguem os estágios do manifesto (triage, specification, implementation, verification, human-review, delivery) e cada uma
// anota o que fez. O que depende de modelo (a especificação) e de Mastra (rodar a onda) entra por `deps`, então tudo aqui testa sem rede.
//
// Limites que não dependem de instrução:
// - o texto da demanda é dado de terceiros: passa pela varredura de segredo, e pedido de merge/deploy/push protegido para na triagem do card;
// - cada card do plano passa pela MESMA triagem de qualquer card (critério observável, segredo, rascunho) e por duplicata do quadro;
// - no máximo uma rodada de correção do plano; depois disso a demanda para com o motivo, em vez de gastar mais;
// - os tetos de tokens, o disjuntor e o preflight do sandbox valem como em qualquer onda.

import { createHash } from 'node:crypto'

import { z } from 'zod'

import { lerMapaGuardado } from './artefatos.ts'
import { duplicatasDe } from './cards.ts'
import { listarPedidos } from './decisoes.ts'
import { MAXIMO_DE_CARDS_POR_ONDA, PADRAO_DE_CHAVE, validarOnda } from './dependencias.ts'
import { bloqueioDoDisjuntor, chaveDoRepositorio } from './disjuntor.ts'
import { normalizarRepositorio, redigirSegredos, varrerSegredos } from './guards.ts'
import { iniciar, triarPedido } from './pipeline.ts'
import { prepararOnda, type PedidoPreparado } from './preparar-onda.ts'
import type { DepsDoPreflight } from './preflight.ts'
import type { Tetos } from './custo.ts'
import { visaoDaOnda, type VisaoDaOnda } from './ondas.ts'
import type { Card, Provedor } from './schemas.ts'
import { atualizarEstado, alocarId, lerEstado, type FabricaEstado } from './store.ts'

export type EstagioDaDemanda = 'triage' | 'specification' | 'implementation' | 'verification' | 'human-review' | 'delivery'
export type SituacaoDaDemanda = 'em-andamento' | 'precisa-de-resposta' | 'so-plano' | 'bloqueada' | 'pronta-para-o-merge' | 'parcial' | 'entregue'

const CardDoPlanoSchema = z.object({
  chave: z.string().regex(PADRAO_DE_CHAVE, 'A chave usa de 1 a 24 letras minúsculas, números e hífen.'),
  titulo: z.string().min(4).max(120),
  descricao: z.string().min(20).max(4000),
  criterios: z.array(z.string().min(8).max(400)).min(1).max(8),
  dependeDe: z.string().regex(PADRAO_DE_CHAVE).nullish(),
})

export const PlanoSchema = z.object({
  resumo: z.string().min(10).max(600),
  objetivo: z.string().min(10).max(600),
  foraDeEscopo: z.array(z.string().max(300)).max(10).default([]),
  riscos: z.array(z.string().max(300)).max(10).default([]),
  cards: z.array(CardDoPlanoSchema).max(MAXIMO_DE_CARDS_POR_ONDA),
  perguntas: z.array(z.string().min(5).max(300)).max(3).default([]),
})
export type PlanoDaDemanda = z.infer<typeof PlanoSchema>

export type EntregaDaDemanda = {
  prs: Array<{ chave: string | null; titulo: string; url: string; branch: string | null; base: string | null; revisao: string | null }>
  parados: Array<{ titulo: string; motivo: string }>
  ordemDeMerge: string[]
}

export type Demanda = {
  id: string
  texto: string
  origem: 'chat' | 'issue' | 'api'
  repositorio: string
  provedor: Provedor
  branchBase: string
  issue: number | null
  hash: string
  opcoes: { soPlano: boolean; ensaio: boolean; revisar: boolean }
  estagio: EstagioDaDemanda
  situacao: SituacaoDaDemanda
  motivo: string | null
  plano: PlanoDaDemanda | null
  tentativasDoPlano: number
  cardIds: string[]
  onda: number | null
  entrega: EntregaDaDemanda | null
  eventos: Array<{ em: string; estagio: EstagioDaDemanda; texto: string }>
  criadaEm: string
  atualizadaEm: string
}

const MAXIMO_EM_ANDAMENTO = 5
const MAXIMO_GUARDADAS = 100
const MAXIMO_DE_EVENTOS = 40

// ---------- registro ----------

export type EntradaDaDemanda = { texto: string; repositorio: string; provedor?: Provedor; branchBase?: string; issue?: number; origem?: Demanda['origem']; soPlano?: boolean; ensaio?: boolean; revisar?: boolean }

const normalizarTexto = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
export const hashDaDemanda = (texto: string, repositorio: string) => createHash('sha1').update(`${chaveDoRepositorio(repositorio)}\n${normalizarTexto(texto)}`).digest('hex').slice(0, 12)

function gravar(id: string, mudar: (d: Demanda) => Demanda): Demanda {
  let saida: Demanda | null = null
  atualizarEstado((e) => ({
    ...e,
    demandas: (e.demandas ?? []).map((d) => {
      if (d.id !== id) return d
      saida = mudar(d)
      return saida
    }),
  }))
  if (!saida) throw new Error(`Não achei a demanda ${id}.`)
  return saida
}

export function lerDemandaGravada(id: string, estado: FabricaEstado = lerEstado()): Demanda | null {
  return (estado.demandas ?? []).find((d) => d.id === id) ?? null
}

export function anotarDemanda(id: string, estagio: EstagioDaDemanda, texto: string, mudancas: Partial<Pick<Demanda, 'situacao' | 'motivo' | 'plano' | 'tentativasDoPlano' | 'cardIds' | 'onda' | 'entrega'>> = {}, agora: Date = new Date()): Demanda {
  return gravar(id, (d) => ({ ...d, ...mudancas, estagio, eventos: [...d.eventos, { em: agora.toISOString(), estagio, texto: redigirSegredos(texto).slice(0, 400) }].slice(-MAXIMO_DE_EVENTOS), atualizadaEm: agora.toISOString() }))
}

/** Registra a demanda, sem executar nada. A mesma demanda ainda aberta no mesmo repositório devolve a que já existe. */
export function registrarDemanda(e: EntradaDaDemanda, agora: Date = new Date()): { ok: boolean; demanda: Demanda | null; existente: boolean; nota: string } {
  const falha = (nota: string) => ({ ok: false, demanda: null, existente: false, nota })
  const texto = e.texto.trim()
  if (texto.length < 20 || texto.length > 6000) return falha('Descreva a demanda em 20 a 6.000 caracteres: o que a pessoa quer, para quem e o que fica de fora.')
  const provedor: Provedor = e.provedor ?? 'github'
  let repositorio: string
  try {
    repositorio = normalizarRepositorio(provedor, e.repositorio)
  } catch {
    return falha('Informe o repositório (owner/repo no GitHub).')
  }
  if (!repositorio || repositorio.length < 3) return falha('Informe o repositório (owner/repo no GitHub).')
  const segredos = varrerSegredos(texto)
  if (segredos.encontrado) return falha(`A demanda tem um padrão de segredo (${segredos.rotulos.join(', ')}). Tire o valor e envie de novo: a Factory não guarda nem repassa segredo.`)
  const hash = hashDaDemanda(texto, repositorio)
  const estado = lerEstado()
  const aberta = (estado.demandas ?? []).find((d) => d.hash === hash && (d.situacao === 'em-andamento' || d.situacao === 'precisa-de-resposta'))
  if (aberta) return { ok: true, demanda: aberta, existente: true, nota: `Essa demanda já está aberta como ${aberta.id} (${aberta.situacao}).` }
  if ((estado.demandas ?? []).filter((d) => d.situacao === 'em-andamento').length >= MAXIMO_EM_ANDAMENTO) return falha(`Já há ${MAXIMO_EM_ANDAMENTO} demandas em andamento. Espere uma terminar: demanda demais ao mesmo tempo só gasta tokens e brigam pelos mesmos arquivos.`)
  const demanda: Demanda = {
    id: alocarId('DM'),
    texto,
    origem: e.origem ?? 'chat',
    repositorio,
    provedor,
    branchBase: e.branchBase?.trim() || 'main',
    issue: e.issue ?? null,
    hash,
    opcoes: { soPlano: e.soPlano ?? false, ensaio: e.ensaio ?? false, revisar: e.revisar ?? true },
    estagio: 'triage',
    situacao: 'em-andamento',
    motivo: null,
    plano: null,
    tentativasDoPlano: 0,
    cardIds: [],
    onda: null,
    entrega: null,
    eventos: [{ em: agora.toISOString(), estagio: 'triage', texto: 'Demanda recebida.' }],
    criadaEm: agora.toISOString(),
    atualizadaEm: agora.toISOString(),
  }
  atualizarEstado((s) => {
    const todas = [...(s.demandas ?? []), demanda]
    const abertas = todas.filter((d) => d.situacao === 'em-andamento' || d.situacao === 'precisa-de-resposta')
    const fechadas = todas.filter((d) => !abertas.includes(d)).slice(-MAXIMO_GUARDADAS)
    return { ...s, demandas: [...fechadas, ...abertas] }
  })
  return { ok: true, demanda, existente: false, nota: `Demanda ${demanda.id} recebida.` }
}

// ---------- a especificação (o que o modelo devolve) ----------

/** Lê o plano que o especificador devolveu: um objeto JSON, num bloco ```json ou solto no texto. */
export function lerPlanoDoTexto(texto: string): { ok: true; plano: PlanoDaDemanda } | { ok: false; erro: string } {
  const bloco = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto)?.[1]
  const candidato = (bloco ?? texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1)).trim()
  if (!candidato.startsWith('{')) return { ok: false, erro: 'A resposta não trouxe o plano em JSON.' }
  let bruto: unknown
  try {
    bruto = JSON.parse(candidato)
  } catch {
    return { ok: false, erro: 'O JSON do plano está malformado.' }
  }
  const r = PlanoSchema.safeParse(bruto)
  if (!r.success) return { ok: false, erro: `O plano não segue o formato: ${r.error.issues.slice(0, 4).map((i) => `${i.path.join('.') || 'raiz'}: ${i.message}`).join('; ')}.` }
  const p = r.data
  return { ok: true, plano: { ...p, resumo: redigirSegredos(p.resumo), objetivo: redigirSegredos(p.objetivo), foraDeEscopo: p.foraDeEscopo.map(redigirSegredos), riscos: p.riscos.map(redigirSegredos), perguntas: p.perguntas.map(redigirSegredos), cards: p.cards.map((c) => ({ ...c, titulo: redigirSegredos(c.titulo), descricao: redigirSegredos(c.descricao), criterios: c.criterios.map(redigirSegredos) })) } }
}

/** O plano de um ensaio: sem modelo e sem chave, um card só, para percorrer o fluxo. */
export function planoDeEnsaio(d: Pick<Demanda, 'texto'>): PlanoDaDemanda {
  const titulo = `[ENSAIO] ${d.texto.replace(/\s+/g, ' ').slice(0, 80)}`.trim()
  return {
    resumo: 'Plano de ensaio: um card, sem modelo.',
    objetivo: d.texto.replace(/\s+/g, ' ').slice(0, 300),
    foraDeEscopo: ['Merge, deploy e push em branch protegida.'],
    riscos: [],
    perguntas: [],
    cards: [{ chave: 'ensaio', titulo, descricao: `Ensaio do fluxo de demanda: ${d.texto.replace(/\s+/g, ' ').slice(0, 300)}. Nada é clonado, escrito ou enviado.`, criterios: ['O endpoint de saúde devolve 200 quando o serviço está de pé.', 'O comando de testes do repositório termina com código 0.'] }],
  }
}

export function contextoParaEspecificar(d: Demanda, estado: FabricaEstado = lerEstado()): string {
  const mapa = lerMapaGuardado(d.repositorio)
  const doRepo = estado.cards.filter((c) => c.repositorio.toLowerCase() === d.repositorio.toLowerCase()).slice(-15)
  return [
    `Repositório: ${d.repositorio} (${d.provedor}), branch de destino: ${d.branchBase}.`,
    mapa ? `Mapa do repositório (guardado pela Factory):\n${mapa.slice(0, 3000)}` : 'A Factory ainda não tem o mapa deste repositório: leia a estrutura com listarArquivosGithub antes de apontar arquivos.',
    doRepo.length ? `Cards que já existem neste repositório (não repita o mesmo trabalho):\n${doRepo.map((c) => `- ${c.id} [${c.coluna}] ${c.titulo}`).join('\n')}` : 'Não há cards deste repositório no quadro.',
  ].join('\n\n')
}

// ---------- validação do plano ----------

export type ValidacaoDoPlano = { ok: boolean; problemas: string[]; duplicatas: string[] }

/** A mesma triagem de qualquer card, mais chaves, dependências, tamanho da onda e duplicata do quadro. */
export function validarPlano(plano: PlanoDaDemanda, d: Pick<Demanda, 'provedor' | 'repositorio' | 'branchBase'>, estado: FabricaEstado = lerEstado()): ValidacaoDoPlano {
  const problemas: string[] = []
  const duplicatas: string[] = []
  if (plano.cards.length === 0) return { ok: false, problemas: ['O plano não tem nenhum card.'], duplicatas }
  try {
    validarOnda(plano.cards.map((c) => ({ chave: c.chave, dependeDe: c.dependeDe ?? null })))
  } catch (erro) {
    problemas.push(erro instanceof Error ? erro.message : 'Chaves ou dependências inválidas.')
  }
  const chaves = new Set(plano.cards.map((c) => c.chave))
  if (chaves.size !== plano.cards.length) problemas.push('Há chaves repetidas entre os cards.')
  for (const c of plano.cards) {
    if (c.dependeDe && !chaves.has(c.dependeDe)) problemas.push(`O card "${c.chave}" depende de "${c.dependeDe}", que não existe no plano.`)
    try {
      const t = triarPedido({ titulo: c.titulo, descricao: c.descricao, criterios: c.criterios.join('\n'), provedor: d.provedor, repositorio: d.repositorio, branchBase: d.branchBase, branchHead: '' })
      for (const b of t.bloqueios) problemas.push(`Card "${c.chave}": ${b}`)
      const parecido = duplicatasDe(estado.cards, { id: 'C-0', titulo: t.titulo, descricao: t.descricao, criterios: t.criterios, coluna: 'ready', rota: t.rota, grau: 'easy', provedor: d.provedor, repositorio: d.repositorio, branchBase: d.branchBase, branchHead: null, onda: null, itemExterno: null } as Card)
      for (const p of parecido) {
        duplicatas.push(p.id)
        problemas.push(`Card "${c.chave}" parece o mesmo trabalho de ${p.id} (${p.coluna}: ${p.titulo}).`)
      }
    } catch (erro) {
      problemas.push(`Card "${c.chave}": ${erro instanceof Error ? erro.message : 'pedido inválido'}`)
    }
  }
  return { ok: problemas.length === 0, problemas, duplicatas: [...new Set(duplicatas)] }
}

// ---------- as fases ----------

export type ResultadoDaOnda = {
  cartoes: Array<{ titulo: string; ok: boolean; desfecho: string; pullRequestUrl: string | null; motivo: string | null; chave: string | null; branch: string | null; base: string | null; pai: string | null; revisao: string | null }>
  resumo: string
  ordemDeMerge: string[]
}

export type DepsDoIntake = {
  /** Especifica a demanda (modelo). `reparar` traz o que estava errado no plano anterior; nulo na primeira vez. */
  especificar: (e: { demanda: Demanda; contexto: string; reparar: string | null }) => Promise<{ texto: string; uso?: { entrada: number; saida: number } }>
  /** Roda a onda (workflow `onda`) e espera o fim. */
  executarOnda: (e: { pedidos: Array<PedidoPreparado & { chave?: string; dependeDe?: string }>; ensaio: boolean; revisar: boolean }) => Promise<ResultadoDaOnda>
  preflight?: DepsDoPreflight
  custo?: { tetos: Tetos; gastoDoDia: () => number }
  registrarGasto?: (origem: string, tokens: number) => void
  agora?: () => Date
}

const parou = (d: Demanda) => d.situacao !== 'em-andamento'

/** Especificação: o modelo lê a demanda e o repositório e devolve o plano. Uma resposta fora do formato ganha uma segunda chance. */
export async function faseEspecificar(id: string, deps: DepsDoIntake): Promise<Demanda> {
  let d = lerDemandaGravada(id)
  if (!d) throw new Error(`Não achei a demanda ${id}.`)
  if (parou(d)) return d
  if (d.opcoes.ensaio) return anotarDemanda(id, 'specification', 'Plano de ensaio (sem modelo): um card.', { plano: planoDeEnsaio(d), tentativasDoPlano: 1 })
  const contexto = contextoParaEspecificar(d)
  let reparar: string | null = null
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const r = await deps.especificar({ demanda: d, contexto, reparar })
    if (r.uso) deps.registrarGasto?.(`intake:${id}`, r.uso.entrada + r.uso.saida)
    const lido = lerPlanoDoTexto(r.texto)
    if (lido.ok) {
      d = anotarDemanda(id, 'specification', `Plano com ${lido.plano.cards.length} card(s)${lido.plano.perguntas.length ? ` e ${lido.plano.perguntas.length} pergunta(s)` : ''}.`, { plano: lido.plano, tentativasDoPlano: tentativa })
      if (lido.plano.perguntas.length > 0) return anotarDemanda(id, 'specification', `Preciso de resposta antes de seguir: ${lido.plano.perguntas.join(' | ')}`, { situacao: 'precisa-de-resposta', motivo: lido.plano.perguntas.join(' ') })
      return d
    }
    reparar = lido.erro
  }
  return anotarDemanda(id, 'specification', `O especificador não devolveu um plano válido: ${reparar}`, { situacao: 'bloqueada', motivo: `O especificador não devolveu um plano válido (${reparar}). Reescreva a demanda com mais detalhe ou divida-a.` })
}

/** Validação do plano: a triagem de cada card, duplicatas e a onda. Um plano com problema volta ao especificador uma vez. */
export async function faseValidar(id: string, deps: DepsDoIntake): Promise<Demanda> {
  let d = lerDemandaGravada(id)
  if (!d) throw new Error(`Não achei a demanda ${id}.`)
  if (parou(d) || !d.plano) return d
  let v = validarPlano(d.plano, d)
  if (!v.ok && d.tentativasDoPlano < 2 && !d.opcoes.ensaio) {
    const r = await deps.especificar({ demanda: d, contexto: contextoParaEspecificar(d), reparar: `O plano anterior foi recusado pela triagem da Factory:\n${v.problemas.slice(0, 8).map((p) => `- ${p}`).join('\n')}\nCorrija esses pontos e devolva o plano inteiro de novo.` })
    if (r.uso) deps.registrarGasto?.(`intake:${id}`, r.uso.entrada + r.uso.saida)
    const lido = lerPlanoDoTexto(r.texto)
    d = anotarDemanda(id, 'specification', lido.ok ? 'Plano corrigido depois da triagem.' : `A correção do plano veio fora do formato: ${lido.ok ? '' : lido.erro}`, lido.ok ? { plano: lido.plano, tentativasDoPlano: 2 } : { tentativasDoPlano: 2 })
    if (lido.ok) {
      if (lido.plano.perguntas.length > 0) return anotarDemanda(id, 'specification', `Preciso de resposta antes de seguir: ${lido.plano.perguntas.join(' | ')}`, { situacao: 'precisa-de-resposta', motivo: lido.plano.perguntas.join(' ') })
      v = validarPlano(lido.plano, d)
    }
  }
  if (!v.ok) return anotarDemanda(id, 'specification', `Plano recusado: ${v.problemas[0]}`, { situacao: 'bloqueada', motivo: `O plano não passou na triagem: ${v.problemas.slice(0, 5).join(' ')}` })
  if (d.opcoes.soPlano) return anotarDemanda(id, 'specification', 'Plano validado; parei aqui porque você pediu só o plano.', { situacao: 'so-plano' })
  return anotarDemanda(id, 'specification', 'Plano validado pela triagem.')
}

/** Abre os cards do plano no quadro (todos passam pela triagem de novo, porque o quadro pode ter mudado). */
export function faseAbrirCards(id: string): Demanda {
  const d = lerDemandaGravada(id)
  if (!d) throw new Error(`Não achei a demanda ${id}.`)
  if (parou(d) || !d.plano) return d
  const ids: string[] = []
  for (const c of d.plano.cards) {
    const issue = d.issue && d.plano.cards.length === 1 ? `\n\n(Origem: issue #${d.issue}.)` : ''
    const estado = iniciar({ titulo: c.titulo, descricao: `${c.descricao}${issue}\n\nDemanda ${d.id}: ${d.plano.objetivo}`.slice(0, 4000), criterios: c.criterios.join('\n'), provedor: d.provedor, repositorio: d.repositorio, branchBase: d.branchBase, branchHead: '' })
    ids.push(estado.card.id)
    if (estado.parado) {
      return anotarDemanda(id, 'implementation', `O card "${c.chave}" foi bloqueado na triagem: ${estado.motivo}`, { situacao: 'bloqueada', motivo: `O card ${estado.card.id} ("${c.chave}") foi bloqueado na triagem: ${estado.motivo}`, cardIds: ids })
    }
  }
  return anotarDemanda(id, 'implementation', `${ids.length} card(s) em ready: ${ids.join(', ')}.`, { cardIds: ids })
}

/** Preflight (disjuntor, teto, sandbox), onda e espera pelos PRs. Cada card tem a própria branch nova. */
export async function faseExecutar(id: string, deps: DepsDoIntake): Promise<Demanda> {
  let d = lerDemandaGravada(id)
  if (!d) throw new Error(`Não achei a demanda ${id}.`)
  if (parou(d) || !d.plano) return d
  const bloqueioDoRepo = d.opcoes.ensaio ? null : bloqueioDoDisjuntor(d.repositorio)
  if (bloqueioDoRepo) return anotarDemanda(id, 'implementation', bloqueioDoRepo, { situacao: 'bloqueada', motivo: bloqueioDoRepo })
  const preparo = await prepararOnda({ cardIds: d.cardIds, repositorio: d.repositorio, ensaio: d.opcoes.ensaio }, { preflight: deps.preflight, custo: deps.custo })
  if (!preparo.ok) return anotarDemanda(id, 'implementation', `A onda não pôde começar: ${preparo.nota}`, { situacao: 'bloqueada', motivo: preparo.nota, onda: preparo.onda })
  // O plano diz quem depende de quem; o card existente ganha a chave dele.
  const chaveDoCard = new Map(d.cardIds.map((cardId, i) => [cardId, d!.plano!.cards[i]!]))
  const pedidos = preparo.pedidos.map((p) => {
    const c = p.cardId ? chaveDoCard.get(p.cardId) : undefined
    return { ...p, ...(c ? { chave: c.chave, ...(c.dependeDe ? { dependeDe: c.dependeDe } : {}) } : {}) }
  })
  try {
    validarOnda(pedidos.map((p) => ({ chave: p.chave ?? null, dependeDe: p.dependeDe ?? null })))
  } catch (erro) {
    return anotarDemanda(id, 'implementation', `Onda inválida: ${erro instanceof Error ? erro.message : 'erro'}`, { situacao: 'bloqueada', motivo: erro instanceof Error ? erro.message : 'Onda inválida.' })
  }
  d = anotarDemanda(id, 'implementation', `Onda ${preparo.onda ?? '?'} iniciada com ${pedidos.length} card(s): cada um com a própria branch nova e o próprio PR.`, { onda: preparo.onda })
  const onda = await deps.executarOnda({ pedidos, ensaio: d.opcoes.ensaio, revisar: d.opcoes.revisar && !d.opcoes.ensaio })
  d = anotarDemanda(id, 'verification', `A onda terminou: ${onda.resumo}`)
  const prs = onda.cartoes.filter((c) => c.ok && c.pullRequestUrl).map((c) => ({ chave: c.chave, titulo: c.titulo, url: c.pullRequestUrl as string, branch: c.branch, base: c.base, revisao: c.revisao }))
  const parados = onda.cartoes.filter((c) => !c.ok || !c.pullRequestUrl).map((c) => ({ titulo: c.titulo, motivo: (c.motivo ?? 'Terminou sem abrir o pull request.').slice(0, 400) }))
  return anotarDemanda(id, 'verification', `${prs.length} PR(s) aberto(s), ${parados.length} card(s) parado(s).`, { entrega: { prs, parados, ordemDeMerge: onda.ordemDeMerge } })
}

/** Entrega ao aprovador: PR aberto é o fim do trabalho da Factory. Dali em diante, revisar e mesclar é de uma pessoa. */
export function faseEntregar(id: string): Demanda {
  const d = lerDemandaGravada(id)
  if (!d) throw new Error(`Não achei a demanda ${id}.`)
  if (parou(d)) return d
  const e = d.entrega
  if (!e || e.prs.length === 0) return anotarDemanda(id, 'verification', 'Nenhum PR foi aberto.', { situacao: 'bloqueada', motivo: e?.parados.length ? `Nenhum card chegou ao pull request. ${e.parados.map((p) => `${p.titulo}: ${p.motivo}`).join(' ')}`.slice(0, 900) : 'Nenhum card chegou ao pull request.' })
  const parcial = e.parados.length > 0
  return anotarDemanda(id, 'human-review', parcial ? `${e.prs.length} PR(s) aguardam o aprovador; ${e.parados.length} card(s) pararam.` : `${e.prs.length} PR(s) aguardam o aprovador.`, { situacao: parcial ? 'parcial' : 'pronta-para-o-merge' })
}

/** Todas as fases, em sequência. O workflow chama as fases uma a uma (para acenderem no canvas); os testes e a API chamam esta. */
export async function rodarIntake(id: string, deps: DepsDoIntake): Promise<Demanda> {
  await faseEspecificar(id, deps)
  await faseValidar(id, deps)
  faseAbrirCards(id)
  await faseExecutar(id, deps)
  return faseEntregar(id)
}

// ---------- leitura ----------

export type VisaoDaDemanda = {
  demanda: Demanda
  onda: VisaoDaOnda | null
  estagio: EstagioDaDemanda
  situacao: SituacaoDaDemanda
  aguardaPessoa: string[]
  pedidosAbertos: Array<{ id: string; pergunta: string }>
  resumo: string
}

/** A demanda inteira numa leitura: onde está, o que cada card virou e o que depende de uma pessoa agora. */
export function visaoDaDemanda(id: string, estado: FabricaEstado = lerEstado()): VisaoDaDemanda | null {
  const d = lerDemandaGravada(id, estado)
  if (!d) return null
  const onda = d.onda !== null ? visaoDaOnda(d.onda, estado) : null
  const cards = onda ? onda.cards.filter((c) => d.cardIds.includes(c.id)) : []
  let estagio = d.estagio
  let situacao = d.situacao
  // Depois do PR, a verdade está nos cards: PR aberto espera o aprovador; tudo mesclado é entrega.
  if (cards.length > 0 && (situacao === 'pronta-para-o-merge' || situacao === 'parcial' || situacao === 'entregue')) {
    const comPr = cards.filter((c) => ['pr-aberto', 'mesclado', 'recusado'].includes(c.andamento))
    if (comPr.length > 0 && comPr.every((c) => c.andamento === 'mesclado')) {
      estagio = 'delivery'
      situacao = 'entregue'
    }
  }
  const pedidosAbertos = listarPedidos({ estado: 'aberto' }, estado).filter((p) => p.repositorio === d.repositorio || (p.cardId !== null && d.cardIds.includes(p.cardId))).map((p) => ({ id: p.id, pergunta: p.pergunta }))
  const aguarda: string[] = []
  if (situacao === 'precisa-de-resposta') aguarda.push(`Responder: ${d.plano?.perguntas.join(' | ') ?? d.motivo ?? ''}`)
  if (situacao === 'so-plano') aguarda.push('Ler o plano e, se estiver bom, pedir a execução (receberDemanda sem soPlano).')
  if (situacao === 'bloqueada') aguarda.push(`Resolver o bloqueio: ${d.motivo ?? ''}`)
  if (d.entrega && ['pronta-para-o-merge', 'parcial'].includes(situacao)) {
    const abertos = cards.filter((c) => c.andamento === 'pr-aberto')
    const ordem = d.entrega.ordemDeMerge.length ? ` Ordem do merge: ${d.entrega.ordemDeMerge.join(' → ')}.` : ''
    aguarda.push(`Revisar e fazer o merge de ${abertos.length || d.entrega.prs.length} PR(s):${ordem} ${d.entrega.prs.map((p) => p.url).join(' ')}`.trim())
    if (d.entrega.parados.length) aguarda.push(`Decidir o que fazer com ${d.entrega.parados.length} card(s) parado(s): ${d.entrega.parados.map((p) => p.titulo).join('; ')}.`)
  }
  for (const c of cards) {
    const abertos = c.criterios.filter((k) => k.status === 'FAIL' || k.status === 'NOT_RUN' || k.status === 'BLOCKED')
    if (c.pullRequestUrl && abertos.length) aguarda.push(`Olhar no PR de ${c.id}: ${abertos.length} critério(s) sem resultado conclusivo (${abertos.map((k) => `${k.n} ${k.status}`).join(', ')}).`)
  }
  for (const p of pedidosAbertos) aguarda.push(`Responder o pedido ${p.id}: ${p.pergunta}`)
  const quando = `Demanda ${d.id} em ${estagio}, ${situacao.replace(/-/g, ' ')}.`
  return { demanda: d, onda, estagio, situacao, aguardaPessoa: aguarda, pedidosAbertos, resumo: `${quando}${d.entrega ? ` ${d.entrega.prs.length} PR(s) aberto(s).` : ''}${aguarda.length ? ` Falta uma pessoa: ${aguarda[0]}` : ''}` }
}

export function listarDemandas(estado: FabricaEstado = lerEstado()): Array<{ id: string; repositorio: string; situacao: SituacaoDaDemanda; estagio: EstagioDaDemanda; resumo: string; criadaEm: string }> {
  return (estado.demandas ?? []).map((d) => ({ id: d.id, repositorio: d.repositorio, situacao: d.situacao, estagio: d.estagio, resumo: (d.plano?.resumo ?? d.texto).slice(0, 140), criadaEm: d.criadaEm })).reverse()
}
