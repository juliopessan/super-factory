// O que aconteceu com os PRs da Factory depois de abertos: a pessoa mesclou como veio, ajustou ou recusou? E o que as
// pessoas escreveram nas revisões? Só GET. É o sinal mais honesto de que o time acerta, e a matéria-prima das regras novas.

import { cliente, type GithubDeps } from './github.ts'
import { dividirRepositorio } from './guards.ts'
import type { ComentarioHumano } from './regras.ts'
import { limparTexto } from './revisao.ts'
import { buscarComRetry } from './retry.ts'
import type { Estado } from './schemas.ts'
import { persistir } from './store.ts'

export type DesfechoDoPr = 'aceito' | 'ajustado' | 'recusado' | 'aberto'
export type SinalDoPr = { numero: number; resultado: DesfechoDoPr; motivo: string; commitsHumanos: number; mudancasPedidas: number }
export type ResultadoDaLeitura<T> = { ok: boolean; dado: T | null; nota: string }

const AUTOR_DA_FACTORY = 'Super Factory'
const MARCA_DA_REVISAO = 'Revisão automática da Super Factory'

type Remoto = NonNullable<ReturnType<typeof cliente>>

async function pegar(url: string, remoto: Remoto): Promise<{ status: number; corpo: unknown }> {
  if (!url.startsWith('https://api.github.com/')) throw new Error('Host do GitHub recusado.')
  const headers = new Headers({ Authorization: `Bearer ${remoto.token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'sdlc-factory', 'X-GitHub-Api-Version': '2022-11-28' })
  const r = await buscarComRetry(() => remoto.fetch(url, { headers, signal: AbortSignal.timeout(8000) }), 'GET', { esperar: remoto.esperar })
  const t = await r.text()
  try {
    return { status: r.status, corpo: t ? JSON.parse(t) : null }
  } catch {
    return { status: r.status, corpo: null }
  }
}

const lista = (c: unknown): Array<Record<string, unknown>> => (Array.isArray(c) ? (c as Array<Record<string, unknown>>) : [])

function preparar(repositorio: string, deps?: GithubDeps): { remoto: Remoto; base: string } | { erro: string } {
  let r: { owner: string; name: string }
  try {
    r = dividirRepositorio(repositorio)
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Repositório inválido.' }
  }
  const remoto = cliente(deps)
  if (!remoto) return { erro: 'Sem GITHUB_TOKEN: nada foi lido no GitHub.' }
  return { remoto, base: `https://api.github.com/repos/${r.owner}/${r.name}` }
}

/** Decide o desfecho pelo que o GitHub mostra: estado, commits de pessoas e pedidos de mudança. */
export function classificarPr(e: { mesclado: boolean; estado: string; commitsHumanos: number; mudancasPedidas: number }): { resultado: DesfechoDoPr; motivo: string } {
  if (e.mesclado) {
    if (e.commitsHumanos > 0 || e.mudancasPedidas > 0) {
      const partes = [e.commitsHumanos ? `${e.commitsHumanos} commit(s) de pessoas` : '', e.mudancasPedidas ? `${e.mudancasPedidas} pedido(s) de mudança` : ''].filter(Boolean)
      return { resultado: 'ajustado', motivo: `Mesclado depois de ${partes.join(' e ')}.` }
    }
    return { resultado: 'aceito', motivo: 'Mesclado como a Factory entregou.' }
  }
  if (e.estado === 'closed') return { resultado: 'recusado', motivo: 'Fechado sem mesclar.' }
  return { resultado: 'aberto', motivo: 'Ainda aberto.' }
}

export async function lerSinalDoPr(repositorio: string, numero: number, deps?: GithubDeps): Promise<ResultadoDaLeitura<SinalDoPr>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  if (!Number.isInteger(numero) || numero < 1) return falha('Número de pull request inválido.')
  try {
    const pr = await pegar(`${p.base}/pulls/${numero}`, p.remoto)
    if (pr.status !== 200) return falha(`Não consegui ler o PR #${numero} (${pr.status}).`)
    const dados = pr.corpo as { merged_at?: string | null; state?: string }
    const commits = await pegar(`${p.base}/pulls/${numero}/commits?per_page=100`, p.remoto)
    const humanos = lista(commits.corpo).filter((c) => ((c.commit as { author?: { name?: string } } | undefined)?.author?.name ?? '') !== AUTOR_DA_FACTORY).length
    const reviews = await pegar(`${p.base}/pulls/${numero}/reviews?per_page=100`, p.remoto)
    const pedidos = lista(reviews.corpo).filter((r) => r.state === 'CHANGES_REQUESTED').length
    const c = classificarPr({ mesclado: Boolean(dados.merged_at), estado: String(dados.state ?? ''), commitsHumanos: humanos, mudancasPedidas: pedidos })
    return { ok: true, dado: { numero, ...c, commitsHumanos: humanos, mudancasPedidas: pedidos }, nota: `PR #${numero}: ${c.resultado}. ${c.motivo}` }
  } catch (e) {
    return falha(e instanceof Error ? e.message : 'Falha ao ler o PR.')
  }
}

/** Comentários de pessoas num PR (revisões, comentários no código e na conversa). Bots e a revisão automática ficam de fora. */
export async function lerComentariosHumanos(repositorio: string, numero: number, deps?: GithubDeps): Promise<ResultadoDaLeitura<ComentarioHumano[]>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  try {
    const [codigo, conversa, reviews] = await Promise.all([
      pegar(`${p.base}/pulls/${numero}/comments?per_page=100`, p.remoto),
      pegar(`${p.base}/issues/${numero}/comments?per_page=100`, p.remoto),
      pegar(`${p.base}/pulls/${numero}/reviews?per_page=100`, p.remoto),
    ])
    const saida: ComentarioHumano[] = []
    for (const c of [...lista(codigo.corpo), ...lista(conversa.corpo), ...lista(reviews.corpo)]) {
      const corpo = String(c.body ?? '')
      const tipo = (c.user as { type?: string } | null)?.type
      if (!corpo.trim() || tipo === 'Bot' || corpo.includes(MARCA_DA_REVISAO)) continue
      saida.push({ pr: numero, texto: limparTexto(corpo, 400), arquivo: typeof c.path === 'string' ? c.path : null })
    }
    return { ok: true, dado: saida, nota: `${saida.length} comentário(s) de pessoas no PR #${numero}.` }
  } catch (e) {
    return falha(e instanceof Error ? e.message : 'Falha ao ler os comentários.')
  }
}

function numeroDoPr(url: string | null | undefined): number | null {
  const n = Number(/\/pull\/(\d+)\b/.exec(url ?? '')?.[1])
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Mede o resultado de cada PR entregue que ainda não foi medido (ou que ainda estava aberto) e guarda no card. */
export async function medirResultadosDosPrs(runs: Record<string, Estado>, deps?: GithubDeps, gravar: (e: Estado) => void = (e) => void persistir(e)): Promise<{ medidos: number; mudaram: number; notas: string[] }> {
  let medidos = 0
  let mudaram = 0
  const notas: string[] = []
  for (const run of Object.values(runs)) {
    const numero = numeroDoPr(run.entrega?.pullRequestUrl)
    if (!numero || run.card.provedor !== 'github' || (run.resultadoPr && run.resultadoPr.resultado !== 'aberto')) continue
    const leitura = await lerSinalDoPr(run.card.repositorio, numero, deps)
    if (!leitura.ok || !leitura.dado) {
      notas.push(`${run.card.id}: ${leitura.nota}`)
      continue
    }
    medidos++
    if (leitura.dado.resultado !== run.resultadoPr?.resultado) mudaram++
    gravar({ ...run, resultadoPr: { resultado: leitura.dado.resultado, motivo: leitura.dado.motivo, commitsHumanos: leitura.dado.commitsHumanos, mudancasPedidas: leitura.dado.mudancasPedidas, medidoEm: new Date().toISOString() } })
  }
  return { medidos, mudaram, notas }
}
