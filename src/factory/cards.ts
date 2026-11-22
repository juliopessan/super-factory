// Cards que já estão no quadro: ler por ID, editar, mover com transições controladas, achar duplicata, escolher e reservar
// para uma onda. Antes disto o planejador devolvia IDs que o iniciador não aceitava, e cada execução abria um card novo.
// Aqui valem duas regras: (1) a pessoa (ou o Chief a pedido dela) decide o que entra na onda; (2) uma execução parte do card
// que já existe, nunca de uma cópia dele. Não há transição para build/qa/review/done por aqui: isso é da execução e do merge humano.

import { grauDe } from './board.ts'
import { anotar } from './ledger.ts'
import { triarPedido } from './pipeline.ts'
import type { Card, Estado, PedidoBruto } from './schemas.ts'
import { atualizarEstado, lerEstado, type FabricaEstado } from './store.ts'

export const COLUNAS_EDITAVEIS = ['backlog', 'ready', 'blocked'] as const
export const COLUNAS_ATIVAS = ['build', 'qa', 'review'] as const
type ColunaEditavel = (typeof COLUNAS_EDITAVEIS)[number]

const noRun = (card: Pick<Card, 'id'>) => `R${card.id.slice(1)}`

function numeroDe(id: string): number {
  return Number(/(\d+)$/.exec(id)?.[1] ?? 0)
}

export function normalizarTitulo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function palavras(texto: string): string[] {
  return [...new Set(normalizarTitulo(texto).split(' ').filter((p) => p.length > 2))]
}

function parecidos(a: string, b: string): number {
  const A = palavras(a)
  const B = new Set(palavras(b))
  if (A.length === 0 || B.size === 0) return 0
  const comuns = A.filter((p) => B.has(p)).length
  return comuns / (A.length + B.size - comuns)
}

export type Duplicata = { id: string; titulo: string; coluna: Card['coluna']; motivo: 'mesmo-item-externo' | 'titulo-igual' | 'titulo-parecido'; ativo: boolean }

/**
 * Outros cards do mesmo repositório que parecem ser o mesmo trabalho: a mesma issue de origem, o mesmo título ou um título muito parecido.
 * "ativo" quer dizer que o trabalho já está em execução, em revisão ou entregue (build, qa, review ou done).
 */
export function duplicatasDe(cards: Card[], card: Card): Duplicata[] {
  const saida: Duplicata[] = []
  for (const outro of cards) {
    if (outro.id === card.id || outro.repositorio.toLowerCase() !== card.repositorio.toLowerCase()) continue
    const motivo: Duplicata['motivo'] | null =
      card.itemExterno && outro.itemExterno === card.itemExterno
        ? 'mesmo-item-externo'
        : normalizarTitulo(outro.titulo) === normalizarTitulo(card.titulo)
          ? 'titulo-igual'
          : parecidos(outro.titulo, card.titulo) >= 0.8
            ? 'titulo-parecido'
            : null
    if (!motivo) continue
    saida.push({ id: outro.id, titulo: outro.titulo, coluna: outro.coluna, motivo, ativo: [...COLUNAS_ATIVAS, 'done'].includes(outro.coluna) })
  }
  return saida.sort((a, b) => numeroDe(a.id) - numeroDe(b.id))
}

/** "issue:owner/repo#12" → 12, só se for do mesmo repositório do card. */
export function issueDoCard(card: Card): number | null {
  const m = /^issue:([^#]+)#(\d+)$/.exec(card.itemExterno ?? '')
  return m && m[1]!.toLowerCase() === card.repositorio.toLowerCase() ? Number(m[2]) : null
}

// ---------- ler ----------

export type CardCompleto = {
  card: Card
  issue: number | null
  duplicatas: Duplicata[]
  execucao: null | {
    runId: string
    estagio: string
    desfecho: string
    parado: boolean
    motivo: string | null
    checks: Array<{ nome: string; resultado: string }>
    pullRequestUrl: string | null
    resultadoPr: string | null
    tokens: number | null
    ultimosEventos: Array<{ tipo: string; resumo: string }>
  }
  podeEditar: boolean
  podeIniciar: boolean
  porQueNaoIniciar: string | null
}

export function lerCardCompleto(cardId: string, estado: FabricaEstado = lerEstado()): CardCompleto | null {
  const card = estado.cards.find((c) => c.id === cardId)
  if (!card) return null
  const run = estado.runs[noRun(card)] ?? Object.values(estado.runs).find((r) => r.card.id === card.id) ?? null
  const duplicatas = duplicatasDe(estado.cards, card)
  const razao = razaoParaNaoIniciar(card, run, duplicatas)
  return {
    card,
    issue: issueDoCard(card),
    duplicatas,
    execucao: run
      ? {
          runId: run.runId,
          estagio: run.estagio,
          desfecho: run.desfecho,
          parado: run.parado,
          motivo: run.motivo,
          checks: run.checks.map((c) => ({ nome: c.nome, resultado: c.resultado })),
          pullRequestUrl: run.entrega?.pullRequestUrl ?? null,
          resultadoPr: run.resultadoPr?.resultado ?? null,
          tokens: run.uso ? run.uso.entrada + run.uso.saida : null,
          ultimosEventos: run.trilha.slice(-8).map((e) => ({ tipo: e.tipo, resumo: e.resumo })),
        }
      : null,
    podeEditar: (COLUNAS_EDITAVEIS as readonly string[]).includes(card.coluna),
    podeIniciar: razao === null,
    porQueNaoIniciar: razao,
  }
}

function razaoParaNaoIniciar(card: Card, run: Estado | null, duplicatas: Duplicata[]): string | null {
  if (card.coluna !== 'ready') return `O card está em ${card.coluna}: só card em ready inicia.`
  if (run?.entrega?.pullRequestUrl) return `O card já tem o pull request ${run.entrega.pullRequestUrl}.`
  const ativa = duplicatas.find((d) => d.ativo)
  if (ativa) return `${ativa.id} (${ativa.coluna}) é o mesmo trabalho (${ativa.motivo.replaceAll('-', ' ')}).`
  return null
}

// ---------- editar e mover ----------

export type ResultadoDeCard = { ok: boolean; card: Card | null; nota: string }

function gravarCard(card: Card, evento?: { resumo: string }): void {
  atualizarEstado((estado) => {
    const run = estado.runs[noRun(card)]
    const runs = run ? { ...estado.runs, [run.runId]: evento ? anotar({ ...run, card, atualizadoEm: new Date().toISOString() }, 'observed', evento.resumo, 'chief-of-staff') : { ...run, card } } : estado.runs
    return { ...estado, cards: estado.cards.map((c) => (c.id === card.id ? card : c)), runs, ledger: run && evento ? [...estado.ledger.filter((e) => e.runId !== run.runId), ...runs[run.runId]!.trilha] : estado.ledger }
  })
}

const brutoDe = (card: Card, mudar: { titulo?: string; descricao?: string; criterios?: string[]; branchBase?: string } = {}): PedidoBruto => ({
  titulo: mudar.titulo ?? card.titulo,
  descricao: mudar.descricao ?? card.descricao,
  criterios: (mudar.criterios ?? card.criterios).join('\n'),
  provedor: card.provedor,
  repositorio: card.repositorio,
  branchBase: mudar.branchBase ?? card.branchBase,
  ...(card.branchHead ? { branchHead: card.branchHead } : {}),
})

/**
 * Corrige título, descrição, critérios ou branch base de um card que ainda não executou (backlog, ready ou blocked).
 * A triagem roda de novo sobre o texto novo: o card pode passar a bloquear. Quem coloca o card em ready é moverCard.
 */
export function editarCard(cardId: string, mudancas: { titulo?: string; descricao?: string; criterios?: string[]; branchBase?: string }, estado: FabricaEstado = lerEstado()): ResultadoDeCard {
  const card = estado.cards.find((c) => c.id === cardId)
  if (!card) return { ok: false, card: null, nota: `Não achei o card ${cardId}.` }
  if (!(COLUNAS_EDITAVEIS as readonly string[]).includes(card.coluna)) return { ok: false, card, nota: `O card ${cardId} está em ${card.coluna}: só backlog, ready e blocked se editam. Um card em execução ou entregue não muda por aqui.` }
  if (!mudancas.titulo && !mudancas.descricao && !mudancas.criterios && !mudancas.branchBase) return { ok: false, card, nota: 'Nada para mudar: informe título, descrição, critérios ou branch base.' }
  let triagem: ReturnType<typeof triarPedido>
  try {
    triagem = triarPedido(brutoDe(card, mudancas))
  } catch (erro) {
    return { ok: false, card, nota: erro instanceof Error ? erro.message : 'Pedido inválido.' }
  }
  const proximo: Card = {
    ...card,
    titulo: triagem.titulo,
    descricao: triagem.descricao,
    criterios: triagem.criterios,
    branchBase: triagem.pedido.branchBase,
    rota: triagem.rota,
    grau: grauDe(triagem.descricao, 1),
    // Bloqueou na triagem do texto novo: vai para blocked. Passou: a coluna fica como está (moverCard decide o resto).
    coluna: triagem.bloqueios.length > 0 ? 'blocked' : card.coluna,
  }
  const campos = (['titulo', 'descricao', 'criterios', 'branchBase'] as const).filter((k) => mudancas[k] !== undefined)
  gravarCard(proximo, { resumo: `Card editado (${campos.join(', ')}).` })
  const nota =
    triagem.bloqueios.length > 0
      ? `Card ${cardId} editado, mas a triagem bloqueia: ${triagem.bloqueios.join(' ')}`
      : card.coluna === 'blocked'
        ? `Card ${cardId} editado e a triagem passa. Use moverCard para colocá-lo em ready.`
        : `Card ${cardId} editado (${campos.join(', ')}); continua em ${proximo.coluna}.`
  return { ok: true, card: proximo, nota }
}

/** Transições permitidas por aqui: entre backlog, ready e blocked. Mover para ready exige que a triagem passe. Limpa a reserva de onda. */
export function moverCard(cardId: string, para: ColunaEditavel, motivo?: string, estado: FabricaEstado = lerEstado()): ResultadoDeCard {
  const card = estado.cards.find((c) => c.id === cardId)
  if (!card) return { ok: false, card: null, nota: `Não achei o card ${cardId}.` }
  if (!(COLUNAS_EDITAVEIS as readonly string[]).includes(card.coluna)) return { ok: false, card, nota: `O card ${cardId} está em ${card.coluna}: ele não se move por aqui (build, qa, review e done são da execução e do merge humano).` }
  if (card.coluna === para) return { ok: true, card, nota: `O card ${cardId} já está em ${para}.` }
  if (para === 'blocked' && !motivo?.trim()) return { ok: false, card, nota: 'Para bloquear um card, diga o motivo.' }
  if (para === 'ready') {
    let triagem: ReturnType<typeof triarPedido>
    try {
      triagem = triarPedido(brutoDe(card))
    } catch (erro) {
      return { ok: false, card, nota: erro instanceof Error ? erro.message : 'Pedido inválido.' }
    }
    if (triagem.bloqueios.length > 0) return { ok: false, card, nota: `A triagem não deixa ${cardId} ir para ready: ${triagem.bloqueios.join(' ')} Corrija com editarCard.` }
  }
  const proximo: Card = { ...card, coluna: para, onda: null }
  gravarCard(proximo, { resumo: `Card movido de ${card.coluna} para ${para}${motivo ? `: ${motivo.trim().slice(0, 200)}` : ''}.` })
  return { ok: true, card: proximo, nota: `Card ${cardId} movido de ${card.coluna} para ${para}${card.onda !== null ? ' (a reserva de onda foi liberada)' : ''}.` }
}

// ---------- planejar e reservar ----------

export type PlanoDaOnda = { onda: number; limite: number; cardIds: string[]; pulados: Array<{ id: string; motivo: string }>; reservado: boolean }

/**
 * Escolhe os cards da próxima onda. Sem "escolher", vale a ordem de ready. Fica de fora o que já está reservado por outra onda,
 * o que a pessoa excluiu e o que é o mesmo trabalho de um card que já está em execução, em revisão ou entregue.
 * Com "reservar", os escolhidos ficam marcados com o número da onda e não voltam em planos seguintes.
 */
export function planejarOndaDeCards(
  opcoes: { limite?: number; escolher?: string[]; excluir?: string[]; reservar?: boolean; incluirReservados?: boolean } = {},
  estado: FabricaEstado = lerEstado(),
): PlanoDaOnda {
  const limite = Math.min(Math.max(Math.trunc(opcoes.limite ?? 3) || 1, 1), 5)
  const excluir = new Set(opcoes.excluir ?? [])
  const pulados: PlanoDaOnda['pulados'] = []
  const porId = new Map(estado.cards.map((c) => [c.id, c]))
  const candidatos = opcoes.escolher?.length
    ? opcoes.escolher.map((id) => porId.get(id) ?? id)
    : estado.cards.filter((c) => c.coluna === 'ready').sort((a, b) => numeroDe(a.id) - numeroDe(b.id))
  const escolhidos: Card[] = []
  for (const c of candidatos) {
    if (typeof c === 'string') {
      pulados.push({ id: c, motivo: 'não existe no quadro' })
      continue
    }
    if (escolhidos.length >= limite) break
    if (excluir.has(c.id)) { pulados.push({ id: c.id, motivo: 'excluído a pedido' }); continue }
    if (c.coluna !== 'ready') { pulados.push({ id: c.id, motivo: `está em ${c.coluna}, não em ready` }); continue }
    if (c.onda !== null && !opcoes.incluirReservados && !opcoes.escolher?.length) { pulados.push({ id: c.id, motivo: `já reservado pela onda ${c.onda}` }); continue }
    const ativa = duplicatasDe(estado.cards, c).find((d) => d.ativo)
    if (ativa) { pulados.push({ id: c.id, motivo: `é o mesmo trabalho de ${ativa.id} (${ativa.coluna})` }); continue }
    const repetido = escolhidos.find((e) => duplicatasDe([e], c).length > 0)
    if (repetido) { pulados.push({ id: c.id, motivo: `é o mesmo trabalho de ${repetido.id}, já escolhido nesta onda` }); continue }
    escolhidos.push(c)
  }
  const onda = Math.max(0, ...estado.cards.map((c) => c.onda ?? 0)) + 1
  if (opcoes.reservar && escolhidos.length > 0) {
    const ids = new Set(escolhidos.map((c) => c.id))
    atualizarEstado((e) => ({
      ...e,
      cards: e.cards.map((c) => (ids.has(c.id) ? { ...c, onda } : c)),
      runs: Object.fromEntries(Object.entries(e.runs).map(([k, r]) => [k, ids.has(r.card.id) ? { ...r, card: { ...r.card, onda } } : r])),
    }))
  }
  return { onda, limite, cardIds: escolhidos.map((c) => c.id), pulados, reservado: Boolean(opcoes.reservar && escolhidos.length > 0) }
}
