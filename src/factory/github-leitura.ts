// Leitura do GitHub para a gestão: issues com corpo e comentários, busca com filtros, pull requests, milestones,
// checks do CI (com o passo que falhou e o fim do log), proteção de branch, alertas de segurança e o diagnóstico do token.
// Só GET. Tudo o que vem de fora (corpo, comentário, título, log) é dado de terceiros: segredo sai redigido e @menção
// é neutralizada antes de chegar a um agente.

import { cliente, type GithubDeps } from './github.ts'
import { dividirRepositorio, semSegredo, validarBranch } from './guards.ts'
import { limparTexto } from './revisao.ts'
import { buscarComRetry, type Esperar } from './retry.ts'

type Remoto = { fetch: typeof fetch; token: string; esperar?: Esperar }
type Resposta = { status: number; corpo: unknown; cabecalhos: Headers }

const MAXIMO_POR_PAGINA = 30
const SEM_TOKEN = 'Sem GITHUB_TOKEN: nada foi lido no GitHub.'

/** GET com repetição em falha transitória. Não lança em 4xx: devolve o status para cada leitura decidir. */
async function ler(url: string, remoto: Remoto): Promise<Resposta> {
  if (!url.startsWith('https://api.github.com/')) throw new Error('Host do GitHub recusado.')
  const cabecalhos = new Headers({ Authorization: `Bearer ${remoto.token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'sdlc-factory', 'X-GitHub-Api-Version': '2022-11-28' })
  let resposta: Response
  try {
    resposta = await buscarComRetry(() => remoto.fetch(url, { headers: cabecalhos, signal: AbortSignal.timeout(8000) }), 'GET', { esperar: remoto.esperar })
  } catch {
    throw new Error('Tempo esgotado ao falar com o GitHub.')
  }
  const texto = await resposta.text()
  let corpo: unknown = null
  try {
    corpo = texto ? JSON.parse(texto) : null
  } catch {
    corpo = texto
  }
  return { status: resposta.status, corpo, cabecalhos: resposta.headers }
}

function mensagemDe(corpo: unknown): string {
  const m = (corpo as { message?: unknown } | null)?.message
  return typeof m === 'string' ? m : ''
}

/** Erro do GitHub em português, dizendo qual permissão do token resolve. */
function falhaDoGithub(r: Resposta, token: string, o_que: string, permissao: string): string {
  const detalhe = semSegredo(mensagemDe(r.corpo), [token]).slice(0, 160)
  if (r.status === 401) return `O GitHub recusou o token (401). Confira o GITHUB_TOKEN em Chaves e acessos.`
  if (r.status === 403 || r.status === 404) return `Não consegui ler ${o_que} (${r.status}${detalhe ? `: ${detalhe}` : ''}). Confira o nome e se o token enxerga isso: ${permissao}.`
  return `O GitHub respondeu ${r.status} ao ler ${o_que}.${detalhe ? ` ${detalhe}` : ''}`
}

function alvo(repositorio: string): { owner: string; name: string } {
  return dividirRepositorio(repositorio)
}

function lista<T = Record<string, unknown>>(corpo: unknown): T[] {
  return Array.isArray(corpo) ? (corpo as T[]) : []
}

function pagina(entrada: number | undefined): number {
  return Math.min(Math.max(Math.trunc(entrada ?? 1) || 1, 1), 50)
}

function porPagina(entrada: number | undefined): number {
  return Math.min(Math.max(Math.trunc(entrada ?? 15) || 15, 1), MAXIMO_POR_PAGINA)
}

const texto = (valor: unknown, maximo: number) => limparTexto(String(valor ?? ''), maximo)
const login = (u: unknown) => texto((u as { login?: string } | null)?.login ?? '', 40)

type Preparado = { remoto: Remoto; owner: string; name: string } | { erro: string }
function preparar(repositorio: string, deps?: GithubDeps): Preparado {
  let r: { owner: string; name: string }
  try {
    r = alvo(repositorio)
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Repositório inválido.' }
  }
  const remoto = cliente(deps)
  if (!remoto) return { erro: SEM_TOKEN }
  return { remoto, ...r }
}
const base = (p: { owner: string; name: string }) => `https://api.github.com/repos/${p.owner}/${p.name}`

// ---------- issues ----------

export type IssueLida = {
  numero: number
  titulo: string
  estado: string
  motivo: string | null
  ehPullRequest: boolean
  autor: string
  criadaEm: string | null
  atualizadaEm: string | null
  fechadaEm: string | null
  labels: string[]
  milestone: { numero: number; titulo: string } | null
  responsaveis: string[]
  url: string | null
  corpo: string
  comentarios: Array<{ autor: string; em: string | null; texto: string }>
  totalDeComentarios: number
}

export type ResultadoDaLeitura<T> = { ok: boolean; dado: T | null; nota: string }

const COMENTARIOS_POR_PAGINA = 30

/** Uma issue inteira: corpo, labels, milestone, responsáveis e os comentários mais recentes. */
export async function lerIssueGithub(repositorio: string, numero: number, deps?: GithubDeps): Promise<ResultadoDaLeitura<IssueLida>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  if (!Number.isInteger(numero) || numero < 1 || numero > 9_999_999) return falha('Número de issue inválido.')
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  try {
    const r = await ler(`${base(p)}/issues/${numero}`, p.remoto)
    if (r.status !== 200) return falha(falhaDoGithub(r, p.remoto.token, `a issue #${numero}`, 'leitura de Issues no repositório'))
    const i = r.corpo as Record<string, unknown>
    const total = Number(i.comments) || 0
    let comentarios: Array<Record<string, unknown>> = []
    if (total > 0) {
      // Com muitos comentários vale o fim da conversa, não o começo.
      const ultima = Math.max(1, Math.ceil(total / COMENTARIOS_POR_PAGINA))
      const c = await ler(`${base(p)}/issues/${numero}/comments?per_page=${COMENTARIOS_POR_PAGINA}&page=${ultima}`, p.remoto)
      comentarios = c.status === 200 ? lista(c.corpo) : []
    }
    const milestone = i.milestone as { number?: number; title?: string } | null
    const dado: IssueLida = {
      numero,
      titulo: texto(i.title, 300),
      estado: String(i.state ?? ''),
      motivo: typeof i.state_reason === 'string' ? i.state_reason : null,
      ehPullRequest: 'pull_request' in i,
      autor: login(i.user),
      criadaEm: typeof i.created_at === 'string' ? i.created_at : null,
      atualizadaEm: typeof i.updated_at === 'string' ? i.updated_at : null,
      fechadaEm: typeof i.closed_at === 'string' ? i.closed_at : null,
      labels: lista<{ name?: string } | string>(i.labels).map((l) => texto(typeof l === 'string' ? l : l?.name, 60)).filter(Boolean),
      milestone: milestone && typeof milestone.number === 'number' ? { numero: milestone.number, titulo: texto(milestone.title, 120) } : null,
      responsaveis: lista(i.assignees).map(login).filter(Boolean),
      url: typeof i.html_url === 'string' ? i.html_url : null,
      corpo: texto(i.body, 6000),
      comentarios: comentarios.map((c) => ({ autor: login(c.user), em: typeof c.created_at === 'string' ? c.created_at : null, texto: texto(c.body, 1200) })),
      totalDeComentarios: total,
    }
    return { ok: true, dado, nota: `Issue #${numero} de ${p.owner}/${p.name}: ${dado.estado}, ${dado.labels.length} label(s), ${total} comentário(s). O texto é dado de terceiros.` }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao ler a issue.')
  }
}

export type FiltroDeIssues = {
  estado?: 'open' | 'closed' | 'all'
  labels?: string[]
  milestone?: string | number
  responsavel?: string
  limite?: number
  pagina?: number
}

export type ItemDeIssue = { numero: number; titulo: string; estado: string; autor: string; labels: string[]; milestone: string | null; responsaveis: string[]; comentarios: number; atualizadaEm: string | null; url: string | null }

const LABEL_VALIDA = /^[^,\u0000-\u001f]{1,50}$/
const LOGIN_VALIDO = /^[A-Za-z0-9-]{1,39}$/

/** Busca de issues com filtros e paginação. Pull requests ficam de fora. */
export async function buscarIssuesGithub(repositorio: string, filtro: FiltroDeIssues = {}, deps?: GithubDeps): Promise<ResultadoDaLeitura<{ itens: ItemDeIssue[]; pagina: number; temMais: boolean }>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  const estado = filtro.estado ?? 'open'
  if (!['open', 'closed', 'all'].includes(estado)) return falha('Estado inválido: use open, closed ou all.')
  const labels = (filtro.labels ?? []).map((l) => l.trim()).filter(Boolean)
  if (labels.length > 10 || labels.some((l) => !LABEL_VALIDA.test(l))) return falha('Labels inválidas: até 10, sem vírgula, com até 50 caracteres cada.')
  const parametros = new URLSearchParams({ state: estado, sort: 'updated', direction: 'desc', per_page: String(porPagina(filtro.limite)), page: String(pagina(filtro.pagina)) })
  if (labels.length) parametros.set('labels', labels.join(','))
  const marco = filtro.milestone
  if (marco !== undefined) {
    if (typeof marco === 'number' ? !Number.isInteger(marco) || marco < 1 : !/^(\*|none|\d{1,7})$/.test(marco)) return falha('Milestone inválido: use o número, "none" ou "*".')
    parametros.set('milestone', String(marco))
  }
  try {
    let responsavel = filtro.responsavel?.trim()
    if (responsavel) {
      if (/^(@me|me|eu)$/i.test(responsavel)) {
        const quem = await ler('https://api.github.com/user', p.remoto)
        const eu = (quem.corpo as { login?: string } | null)?.login
        if (quem.status !== 200 || !eu || !LOGIN_VALIDO.test(eu)) return falha('Não consegui descobrir de quem é o token (GET /user). Informe o login.')
        responsavel = eu
      } else if (responsavel !== '*' && responsavel !== 'none' && !LOGIN_VALIDO.test(responsavel.replace(/^@/, ''))) {
        return falha('Responsável inválido: use o login, "@me", "none" ou "*".')
      }
      parametros.set('assignee', responsavel.replace(/^@(?!me$)/, ''))
    }
    const r = await ler(`${base(p)}/issues?${parametros}`, p.remoto)
    if (r.status !== 200) return falha(falhaDoGithub(r, p.remoto.token, 'as issues', 'leitura de Issues no repositório'))
    const bruto = lista(r.corpo)
    const itens = bruto
      .filter((i) => !('pull_request' in i))
      .map((i): ItemDeIssue => ({
        numero: Number(i.number),
        titulo: texto(i.title, 200),
        estado: String(i.state ?? ''),
        autor: login(i.user),
        labels: lista<{ name?: string } | string>(i.labels).map((l) => texto(typeof l === 'string' ? l : l?.name, 60)).filter(Boolean),
        milestone: (i.milestone as { title?: string } | null)?.title ? texto((i.milestone as { title: string }).title, 120) : null,
        responsaveis: lista(i.assignees).map(login).filter(Boolean),
        comentarios: Number(i.comments) || 0,
        atualizadaEm: typeof i.updated_at === 'string' ? i.updated_at : null,
        url: typeof i.html_url === 'string' ? i.html_url : null,
      }))
    const temMais = bruto.length >= porPagina(filtro.limite)
    return { ok: true, dado: { itens, pagina: pagina(filtro.pagina), temMais }, nota: `${itens.length} issue(s) em ${p.owner}/${p.name}${temMais ? `; há mais: peça a página ${pagina(filtro.pagina) + 1}` : ''}. Pull requests ficam de fora.` }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao buscar issues.')
  }
}

// ---------- pull requests ----------

export type ItemDePr = { numero: number; titulo: string; rascunho: boolean; estado: string; mesclado: boolean; autor: string; head: string; base: string; labels: string[]; revisoresPedidos: string[]; atualizadoEm: string | null; url: string | null }

export async function listarPullRequestsGithub(
  repositorio: string,
  filtro: { estado?: 'open' | 'closed' | 'all'; base?: string; limite?: number; pagina?: number } = {},
  deps?: GithubDeps,
): Promise<ResultadoDaLeitura<{ itens: ItemDePr[]; pagina: number; temMais: boolean }>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  const estado = filtro.estado ?? 'open'
  if (!['open', 'closed', 'all'].includes(estado)) return falha('Estado inválido: use open, closed ou all.')
  const parametros = new URLSearchParams({ state: estado, sort: 'updated', direction: 'desc', per_page: String(porPagina(filtro.limite)), page: String(pagina(filtro.pagina)) })
  if (filtro.base) {
    try {
      parametros.set('base', validarBranch(filtro.base))
    } catch (erro) {
      return falha(erro instanceof Error ? erro.message : 'Branch inválida.')
    }
  }
  try {
    const r = await ler(`${base(p)}/pulls?${parametros}`, p.remoto)
    if (r.status !== 200) return falha(falhaDoGithub(r, p.remoto.token, 'os pull requests', 'leitura de Pull requests no repositório'))
    const bruto = lista(r.corpo)
    const itens = bruto.map((pr): ItemDePr => ({
      numero: Number(pr.number),
      titulo: texto(pr.title, 200),
      rascunho: Boolean(pr.draft),
      estado: String(pr.state ?? ''),
      mesclado: Boolean(pr.merged_at),
      autor: login(pr.user),
      head: texto((pr.head as { ref?: string } | null)?.ref, 120),
      base: texto((pr.base as { ref?: string } | null)?.ref, 120),
      labels: lista<{ name?: string }>(pr.labels).map((l) => texto(l?.name, 60)).filter(Boolean),
      revisoresPedidos: lista(pr.requested_reviewers).map(login).filter(Boolean),
      atualizadoEm: typeof pr.updated_at === 'string' ? pr.updated_at : null,
      url: typeof pr.html_url === 'string' ? pr.html_url : null,
    }))
    const temMais = bruto.length >= porPagina(filtro.limite)
    return { ok: true, dado: { itens, pagina: pagina(filtro.pagina), temMais }, nota: `${itens.length} pull request(s) ${estado === 'all' ? '' : estado === 'open' ? 'abertos ' : 'fechados '}em ${p.owner}/${p.name}${temMais ? `; há mais: peça a página ${pagina(filtro.pagina) + 1}` : ''}. Para o diff e a evidência, use lerPullRequestGithub.` }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao listar pull requests.')
  }
}

// ---------- milestones ----------

export type ItemDeMilestone = { numero: number; titulo: string; descricao: string; estado: string; venceEm: string | null; abertas: number; fechadas: number; progresso: number; url: string | null }

export async function listarMilestonesGithub(repositorio: string, estado: 'open' | 'closed' | 'all' = 'open', deps?: GithubDeps): Promise<ResultadoDaLeitura<{ itens: ItemDeMilestone[] }>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  if (!['open', 'closed', 'all'].includes(estado)) return falha('Estado inválido: use open, closed ou all.')
  try {
    const r = await ler(`${base(p)}/milestones?state=${estado}&sort=due_on&direction=asc&per_page=50`, p.remoto)
    if (r.status !== 200) return falha(falhaDoGithub(r, p.remoto.token, 'os milestones', 'leitura de Issues no repositório'))
    const itens = lista(r.corpo).map((m): ItemDeMilestone => {
      const abertas = Number(m.open_issues) || 0
      const fechadas = Number(m.closed_issues) || 0
      return {
        numero: Number(m.number),
        titulo: texto(m.title, 120),
        descricao: texto(m.description, 300),
        estado: String(m.state ?? ''),
        venceEm: typeof m.due_on === 'string' ? m.due_on : null,
        abertas,
        fechadas,
        progresso: abertas + fechadas === 0 ? 0 : Math.round((fechadas / (abertas + fechadas)) * 100),
        url: typeof m.html_url === 'string' ? m.html_url : null,
      }
    })
    return { ok: true, dado: { itens }, nota: `${itens.length} milestone(s) em ${p.owner}/${p.name}.` }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao listar milestones.')
  }
}

// ---------- checks do CI ----------

export type CheckLido = { nome: string; status: string; conclusao: string | null; url: string | null; resumo: string; passosQueFalharam: string[]; fimDoLog: string | null }

export type ChecksLidos = {
  ref: string
  sha: string
  estadoGeral: 'sucesso' | 'falha' | 'pendente' | 'sem-checks'
  checks: CheckLido[]
  statusLegado: Array<{ contexto: string; estado: string; url: string | null }>
}

const FALHOU = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'])
const MAXIMO_DE_LOGS = 3
const LINHAS_DE_LOG = 40
const BYTES_DE_LOG = 400_000
const HOSTS_DE_LOG = /(^|\.)(githubusercontent\.com|blob\.core\.windows\.net)$/i

/** Fim do log de um job do Actions. O GitHub responde com um redirecionamento: segue sem mandar o token e só para hosts conhecidos. */
async function fimDoLog(owner: string, name: string, jobId: number, remoto: Remoto): Promise<string | null> {
  try {
    const primeira = await remoto.fetch(`https://api.github.com/repos/${owner}/${name}/actions/jobs/${jobId}/logs`, {
      headers: { Authorization: `Bearer ${remoto.token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'sdlc-factory', 'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })
    let conteudo: Response | null = null
    if (primeira.status >= 300 && primeira.status < 400) {
      const destino = new URL(primeira.headers.get('location') ?? '')
      if (destino.protocol !== 'https:' || !HOSTS_DE_LOG.test(destino.hostname)) return null
      conteudo = await remoto.fetch(destino, { signal: AbortSignal.timeout(10_000) })
    } else if (primeira.status === 200) {
      conteudo = primeira
    }
    if (!conteudo || !conteudo.ok) return null
    const bruto = (await conteudo.text()).slice(-BYTES_DE_LOG)
    const linhas = bruto.replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, '')).filter((l) => l.trim())
    return texto(linhas.slice(-LINHAS_DE_LOG).join('\n'), 3500) || null
  } catch {
    return null
  }
}

/** O CI de uma branch, commit ou pull request: o que passou, o que falhou, em qual passo e o fim do log. */
export async function lerChecksGithub(repositorio: string, referencia: string | number, deps?: GithubDeps): Promise<ResultadoDaLeitura<ChecksLidos>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  const ref = String(referencia).trim()
  let sha = ref
  try {
    if (/^\d{1,7}$/.test(ref)) {
      const pr = await ler(`${base(p)}/pulls/${ref}`, p.remoto)
      if (pr.status !== 200) return falha(falhaDoGithub(pr, p.remoto.token, `o pull request #${ref}`, 'leitura de Pull requests no repositório'))
      sha = String((pr.corpo as { head?: { sha?: string } }).head?.sha ?? '')
      if (!/^[0-9a-f]{40}$/i.test(sha)) return falha('O GitHub não devolveu o commit do pull request.')
    } else if (!/^[0-9a-f]{7,40}$/i.test(ref)) {
      validarBranch(ref)
    }
    const alvoRef = encodeURIComponent(sha)
    const [runs, legado] = await Promise.all([ler(`${base(p)}/commits/${alvoRef}/check-runs?per_page=50`, p.remoto), ler(`${base(p)}/commits/${alvoRef}/status`, p.remoto)])
    if (runs.status !== 200) return falha(falhaDoGithub(runs, p.remoto.token, `os checks de ${ref}`, 'leitura de Checks e de Actions no repositório'))
    const execucoes = lista((runs.corpo as { check_runs?: unknown[] } | null)?.check_runs) as Array<Record<string, unknown>>
    const checks: CheckLido[] = []
    let logsLidos = 0
    for (const c of execucoes) {
      const conclusao = typeof c.conclusion === 'string' ? c.conclusion : null
      const item: CheckLido = {
        nome: texto(c.name, 120),
        status: String(c.status ?? ''),
        conclusao,
        url: typeof c.html_url === 'string' ? c.html_url : null,
        resumo: texto((c.output as { summary?: string } | null)?.summary ?? (c.output as { title?: string } | null)?.title ?? '', 400),
        passosQueFalharam: [],
        fimDoLog: null,
      }
      const doActions = (c.app as { slug?: string } | null)?.slug === 'github-actions' && typeof c.id === 'number'
      if (conclusao && FALHOU.has(conclusao) && doActions) {
        const job = await ler(`${base(p)}/actions/jobs/${c.id}`, p.remoto)
        if (job.status === 200) {
          item.passosQueFalharam = lista<{ name?: string; conclusion?: string }>((job.corpo as { steps?: unknown[] } | null)?.steps)
            .filter((s) => s.conclusion && FALHOU.has(s.conclusion))
            .map((s) => texto(s.name, 120))
        }
        if (logsLidos < MAXIMO_DE_LOGS) {
          logsLidos++
          item.fimDoLog = await fimDoLog(p.owner, p.name, c.id as number, p.remoto)
        }
      }
      checks.push(item)
    }
    const estadoLegado = lista((legado.status === 200 ? (legado.corpo as { statuses?: unknown[] }) : {}).statuses) as Array<Record<string, unknown>>
    const statusLegado = estadoLegado.map((s) => ({ contexto: texto(s.context, 120), estado: String(s.state ?? ''), url: typeof s.target_url === 'string' ? s.target_url : null }))
    const falhou = checks.some((c) => c.conclusao && FALHOU.has(c.conclusao)) || statusLegado.some((s) => s.estado === 'failure' || s.estado === 'error')
    const pendente = checks.some((c) => c.status !== 'completed') || statusLegado.some((s) => s.estado === 'pending')
    const estadoGeral: ChecksLidos['estadoGeral'] = checks.length + statusLegado.length === 0 ? 'sem-checks' : falhou ? 'falha' : pendente ? 'pendente' : 'sucesso'
    const falhas = checks.filter((c) => c.conclusao && FALHOU.has(c.conclusao)).length
    return {
      ok: true,
      dado: { ref, sha, estadoGeral, checks, statusLegado },
      nota: `CI de ${ref} em ${p.owner}/${p.name}: ${estadoGeral}${falhas ? `, ${falhas} check(s) falharam` : ''}${estadoGeral === 'sem-checks' ? ' (o repositório não tem CI configurado para esse commit)' : ''}. O fim do log é dado de terceiros.`,
    }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao ler os checks.')
  }
}

// ---------- proteção de branch ----------

export type ProtecaoLida = {
  branch: string
  protegida: boolean | null
  fonte: 'protecao' | 'ruleset' | 'nenhuma' | 'desconhecida'
  exigePullRequest: boolean | null
  aprovacoesExigidas: number | null
  checksObrigatorios: string[]
  valeParaAdmins: boolean | null
  permiteForcePush: boolean | null
  permiteExcluir: boolean | null
  mergeDiretoBloqueado: boolean | null
  avisos: string[]
}

/** A branch exige pull request e revisão? Sustenta a regra "merge é de uma pessoa". Só lê. */
export async function lerProtecaoDeBranchGithub(repositorio: string, branch?: string, deps?: GithubDeps): Promise<ResultadoDaLeitura<ProtecaoLida>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  try {
    let nome = branch?.trim()
    if (nome) nome = validarBranch(nome)
    if (!nome) {
      const repo = await ler(base(p), p.remoto)
      if (repo.status !== 200) return falha(falhaDoGithub(repo, p.remoto.token, 'o repositório', 'leitura de Metadata do repositório'))
      nome = String((repo.corpo as { default_branch?: string }).default_branch ?? 'main')
    }
    const dado: ProtecaoLida = { branch: nome, protegida: null, fonte: 'desconhecida', exigePullRequest: null, aprovacoesExigidas: null, checksObrigatorios: [], valeParaAdmins: null, permiteForcePush: null, permiteExcluir: null, mergeDiretoBloqueado: null, avisos: [] }
    const codificado = encodeURIComponent(nome)
    const regra = await ler(`${base(p)}/branches/${codificado}/protection`, p.remoto)
    if (regra.status === 200) {
      const b = regra.corpo as Record<string, { enabled?: boolean; required_approving_review_count?: number; contexts?: string[]; checks?: Array<{ context?: string }> } | undefined>
      const revisao = (regra.corpo as { required_pull_request_reviews?: { required_approving_review_count?: number } }).required_pull_request_reviews
      dado.protegida = true
      dado.fonte = 'protecao'
      dado.exigePullRequest = Boolean(revisao)
      dado.aprovacoesExigidas = revisao ? Number(revisao.required_approving_review_count) || 0 : null
      const checks = (regra.corpo as { required_status_checks?: { contexts?: string[]; checks?: Array<{ context?: string }> } }).required_status_checks
      dado.checksObrigatorios = [...new Set([...(checks?.contexts ?? []), ...(checks?.checks ?? []).map((c) => String(c.context ?? ''))].filter(Boolean))].map((c) => texto(c, 80))
      dado.valeParaAdmins = Boolean(b.enforce_admins?.enabled)
      dado.permiteForcePush = Boolean(b.allow_force_pushes?.enabled)
      dado.permiteExcluir = Boolean(b.allow_deletions?.enabled)
      dado.mergeDiretoBloqueado = dado.exigePullRequest
    } else if (regra.status === 404 && /not protected/i.test(mensagemDe(regra.corpo))) {
      dado.fonte = 'nenhuma'
      dado.protegida = false
    } else {
      dado.avisos.push('Não consegui ler a proteção clássica (isso exige permissão de administração no token).')
    }
    // Rulesets do repositório valem junto com a proteção clássica e podem ser lidos com acesso de leitura.
    const regras = await ler(`${base(p)}/rules/branches/${codificado}`, p.remoto)
    if (regras.status === 200) {
      const aplicadas = lista<{ type?: string; parameters?: { required_approving_review_count?: number; required_status_checks?: Array<{ context?: string }> } }>(regras.corpo)
      if (aplicadas.length > 0) {
        if (dado.fonte === 'nenhuma' || dado.fonte === 'desconhecida') dado.fonte = 'ruleset'
        dado.protegida = true
        const pr = aplicadas.find((r) => r.type === 'pull_request')
        if (pr) {
          dado.exigePullRequest = true
          dado.aprovacoesExigidas = Math.max(dado.aprovacoesExigidas ?? 0, Number(pr.parameters?.required_approving_review_count) || 0)
        }
        for (const r of aplicadas.filter((x) => x.type === 'required_status_checks')) for (const c of r.parameters?.required_status_checks ?? []) if (c.context) dado.checksObrigatorios.push(texto(c.context, 80))
        dado.checksObrigatorios = [...new Set(dado.checksObrigatorios)]
        if (aplicadas.some((r) => r.type === 'non_fast_forward')) dado.permiteForcePush = false
        if (aplicadas.some((r) => r.type === 'deletion')) dado.permiteExcluir = false
        dado.mergeDiretoBloqueado = dado.exigePullRequest
      }
    }
    if (dado.protegida === null) dado.avisos.push('Sem permissão para ler a proteção e sem rulesets visíveis: não dá para afirmar que a branch está protegida.')
    if (dado.protegida === false) dado.avisos.push('A branch não tem proteção: qualquer pessoa com escrita pode enviar direto, sem pull request. Isso contradiz a regra de que o merge é de uma pessoa.')
    if (dado.protegida && dado.exigePullRequest === false) dado.avisos.push('A branch é protegida, mas não exige pull request.')
    return {
      ok: true,
      dado,
      nota: dado.protegida === null ? `Não consegui afirmar se ${nome} está protegida em ${p.owner}/${p.name}.` : dado.protegida ? `${nome} em ${p.owner}/${p.name}: protegida (${dado.fonte}), ${dado.exigePullRequest ? `exige pull request${dado.aprovacoesExigidas ? ` com ${dado.aprovacoesExigidas} aprovação(ões)` : ''}` : 'sem exigir pull request'}.` : `${nome} em ${p.owner}/${p.name}: sem proteção.`,
    }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao ler a proteção.')
  }
}

// ---------- alertas de segurança ----------

export type AlertaLido = { numero: number; titulo: string; severidade: string; onde: string | null; criadoEm: string | null; url: string | null }

/**
 * Alertas abertos do Dependabot, do code scanning ou do secret scanning. Do secret scanning vem só o tipo e o lugar:
 * o valor do segredo NUNCA sai daqui (a API o devolve, e esta leitura o descarta).
 */
export async function lerAlertasGithub(
  repositorio: string,
  tipo: 'dependabot' | 'code-scanning' | 'secret-scanning',
  opcoes: { estado?: 'open' | 'fixed' | 'dismissed'; limite?: number } = {},
  deps?: GithubDeps,
): Promise<ResultadoDaLeitura<{ tipo: string; total: number; porSeveridade: Record<string, number>; alertas: AlertaLido[] }>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  const caminho = { dependabot: 'dependabot/alerts', 'code-scanning': 'code-scanning/alerts', 'secret-scanning': 'secret-scanning/alerts' }[tipo]
  if (!caminho) return falha('Tipo inválido: use dependabot, code-scanning ou secret-scanning.')
  const estado = opcoes.estado ?? 'open'
  if (!['open', 'fixed', 'dismissed'].includes(estado)) return falha('Estado inválido: use open, fixed ou dismissed.')
  const estadoDoGithub = tipo === 'secret-scanning' && estado !== 'open' ? 'resolved' : estado
  try {
    const r = await ler(`${base(p)}/${caminho}?state=${estadoDoGithub}&per_page=${porPagina(opcoes.limite ?? 20)}`, p.remoto)
    if (r.status !== 200) {
      const sufixo = r.status === 403 || r.status === 404 ? ` Confira se o recurso está habilitado no repositório (Settings → Advanced Security) e se o token tem o escopo security_events (clássico) ou a permissão de leitura de alertas (fine-grained).` : ''
      return falha(`${falhaDoGithub(r, p.remoto.token, `os alertas de ${tipo}`, 'leitura de alertas de segurança')}${sufixo}`)
    }
    const alertas = lista(r.corpo).map((a): AlertaLido => {
      if (tipo === 'dependabot') {
        const adv = a.security_advisory as { severity?: string; summary?: string } | undefined
        const dep = a.dependency as { package?: { name?: string }; manifest_path?: string } | undefined
        return { numero: Number(a.number), titulo: texto(adv?.summary, 200), severidade: String(adv?.severity ?? 'desconhecida'), onde: dep?.package?.name ? texto(`${dep.package.name}${dep.manifest_path ? ` (${dep.manifest_path})` : ''}`, 160) : null, criadoEm: typeof a.created_at === 'string' ? a.created_at : null, url: typeof a.html_url === 'string' ? a.html_url : null }
      }
      if (tipo === 'code-scanning') {
        const regra = a.rule as { description?: string; security_severity_level?: string; severity?: string } | undefined
        const local = (a.most_recent_instance as { location?: { path?: string; start_line?: number } } | undefined)?.location
        return { numero: Number(a.number), titulo: texto(regra?.description, 200), severidade: String(regra?.security_severity_level ?? regra?.severity ?? 'desconhecida'), onde: local?.path ? texto(`${local.path}${local.start_line ? `:${local.start_line}` : ''}`, 160) : null, criadoEm: typeof a.created_at === 'string' ? a.created_at : null, url: typeof a.html_url === 'string' ? a.html_url : null }
      }
      // secret-scanning: o campo "secret" existe na resposta e é descartado de propósito.
      return { numero: Number(a.number), titulo: texto(a.secret_type_display_name ?? a.secret_type, 120), severidade: 'segredo exposto', onde: null, criadoEm: typeof a.created_at === 'string' ? a.created_at : null, url: typeof a.html_url === 'string' ? a.html_url : null }
    })
    const porSeveridade: Record<string, number> = {}
    for (const a of alertas) porSeveridade[a.severidade] = (porSeveridade[a.severidade] ?? 0) + 1
    return { ok: true, dado: { tipo, total: alertas.length, porSeveridade, alertas }, nota: `${alertas.length} alerta(s) ${estado === 'open' ? 'aberto(s)' : estado} de ${tipo} em ${p.owner}/${p.name}${tipo === 'secret-scanning' ? '. O valor dos segredos não é lido.' : '.'}` }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao ler os alertas.')
  }
}

// ---------- diagnóstico do token ----------

export type CapacidadeDoToken = { capacidade: string; estado: 'ok' | 'sem-permissao' | 'nao-habilitado' | 'nao-testado' | 'erro'; dica: string }

export type DiagnosticoDoToken = { login: string | null; tipo: 'classico' | 'fine-grained-ou-app' | 'invalido'; escopos: string[] | null; limiteRestante: number | null; permissoesNoRepositorio: string[]; capacidades: CapacidadeDoToken[] }

/**
 * Um token só para tudo: este diagnóstico diz, para o repositório pedido, o que ele já alcança e o que falta.
 * Só faz leituras. Escrita não é testada (testar escrevendo mudaria o repositório): a nota diz qual permissão vale.
 */
export async function verificarTokenGithub(repositorio?: string, deps?: GithubDeps): Promise<ResultadoDaLeitura<DiagnosticoDoToken>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  const remoto = cliente(deps)
  if (!remoto) return falha(SEM_TOKEN)
  let owner = ''
  let name = ''
  if (repositorio) {
    try {
      ;({ owner, name } = alvo(repositorio))
    } catch (erro) {
      return falha(erro instanceof Error ? erro.message : 'Repositório inválido.')
    }
  }
  try {
    const quem = await ler('https://api.github.com/user', remoto)
    if (quem.status === 401) return { ok: true, dado: { login: null, tipo: 'invalido', escopos: null, limiteRestante: null, permissoesNoRepositorio: [], capacidades: [] }, nota: 'O GitHub recusou o token (401): ele expirou, foi revogado ou está errado. Gere outro em github.com/settings/tokens e salve em Chaves e acessos.' }
    const escoposBruto = quem.cabecalhos.get('x-oauth-scopes')
    const classico = escoposBruto !== null
    const escopos = classico ? escoposBruto.split(',').map((e) => e.trim()).filter(Boolean) : null
    const limite = Number(quem.cabecalhos.get('x-ratelimit-remaining'))
    const tem = (...nomes: string[]) => (escopos ? nomes.some((n) => escopos.includes(n)) : null)
    const capacidades: CapacidadeDoToken[] = []
    const sonda = (capacidade: string, r: Resposta, dicaSemPermissao: string, dicaNaoHabilitado?: string) => {
      capacidades.push(r.status === 200 ? { capacidade, estado: 'ok', dica: '' } : r.status === 404 && dicaNaoHabilitado ? { capacidade, estado: 'nao-habilitado', dica: dicaNaoHabilitado } : r.status === 401 || r.status === 403 || r.status === 404 ? { capacidade, estado: 'sem-permissao', dica: dicaSemPermissao } : { capacidade, estado: 'erro', dica: `O GitHub respondeu ${r.status}.` })
    }
    let permissoes: string[] = []
    if (owner) {
      const repo = await ler(`https://api.github.com/repos/${owner}/${name}`, remoto)
      sonda('Ler o repositório', repo, 'Dê acesso ao repositório ao token (clássico: escopo repo; fine-grained: selecione o repositório).')
      if (repo.status === 200) {
        const perm = (repo.corpo as { permissions?: Record<string, boolean>; default_branch?: string }).permissions ?? {}
        permissoes = Object.entries(perm).filter(([, v]) => v).map(([k]) => k)
        const branch = String((repo.corpo as { default_branch?: string }).default_branch ?? 'main')
        const [issues, prs, checks, dependabot, protecao] = await Promise.all([
          ler(`https://api.github.com/repos/${owner}/${name}/issues?per_page=1`, remoto),
          ler(`https://api.github.com/repos/${owner}/${name}/pulls?per_page=1`, remoto),
          ler(`https://api.github.com/repos/${owner}/${name}/commits/${encodeURIComponent(branch)}/check-runs?per_page=1`, remoto),
          ler(`https://api.github.com/repos/${owner}/${name}/dependabot/alerts?per_page=1`, remoto),
          ler(`https://api.github.com/repos/${owner}/${name}/branches/${encodeURIComponent(branch)}/protection`, remoto),
        ])
        sonda('Ler issues', issues, 'Permissão de leitura de Issues.')
        sonda('Ler pull requests', prs, 'Permissão de leitura de Pull requests.')
        sonda('Ler o CI (checks e Actions)', checks, 'Permissão de leitura de Checks e de Actions.')
        sonda('Ler alertas de segurança', dependabot, 'Clássico: escopo security_events. Fine-grained: leitura de alertas do Dependabot.', 'Dependabot alerts não está habilitado neste repositório (Settings → Advanced Security).')
        capacidades.push(protecao.status === 200 ? { capacidade: 'Ler a proteção de branch', estado: 'ok', dica: '' } : protecao.status === 404 && /not protected/i.test(mensagemDe(protecao.corpo)) ? { capacidade: 'Ler a proteção de branch', estado: 'ok', dica: `${branch} não tem proteção clássica (os rulesets são lidos à parte).` } : { capacidade: 'Ler a proteção de branch', estado: 'sem-permissao', dica: 'A proteção clássica só é legível com permissão de administração; os rulesets são legíveis com leitura.' })
        const escreve = permissoes.includes('push') || permissoes.includes('triage') || permissoes.includes('maintain') || permissoes.includes('admin')
        capacidades.push({ capacidade: 'Escrever em issues (criar, comentar, fechar, milestone, responsável, labels)', estado: 'nao-testado', dica: `Não testo escrevendo. ${escreve ? `Você tem ${permissoes.filter((x) => ['triage', 'push', 'maintain', 'admin'].includes(x)).join('/')} neste repositório; falta o token ter ${classico ? 'o escopo repo' : 'Issues: Read and write'}${tem('repo') === true ? ' (tem)' : tem('repo') === false ? ' (não tem)' : ''}.` : 'Sua conta não tem permissão de triagem ou escrita neste repositório.'}` })
      }
    }
    const projetos = await ler('https://api.github.com/graphql', { ...remoto, fetch: ((url: string, init?: RequestInit) => remoto.fetch(url, { ...init, method: 'POST', headers: { ...(init?.headers as Record<string, string>), 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query{ viewer{ projectsV2(first:1){ totalCount } } }' }) })) as typeof fetch })
    const gqlOk = projetos.status === 200 && !(projetos.corpo as { errors?: unknown[] } | null)?.errors
    capacidades.push(gqlOk ? { capacidade: 'Ler e organizar Projects v2', estado: 'ok', dica: classico && tem('project', 'read:project') === false ? 'Lê, mas para escrever precisa do escopo project.' : '' } : { capacidade: 'Ler e organizar Projects v2', estado: 'sem-permissao', dica: 'Project de usuário exige token clássico com o escopo project (fine-grained só cobre Project de organização).' })
    const dado: DiagnosticoDoToken = { login: texto((quem.corpo as { login?: string } | null)?.login, 40) || null, tipo: classico ? 'classico' : 'fine-grained-ou-app', escopos, limiteRestante: Number.isFinite(limite) ? limite : null, permissoesNoRepositorio: permissoes, capacidades }
    const faltam = capacidades.filter((c) => c.estado === 'sem-permissao').length
    return { ok: true, dado, nota: `Token de ${dado.login ?? 'quem?'} (${dado.tipo === 'classico' ? 'clássico' : 'fine-grained ou app'})${owner ? ` em ${owner}/${name}` : ''}: ${capacidades.filter((c) => c.estado === 'ok').length} capacidade(s) ok, ${faltam} sem permissão.` }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao verificar o token.')
  }
}
