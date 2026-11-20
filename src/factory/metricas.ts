// Métricas de entrega: o que dá para medir com o que a Factory já guarda (execuções e trilha com horário).
// Tokens vêm do agente construtor; dinheiro não é calculado, porque o preço depende do modelo e do contrato.

import type { Estado } from './schemas.ts'

export type Metricas = {
  execucoes: number
  /** Execuções que abriram pull request (entrega ok com endereço). */
  pullRequests: number
  /** Parte das execuções que chegou a um PR com testes verdes, de 0 a 1. Null sem execução. */
  taxaDeEntrega: number | null
  /** Mediana, em minutos, do primeiro ao último evento da trilha das execuções entregues. */
  tempoMedianoMin: number | null
  bloqueadas: number
  testesVerdes: number
  tokens: { entrada: number; saida: number; porCard: number | null }
  ultimos7Dias: number
}

function minutos(estado: Estado): number | null {
  const tempos = estado.trilha.map((e) => Date.parse(e.em)).filter((t) => Number.isFinite(t))
  if (tempos.length < 2) return null
  return (Math.max(...tempos) - Math.min(...tempos)) / 60_000
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const o = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(o.length / 2)
  return o.length % 2 ? (o[meio] ?? null) : ((o[meio - 1] ?? 0) + (o[meio] ?? 0)) / 2
}

export function calcularMetricas(runs: Record<string, Estado>, agora = Date.now()): Metricas {
  const lista = Object.values(runs)
  const entregues = lista.filter((r) => r.entrega?.ok && r.entrega.pullRequestUrl)
  const verdes = lista.filter((r) => r.checks.some((c) => c.nome === 'testes-no-sandbox' && c.resultado === 'PASS'))
  const comUso = lista.filter((r) => r.uso)
  const entrada = comUso.reduce((n, r) => n + (r.uso?.entrada ?? 0), 0)
  const saida = comUso.reduce((n, r) => n + (r.uso?.saida ?? 0), 0)
  const semana = agora - 7 * 86_400_000
  const arredonda = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10)
  return {
    execucoes: lista.length,
    pullRequests: entregues.length,
    taxaDeEntrega: lista.length ? Math.round((entregues.length / lista.length) * 100) / 100 : null,
    tempoMedianoMin: arredonda(mediana(entregues.map(minutos).filter((m): m is number => m !== null))),
    bloqueadas: lista.filter((r) => r.desfecho === 'bloqueado').length,
    testesVerdes: verdes.length,
    tokens: { entrada, saida, porCard: comUso.length ? Math.round((entrada + saida) / comUso.length) : null },
    ultimos7Dias: lista.filter((r) => Date.parse(r.atualizadoEm) >= semana).length,
  }
}
