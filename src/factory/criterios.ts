// Resultado por critério de aceite: PASS, FAIL, NOT_RUN ou BLOCKED, cada um com a evidência que o sandbox observou.
// Os testes do repositório não dizem qual critério cobrem. O construtor aponta (relato), e a Factory confere o que dá para
// conferir: o arquivo de teste citado está no diff? a suíte rodou e passou? (em bug) o teste novo falha sem a correção?
// Por isso PASS aqui quer dizer "teste apontado existe no diff e a suíte passou", e a evidência diz exatamente isso.
// Um teste que cobre o critério de verdade ainda é julgamento da revisão humana.

import type { Estado } from './schemas.ts'
import { caminhoDeArquivoSeguro } from './verificacao.ts'

type Check = Estado['checks'][number]

// Cinco estados, como na auditoria de conformidade da Fábrica: conforme (PASS), não conforme (FAIL), não medido (NOT_RUN e BLOCKED),
// não se aplica (N_A) e decidido diferente (DECIDIDO). Os dois últimos só nascem da decisão de uma pessoa (pedido de decisão
// respondido), aplicada na hora de ler: o sandbox mede só os quatro primeiros, e o construtor só PROPÕE "não se aplica".
export type StatusMedido = 'PASS' | 'FAIL' | 'NOT_RUN' | 'BLOCKED'
export type StatusDoCriterio = StatusMedido | 'N_A' | 'DECIDIDO'
export type CriterioMedido = { n: number; texto: string; status: StatusMedido; testes: string[]; evidencia: string }
export type ResultadoDoCriterio = { n: number; texto: string; status: StatusDoCriterio; testes: string[]; evidencia: string; decisaoId?: string }
export type PropostaDoConstrutor = { tipo: 'nao-se-aplica' | 'decidido-diferente'; motivo: string }
export type MapaDeCriterios = Array<{ n: number; testes: string[]; proposta?: PropostaDoConstrutor }>

/** Linhas "CRITERIO 2: tests/a.test.js, tests/b.test.js" no fim da resposta do construtor. "nenhum" e "-" valem lista vazia. */
export function lerMapaDeCriterios(texto: string): MapaDeCriterios {
  const mapa = new Map<number, string[]>()
  const propostas = new Map<number, PropostaDoConstrutor>()
  for (const linha of texto.split('\n')) {
    const m = /^\s*[-*]?\s*CRIT[ÉE]RIO\s+(\d{1,3})\s*[:=-]\s*(.+?)\s*$/i.exec(linha)
    if (!m) continue
    // "CRITERIO 2: não se aplica - motivo" é uma PROPOSTA: só vale com a decisão de uma pessoa.
    const p = /^(n[aã]o se aplica|decidido diferente)\s*(?:[:\-–—]\s*(.*))?$/i.exec(m[2]!)
    if (p) {
      propostas.set(Number(m[1]), { tipo: /^n/i.test(p[1]!) ? 'nao-se-aplica' : 'decidido-diferente', motivo: (p[2] ?? '').replace(/[`'"]/g, '').trim().slice(0, 200) })
      if (!mapa.has(Number(m[1]))) mapa.set(Number(m[1]), [])
      continue
    }
    const itens = /^(nenhum|nenhuma|-|n\/a|sem teste)\b/i.test(m[2]!) ? [] : m[2]!.split(/[,;]/).map((t) => t.replace(/[`'"]/g, '').replace(/^\.\//, '').trim()).filter((t) => caminhoDeArquivoSeguro(t))
    mapa.set(Number(m[1]), [...new Set([...(mapa.get(Number(m[1])) ?? []), ...itens])].slice(0, 8))
  }
  return [...mapa.entries()].sort((a, b) => a[0] - b[0]).map(([n, testes]) => ({ n, testes, ...(propostas.has(n) ? { proposta: propostas.get(n)! } : {}) }))
}

const no = (arquivos: string[], teste: string) => arquivos.some((a) => a === teste || a.endsWith(`/${teste}`))

export function resultadoPorCriterio(entrada: { criterios: string[]; mapa: MapaDeCriterios | null; arquivosMudados: string[]; checks: Check[]; parado: boolean; motivo: string | null }): CriterioMedido[] {
  const get = (nome: string) => entrada.checks.find((c) => c.nome === nome)
  const suite = get('testes-no-sandbox')
  const vv = get('vermelho-verde')
  return entrada.criterios.map((texto, i) => {
    const n = i + 1
    const feito = (status: StatusMedido, evidencia: string, testes: string[] = []): CriterioMedido => ({ n, texto, status, testes, evidencia })
    if (entrada.parado && (!suite || suite.resultado === 'NOT_RUN')) return feito('BLOCKED', `A execução parou antes dos testes${entrada.motivo ? `: ${entrada.motivo.slice(0, 240)}` : '.'}`)
    if (!suite || suite.resultado === 'NOT_RUN') return feito('NOT_RUN', 'Os testes do repositório não rodaram.')
    if (suite.resultado === 'BLOCKED') return feito('BLOCKED', `Os testes ficaram BLOCKED: ${suite.evidencia.slice(0, 240)}`)
    if (!entrada.mapa) return feito('NOT_RUN', 'O implementador não informou qual teste cobre este critério.')
    const doMapa = entrada.mapa.find((m) => m.n === n)
    const citados = doMapa?.testes ?? []
    if (citados.length === 0 && doMapa?.proposta) return feito('NOT_RUN', `O construtor propôs "${doMapa.proposta.tipo === 'nao-se-aplica' ? 'não se aplica' : 'decidido diferente'}"${doMapa.proposta.motivo ? ` (${doMapa.proposta.motivo})` : ''}, mas isso só vale com a decisão de uma pessoa: o critério segue sem resultado até lá (pedirDecisaoDeCriterio).`)
    if (citados.length === 0) return feito('NOT_RUN', 'O construtor não apontou nenhum teste para este critério.')
    const confirmados = citados.filter((t) => no(entrada.arquivosMudados, t))
    if (confirmados.length === 0) return feito('NOT_RUN', `O teste apontado (${citados.join(', ')}) não está no diff: o mapeamento não foi confirmado.`, citados)
    if (suite.resultado === 'FAIL') return feito('FAIL', `A suíte (${suite.comando ?? 'testes'}) falhou; testes apontados para este critério: ${confirmados.join(', ')}.`, confirmados)
    if (vv?.resultado === 'FAIL') return feito('FAIL', `O teste novo (${confirmados.join(', ')}) passa mesmo sem a correção, então não prova este critério.`, confirmados)
    return feito('PASS', `Teste apontado no diff: ${confirmados.join(', ')}. A suíte (${suite.comando ?? 'testes'}) passou${vv?.resultado === 'PASS' ? ' e o teste novo falha sem a correção (vermelho→verde)' : ''}. Cobertura declarada pelo construtor: a revisão humana confirma se o teste prova o critério.`, confirmados)
  })
}

/** Aplica as decisões de uma pessoa sobre critérios: o resultado medido vira N_A ou DECIDIDO, com quem decidiu e por quê. */
export function aplicarDecisoes(criterios: ResultadoDoCriterio[], decisoes: Array<{ n: number; efeito: 'nao-se-aplica' | 'decidido-diferente'; motivo: string; decisaoId: string; por: string }>): ResultadoDoCriterio[] {
  if (decisoes.length === 0) return criterios
  return criterios.map((c) => {
    const d = decisoes.find((x) => x.n === c.n)
    if (!d) return c
    const rotulo = d.efeito === 'nao-se-aplica' ? 'Não se aplica' : 'Decidido diferente'
    return { ...c, status: d.efeito === 'nao-se-aplica' ? 'N_A' : 'DECIDIDO', decisaoId: d.decisaoId, evidencia: `${rotulo}, por decisão de ${d.por} (${d.decisaoId}): ${d.motivo.replace(/[\s.;:,]+$/, '')}. Resultado medido antes da decisão: ${c.status}.`.slice(0, 600) }
  })
}

export function contagemDosCriterios(r: Array<{ status: StatusDoCriterio }>): string {
  const por = (s: StatusDoCriterio) => r.filter((x) => x.status === s).length
  return (['PASS', 'FAIL', 'NOT_RUN', 'BLOCKED', 'N_A', 'DECIDIDO'] as const).filter((s) => por(s) > 0).map((s) => `${por(s)} ${s}`).join(', ') || 'sem critérios'
}
