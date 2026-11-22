// Teto de custo, em tokens: o que um card, uma onda e um dia podem gastar com modelo antes de a Factory parar.
// Tokens, e não dinheiro: o preço depende do modelo e do contrato. O teto vale para o construtor, a triagem de bug e a
// revisão automática. 0 desliga o teto daquele nível. Passou do teto, a Factory não começa nada novo e interrompe o agente
// no meio da geração: o trabalho parcial fica no sandbox (descartado) e o card para com o motivo. Nenhum PR sai pela metade.

import { atualizarEstado, lerEstado, type FabricaEstado } from './store.ts'

export type Tetos = { card: number; onda: number; dia: number }
export type NivelDoTeto = 'card' | 'onda' | 'dia'
export type Gasto = { em: string; origem: string; tokens: number }

/** Padrões pensados para a Factory não surpreender: um card comum gasta bem menos que isto. */
export const TETOS_PADRAO: Tetos = { card: 600_000, onda: 2_000_000, dia: 6_000_000 }
export const SEM_TETOS: Tetos = { card: 0, onda: 0, dia: 0 }
const DIAS_LEMBRADOS = 14

export function lerTetos(env: Record<string, string | undefined> = process.env): Tetos {
  const num = (v: string | undefined, padrao: number) => {
    if (v === undefined || v.trim() === '') return padrao
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 ? n : padrao
  }
  return { card: num(env.SUPER_FACTORY_MAX_TOKENS_CARD, TETOS_PADRAO.card), onda: num(env.SUPER_FACTORY_MAX_TOKENS_ONDA, TETOS_PADRAO.onda), dia: num(env.SUPER_FACTORY_MAX_TOKENS_DIA, TETOS_PADRAO.dia) }
}

/** Soma os tokens de cada passo do agente e avisa quando o limite é alcançado (quem chama interrompe a geração). */
export function medidorDeTokens(limite: number | null, aoEstourar: () => void) {
  const uso = { entrada: 0, saida: 0 }
  let estourou = false
  return {
    uso,
    get estourou() {
      return estourou
    },
    aoTerminarPasso(passo: { usage?: { inputTokens?: number; outputTokens?: number } } | undefined) {
      uso.entrada += Number(passo?.usage?.inputTokens) || 0
      uso.saida += Number(passo?.usage?.outputTokens) || 0
      if (limite !== null && !estourou && uso.entrada + uso.saida >= limite) {
        estourou = true
        aoEstourar()
      }
    },
  }
}

export class ErroDeTeto extends Error {
  // Sem "parameter properties": o Node em modo strip-only (npm run check) não as aceita.
  nivel: NivelDoTeto
  gasto: number
  teto: number
  uso: { entrada: number; saida: number }
  constructor(nivel: NivelDoTeto, gasto: number, teto: number, uso: { entrada: number; saida: number }) {
    super(mensagemDoTeto(nivel, gasto, teto))
    this.name = 'ErroDeTeto'
    this.nivel = nivel
    this.gasto = gasto
    this.teto = teto
    this.uso = uso
  }
}

const NOME: Record<NivelDoTeto, string> = { card: 'do card', onda: 'da onda', dia: 'do dia' }
const VARIAVEL: Record<NivelDoTeto, string> = { card: 'SUPER_FACTORY_MAX_TOKENS_CARD', onda: 'SUPER_FACTORY_MAX_TOKENS_ONDA', dia: 'SUPER_FACTORY_MAX_TOKENS_DIA' }

export function mensagemDoTeto(nivel: NivelDoTeto, gasto: number, teto: number): string {
  return `Teto de tokens ${NOME[nivel]} atingido (${gasto.toLocaleString('pt-BR')} de ${teto.toLocaleString('pt-BR')}). A Factory parou para não gastar mais. Se for intencional, suba ${VARIAVEL[nivel]} no .env (0 desliga o teto).${nivel === 'dia' ? ' O contador do dia zera à meia-noite UTC.' : ''}`
}

/** Quanto ainda cabe para este card agora: o menor entre o que resta do teto do card e do teto do dia. Null quando nada limita. */
export function restanteDeTokens(tetos: Tetos, gastoDoCard: number, gastoDoDia: number): { tokens: number; nivel: 'card' | 'dia'; gasto: number; teto: number } | null {
  const opcoes: Array<{ tokens: number; nivel: 'card' | 'dia'; gasto: number; teto: number }> = []
  if (tetos.card > 0) opcoes.push({ tokens: tetos.card - gastoDoCard, nivel: 'card', gasto: gastoDoCard, teto: tetos.card })
  if (tetos.dia > 0) opcoes.push({ tokens: tetos.dia - gastoDoDia, nivel: 'dia', gasto: gastoDoDia, teto: tetos.dia })
  return opcoes.length ? opcoes.reduce((a, b) => (b.tokens < a.tokens ? b : a)) : null
}

const diaDe = (d: Date) => d.toISOString().slice(0, 10)

export function gastoDoDia(estado: FabricaEstado = lerEstado(), agora: Date = new Date()): number {
  const hoje = diaDe(agora)
  return (estado.gastos ?? []).filter((g) => g.em.slice(0, 10) === hoje).reduce((n, g) => n + g.tokens, 0)
}

/** Anota um gasto (origem: "card:C-8", "triagem:acme/x#3", "revisao:..."). Guarda só os últimos dias. */
export function registrarGasto(origem: string, tokens: number, agora: Date = new Date()): void {
  if (!Number.isFinite(tokens) || tokens <= 0) return
  const corte = agora.getTime() - DIAS_LEMBRADOS * 86_400_000
  atualizarEstado((e) => ({
    ...e,
    gastos: [...(e.gastos ?? []).filter((g) => Date.parse(g.em) >= corte), { em: agora.toISOString(), origem: origem.slice(0, 80), tokens: Math.round(tokens) }],
  }))
}

export type ResumoDeCusto = {
  tetos: Tetos
  hoje: { tokens: number; restante: number | null; porOrigem: Array<{ origem: string; tokens: number }> }
  cardsMaisCaros: Array<{ cardId: string; titulo: string; tokens: number }>
  mediaPorCard: number | null
  ultimosDias: Array<{ dia: string; tokens: number }>
  resumo: string
}

export function resumoDeCusto(tetos: Tetos, estado: FabricaEstado = lerEstado(), agora: Date = new Date()): ResumoDeCusto {
  const hoje = diaDe(agora)
  const doDia = (estado.gastos ?? []).filter((g) => g.em.slice(0, 10) === hoje)
  const tokens = doDia.reduce((n, g) => n + g.tokens, 0)
  const porOrigem = new Map<string, number>()
  for (const g of doDia) porOrigem.set(g.origem, (porOrigem.get(g.origem) ?? 0) + g.tokens)
  const comUso = Object.values(estado.runs).filter((r) => r.uso)
  const total = (r: (typeof comUso)[number]) => (r.uso?.entrada ?? 0) + (r.uso?.saida ?? 0)
  const dias = new Map<string, number>()
  for (const g of estado.gastos ?? []) dias.set(g.em.slice(0, 10), (dias.get(g.em.slice(0, 10)) ?? 0) + g.tokens)
  const restante = tetos.dia > 0 ? Math.max(0, tetos.dia - tokens) : null
  return {
    tetos,
    hoje: { tokens, restante, porOrigem: [...porOrigem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([origem, t]) => ({ origem, tokens: t })) },
    cardsMaisCaros: [...comUso].sort((a, b) => total(b) - total(a)).slice(0, 5).map((r) => ({ cardId: r.card.id, titulo: r.card.titulo, tokens: total(r) })),
    mediaPorCard: comUso.length ? Math.round(comUso.reduce((n, r) => n + total(r), 0) / comUso.length) : null,
    ultimosDias: [...dias.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7).map(([dia, t]) => ({ dia, tokens: t })),
    resumo: `Hoje (UTC): ${tokens.toLocaleString('pt-BR')} tokens${tetos.dia > 0 ? ` de ${tetos.dia.toLocaleString('pt-BR')} (restam ${restante!.toLocaleString('pt-BR')})` : ' (sem teto do dia)'}. Teto por card: ${tetos.card > 0 ? tetos.card.toLocaleString('pt-BR') : 'sem teto'}; por onda: ${tetos.onda > 0 ? tetos.onda.toLocaleString('pt-BR') : 'sem teto'}.`,
  }
}
