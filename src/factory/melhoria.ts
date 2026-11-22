// Melhoria recursiva, na versão fraca (com gente no circuito): o Worker faz, um Improver olha o resultado, propõe uma mudança
// de abordagem, o Worker refaz, e a Factory só adota o novo resultado se ele for MELHOR de verdade.
// "Melhor" não é opinião de modelo: é uma pontuação calculada só do que o sandbox observou (testes, lint, vermelho→verde,
// resultado por critério, auditoria do construtor). Teste que deixa de passar nunca é melhoria.
// O que isto NÃO faz: mudar regra de segurança, aprovar, mesclar ou se auto-promover. Mudança no jeito de trabalhar
// (lições) só entra depois que uma pessoa aprova (ver licoes.ts).

import type { Estado } from './schemas.ts'

type Check = Estado['checks'][number]
export type EstadoPontuavel = Pick<Estado, 'checks' | 'criterios' | 'achados'>

export type Pontuacao = { pontos: number; detalhes: string[] }

const PESO = { testes: 40, vermelhoVerde: 15, criterios: 30, extra: 5, app: 5, ancoragem: 3 } as const

/** Pontuação de uma tentativa, de −∞ a 100, só de evidência observada. Mais é melhor. */
export function pontuarTentativa(e: EstadoPontuavel): Pontuacao {
  const get = (nome: string): Check | undefined => e.checks.find((c) => c.nome === nome)
  let pontos = 0
  const detalhes: string[] = []
  const soma = (n: number, porque: string) => {
    pontos += n
    detalhes.push(`${n >= 0 ? '+' : ''}${n} ${porque}`)
  }
  if (get('testes-no-sandbox')?.resultado === 'PASS') soma(PESO.testes, 'testes passam')
  for (const nome of ['lint', 'typecheck', 'build']) {
    const r = get(nome)?.resultado
    if (r === 'PASS') soma(PESO.extra, `${nome} passa`)
    else if (r === 'FAIL' && get(`baseline:${nome}`)?.resultado !== 'FAIL') soma(-PESO.extra * 2, `${nome} falha (e não falhava antes)`)
  }
  const vv = get('vermelho-verde')?.resultado
  if (vv === 'PASS') soma(PESO.vermelhoVerde, 'o teste novo falha sem a correção')
  else if (vv === 'FAIL') soma(-PESO.vermelhoVerde, 'o teste novo passa sem a correção')
  const app = get('app-no-navegador')?.resultado
  if (app === 'PASS') soma(PESO.app, 'o app abre sem erro')
  else if (app === 'FAIL' && get('baseline:app')?.resultado === 'PASS') soma(-PESO.app * 2, 'o app deixou de abrir')
  const crit = e.criterios ?? []
  if (crit.length) {
    const ok = crit.filter((c) => c.status === 'PASS').length
    const falha = crit.filter((c) => c.status === 'FAIL').length
    if (ok) soma(Math.round((PESO.criterios * ok) / crit.length), `${ok} de ${crit.length} critérios com teste apontado e suíte verde`)
    if (falha) soma(-Math.round((PESO.criterios * falha) / crit.length), `${falha} critério(s) FAIL`)
  }
  const anc = Math.min(3, e.achados.filter((a) => a.id.startsWith('ANC-')).length)
  if (anc) soma(-PESO.ancoragem * anc, `${anc} nota(s) de ancoragem do construtor`)
  return { pontos, detalhes }
}

export type Fraqueza = { id: string; texto: string }

/** O que dá para melhorar numa nova tentativa, a partir da evidência: critério sem teste, bug sem prova, lint que regrediu. */
export function fraquezasDaTentativa(e: EstadoPontuavel & Pick<Estado, 'card'>): Fraqueza[] {
  const saida: Fraqueza[] = []
  for (const c of e.criterios ?? []) {
    if (c.status === 'NOT_RUN' && /não apontou nenhum teste|não está no diff|não informou/.test(c.evidencia)) saida.push({ id: `criterio-${c.n}`, texto: `Critério ${c.n} ("${c.texto.slice(0, 120)}") ficou sem prova: ${c.evidencia}` })
    if (c.status === 'FAIL') saida.push({ id: `criterio-${c.n}`, texto: `Critério ${c.n} ("${c.texto.slice(0, 120)}") falhou: ${c.evidencia}` })
  }
  const vv = e.checks.find((c) => c.nome === 'vermelho-verde')
  if (e.card.rota === 'bug' && vv && vv.resultado !== 'PASS') saida.push({ id: 'vermelho-verde', texto: `Card de bug sem prova de reprodução: ${vv.evidencia.slice(0, 200)}` })
  for (const nome of ['lint', 'typecheck', 'build']) {
    const c = e.checks.find((x) => x.nome === nome)
    if (c?.resultado === 'FAIL' && e.checks.find((x) => x.nome === `baseline:${nome}`)?.resultado !== 'FAIL') saida.push({ id: nome, texto: `${nome} falha e não falhava antes da mudança: ${c.evidencia.slice(0, 200)}` })
  }
  return saida
}

/** A nova tentativa só vale se os testes seguem verdes e a pontuação subiu de fato (estritamente). */
export function melhorou(antes: Pontuacao, depois: Pontuacao, testesDepois: Check['resultado'] | undefined): boolean {
  return testesDepois === 'PASS' && depois.pontos > antes.pontos
}

export type Melhorador = (contexto: {
  estado: Estado
  fraquezas: Fraqueza[]
  /** O que o construtor disse que fez na última tentativa (relato, não prova). */
  resumo: string
  pontuacao: Pontuacao
}) => Promise<{ proposta: string; uso?: { entrada: number; saida: number } }>

export type ConfigDeMelhoria = { rodadas: number }

export function lerConfigDeMelhoria(env: Record<string, string | undefined> = process.env): ConfigDeMelhoria | null {
  if (!['1', 'sim', 'true'].includes(env.SUPER_FACTORY_MELHORIA?.trim().toLowerCase() ?? '')) return null
  const n = Number(env.SUPER_FACTORY_MELHORIA_RODADAS)
  return { rodadas: Number.isInteger(n) && n >= 1 ? Math.min(n, 2) : 1 }
}
