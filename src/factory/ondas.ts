// Visão por onda: cada card reservado para a onda, a execução dele, o PR, o CI e o resultado por critério, num lugar só.
// Antes, a pessoa precisava juntar quadro, trilha e checks à mão. A onda é o número que planejarOnda/iniciarOnda gravam no card.

import { contagemDosCriterios, resultadoPorCriterio, type ResultadoDoCriterio } from './criterios.ts'
import type { GithubDeps } from './github.ts'
import { lerChecksGithub, type ResultadoDaLeitura, type ChecksLidos } from './github-leitura.ts'
import type { Card, Estado } from './schemas.ts'
import { lerEstado, type FabricaEstado } from './store.ts'

export type Andamento = 'aguardando' | 'em-execucao' | 'parado' | 'pr-aberto' | 'mesclado' | 'recusado'

export type CardDaOnda = {
  id: string
  titulo: string
  coluna: Card['coluna']
  andamento: Andamento
  execucao: { runId: string; estagio: string; desfecho: string; motivo: string | null; minutos: number | null } | null
  pullRequestUrl: string | null
  resultadoPr: string | null
  ci: { estado: ChecksLidos['estadoGeral'] | 'nao-lido'; falhou: string[] } | null
  criterios: ResultadoDoCriterio[]
  contagemDeCriterios: string
  tokens: number | null
}

export type VisaoDaOnda = {
  onda: number
  total: number
  porAndamento: Record<Andamento, number>
  tokens: number
  cards: CardDaOnda[]
  resumo: string
}

const ANDAMENTOS: Andamento[] = ['aguardando', 'em-execucao', 'parado', 'pr-aberto', 'mesclado', 'recusado']

function runDoCard(estado: FabricaEstado, card: Card): Estado | null {
  return estado.runs[`R${card.id.slice(1)}`] ?? Object.values(estado.runs).find((r) => r.card.id === card.id) ?? null
}

function minutos(run: Estado): number | null {
  const t = run.trilha.map((e) => Date.parse(e.em)).filter(Number.isFinite)
  return t.length >= 2 ? Math.round(((Math.max(...t) - Math.min(...t)) / 60_000) * 10) / 10 : null
}

function andamentoDe(card: Card, run: Estado | null): Andamento {
  if (run?.resultadoPr?.resultado === 'aceito' || run?.resultadoPr?.resultado === 'ajustado') return 'mesclado'
  if (run?.resultadoPr?.resultado === 'recusado') return 'recusado'
  if (run?.entrega?.pullRequestUrl) return 'pr-aberto'
  if (run?.parado || card.coluna === 'blocked') return 'parado'
  if (card.coluna === 'build' || card.coluna === 'qa' || card.coluna === 'review') return 'em-execucao'
  return 'aguardando'
}

export function visaoDaOnda(onda: number, estado: FabricaEstado = lerEstado()): VisaoDaOnda | null {
  const cards = estado.cards.filter((c) => c.onda === onda).sort((a, b) => Number(a.id.slice(2)) - Number(b.id.slice(2)))
  if (cards.length === 0) return null
  const itens = cards.map((card): CardDaOnda => {
    const run = runDoCard(estado, card)
    const criterios = run?.criterios ?? resultadoPorCriterio({ criterios: card.criterios, mapa: null, arquivosMudados: [], checks: run?.checks ?? [], parado: run?.parado ?? false, motivo: run?.motivo ?? null })
    return {
      id: card.id,
      titulo: card.titulo,
      coluna: card.coluna,
      andamento: andamentoDe(card, run),
      execucao: run ? { runId: run.runId, estagio: run.estagio, desfecho: run.desfecho, motivo: run.motivo, minutos: minutos(run) } : null,
      pullRequestUrl: run?.entrega?.pullRequestUrl ?? null,
      resultadoPr: run?.resultadoPr?.resultado ?? null,
      ci: null,
      criterios,
      contagemDeCriterios: contagemDosCriterios(criterios),
      tokens: run?.uso ? run.uso.entrada + run.uso.saida : null,
    }
  })
  const porAndamento = Object.fromEntries(ANDAMENTOS.map((a) => [a, itens.filter((i) => i.andamento === a).length])) as Record<Andamento, number>
  const tokens = itens.reduce((n, i) => n + (i.tokens ?? 0), 0)
  const partes = ANDAMENTOS.filter((a) => porAndamento[a] > 0).map((a) => `${porAndamento[a]} ${a.replace('-', ' ')}`)
  return { onda, total: itens.length, porAndamento, tokens, cards: itens, resumo: `Onda ${onda}: ${itens.length} card(s) (${partes.join(', ')}).${tokens ? ` ${tokens} tokens gastos.` : ''}` }
}

export function listarOndas(estado: FabricaEstado = lerEstado()): Array<{ onda: number; cards: string[]; resumo: string }> {
  const numeros = [...new Set(estado.cards.map((c) => c.onda).filter((n): n is number => n !== null))].sort((a, b) => a - b)
  return numeros.map((n) => {
    const v = visaoDaOnda(n, estado)!
    return { onda: n, cards: v.cards.map((c) => c.id), resumo: v.resumo }
  })
}

function numeroDoPr(url: string | null): number | null {
  const n = Number(/\/pull\/(\d+)\b/.exec(url ?? '')?.[1])
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Lê o CI de cada PR da onda (só GET). Falha ao ler não derruba a visão: o card fica com "nao-lido". */
export async function anexarCI(visao: VisaoDaOnda, repositorioDe: (cardId: string) => string | null, deps?: GithubDeps, ler: (repo: string, ref: number, d?: GithubDeps) => Promise<ResultadoDaLeitura<ChecksLidos>> = lerChecksGithub): Promise<VisaoDaOnda> {
  const cards: CardDaOnda[] = []
  for (const c of visao.cards) {
    const numero = numeroDoPr(c.pullRequestUrl)
    const repo = repositorioDe(c.id)
    if (!numero || !repo) { cards.push(c); continue }
    const r = await ler(repo, numero, deps).catch(() => null)
    cards.push({ ...c, ci: r?.ok && r.dado ? { estado: r.dado.estadoGeral, falhou: r.dado.checks.filter((k) => k.conclusao && ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'].includes(k.conclusao)).map((k) => k.nome) } : { estado: 'nao-lido', falhou: [] } })
  }
  return { ...visao, cards }
}
