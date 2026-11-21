import { buscarComRetry, type Esperar } from './retry.ts'
import { dividirRepositorio, semSegredo } from './guards.ts'
import { criarFilaSerial } from './paralelo.ts'

export type ItemRemoto = {
  id: string
  titulo: string
  estado: string
  url: string | null
}

export type ListaRemota = {
  ok: boolean
  modo: 'fixture' | 'live'
  provedor: 'github'
  itens: ItemRemoto[]
  nota: string
}

export type CriacaoRemota = {
  ok: boolean
  modo: 'fixture' | 'live'
  provedor: 'github'
  id: string | null
  url: string | null
  nota: string
}

export type GithubDeps = {
  fetch?: typeof fetch
  token?: string
  esperar?: Esperar
}

const FIXTURE_ISSUES: ItemRemoto[] = [
  { id: '41', titulo: 'Datas só com dia quebram o filtro', estado: 'open', url: null },
  { id: '42', titulo: 'Upload de recibo sem confirmação', estado: 'open', url: null },
]

function tokenDe(deps?: GithubDeps): string | null {
  const token = (deps?.token ?? process.env.GITHUB_TOKEN)?.trim()
  return token || null
}

export function cliente(deps?: GithubDeps): { fetch: typeof fetch; token: string; esperar?: Esperar } | null {
  const token = tokenDe(deps)
  if (!token) return null
  return { fetch: deps?.fetch ?? fetch, token, esperar: deps?.esperar }
}

export async function pedir(url: string, deps: { fetch: typeof fetch; token: string; esperar?: Esperar }, init: RequestInit = {}): Promise<unknown> {
  if (!url.startsWith('https://api.github.com/')) throw new Error('Host do GitHub recusado.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${deps.token}`)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('User-Agent', 'sdlc-factory')
  headers.set('X-GitHub-Api-Version', '2022-11-28')
  let response: Response
  try {
    response = await buscarComRetry(() => deps.fetch(url, { ...init, headers, signal: AbortSignal.timeout(8000) }), init.method, { esperar: deps.esperar })
  } catch {
    throw new Error('Tempo esgotado ao falar com o GitHub.')
  }
  const texto = await response.text()
  if (!response.ok) {
    throw new Error(`GitHub respondeu ${response.status}. ${semSegredo(texto, [deps.token])}`)
  }
  return texto ? (JSON.parse(texto) as unknown) : {}
}

export async function listarIssuesGithub(repositorio: string, deps?: GithubDeps): Promise<ListaRemota> {
  let owner: string
  let name: string
  try {
    ;({ owner, name } = dividirRepositorio(repositorio))
  } catch (error) {
    return { ok: false, modo: 'live', provedor: 'github', itens: [], nota: error instanceof Error ? error.message : 'Repositório inválido.' }
  }
  const remoto = cliente(deps)
  if (!remoto) {
    return {
      ok: true,
      modo: 'fixture',
      provedor: 'github',
      itens: FIXTURE_ISSUES,
      nota: `Simulado, sem GITHUB_TOKEN. Nenhum issue de ${owner}/${name} foi lido no GitHub.`,
    }
  }
  try {
    const corpo = await pedir(`https://api.github.com/repos/${owner}/${name}/issues?state=open&per_page=10`, remoto)
    const lista = Array.isArray(corpo) ? corpo : []
    const itens = lista
      .filter((item) => item && typeof item === 'object' && !('pull_request' in item))
      .slice(0, 10)
      .map((item) => {
        const issue = item as { number?: number; title?: string; state?: string; html_url?: string }
        return {
          id: String(issue.number ?? ''),
          titulo: String(issue.title ?? ''),
          estado: String(issue.state ?? ''),
          url: typeof issue.html_url === 'string' ? issue.html_url : null,
        }
      })
    return { ok: true, modo: 'live', provedor: 'github', itens, nota: `${itens.length} issues abertas em ${owner}/${name}.` }
  } catch (error) {
    return {
      ok: false,
      modo: 'live',
      provedor: 'github',
      itens: [],
      nota: error instanceof Error ? error.message : 'Falha ao listar issues.',
    }
  }
}

export async function criarIssueGithub(
  repositorio: string,
  titulo: string,
  corpo: string,
  deps?: GithubDeps,
): Promise<CriacaoRemota> {
  let owner: string
  let name: string
  try {
    ;({ owner, name } = dividirRepositorio(repositorio))
  } catch (error) {
    return { ok: false, modo: 'live', provedor: 'github', id: null, url: null, nota: error instanceof Error ? error.message : 'Repositório inválido.' }
  }
  const remoto = cliente(deps)
  if (!remoto) {
    return {
      ok: true,
      modo: 'fixture',
      provedor: 'github',
      id: 'fixture-issue',
      url: null,
      nota: `Simulado, sem GITHUB_TOKEN. Nenhum issue foi aberto em ${owner}/${name}.`,
    }
  }
  try {
    const criado = (await pedir(`https://api.github.com/repos/${owner}/${name}/issues`, remoto, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titulo, body: corpo }),
    })) as { number?: number; html_url?: string }
    return {
      ok: true,
      modo: 'live',
      provedor: 'github',
      id: String(criado.number ?? ''),
      url: typeof criado.html_url === 'string' ? criado.html_url : null,
      nota: `Issue #${criado.number ?? ''} aberta em ${owner}/${name}. Merge não foi feito.`,
    }
  } catch (error) {
    return {
      ok: false,
      modo: 'live',
      provedor: 'github',
      id: null,
      url: null,
      nota: error instanceof Error ? error.message : 'Falha ao abrir issue.',
    }
  }
}

export type MilestoneRemoto = { numero: number; titulo: string; url: string | null; aberto: boolean }

export type ResultadoDoMilestone = { ok: boolean; milestone: MilestoneRemoto | null; jaExistia: boolean; nota: string }

export type ResultadoPorIssue = { issue: number; ok: boolean; nota: string }

export type ResultadoDaAtribuicao = { ok: boolean; milestone: MilestoneRemoto | null; resultados: ResultadoPorIssue[]; nota: string }

const LOGIN_VALIDO = /^[A-Za-z0-9-]{1,39}$/
export const MAXIMO_DE_ISSUES_POR_VEZ = 40
const MAXIMO_DE_RESPONSAVEIS = 10

function explicarEscrita(erro: unknown, fallback: string): string {
  const texto = erro instanceof Error ? erro.message : fallback
  if (/\b(401|403|404)\b/.test(texto)) {
    return `${texto} O token precisa de escrita em Issues no repositório (token clássico com o escopo repo, ou fine-grained com Issues: Read and write).`
  }
  return texto
}

function paraMilestone(bruto: unknown): MilestoneRemoto | null {
  const m = bruto as { number?: number; title?: string; html_url?: string; state?: string } | null
  if (!m || typeof m.number !== 'number' || typeof m.title !== 'string') return null
  return { numero: m.number, titulo: m.title, url: typeof m.html_url === 'string' ? m.html_url : null, aberto: m.state !== 'closed' }
}

async function milestonesAbertos(owner: string, name: string, remoto: NonNullable<ReturnType<typeof cliente>>): Promise<MilestoneRemoto[]> {
  const lista = await pedir(`https://api.github.com/repos/${owner}/${name}/milestones?state=open&per_page=100`, remoto)
  return (Array.isArray(lista) ? lista : []).map(paraMilestone).filter((m): m is MilestoneRemoto => m !== null)
}

/**
 * Cria um milestone no repositório. Se já existe um milestone aberto com o mesmo título, devolve esse e não cria outro:
 * pedir duas vezes (ou o agente repetir) não duplica. A escrita nunca é repetida em falha de rede.
 */
// Dois pedidos ao mesmo tempo para o mesmo repositório esperam um pelo outro: o segundo já enxerga o milestone do primeiro.
const filaDeMilestones = criarFilaSerial()

export function criarMilestoneGithub(
  repositorio: string,
  entrada: { titulo: string; descricao?: string; venceEm?: string },
  deps?: GithubDeps,
): Promise<ResultadoDoMilestone> {
  return filaDeMilestones(repositorio.trim().toLowerCase(), () => criarMilestoneAgora(repositorio, entrada, deps))
}

async function criarMilestoneAgora(
  repositorio: string,
  entrada: { titulo: string; descricao?: string; venceEm?: string },
  deps?: GithubDeps,
): Promise<ResultadoDoMilestone> {
  const falha = (nota: string): ResultadoDoMilestone => ({ ok: false, milestone: null, jaExistia: false, nota })
  let owner: string
  let name: string
  try {
    ;({ owner, name } = dividirRepositorio(repositorio))
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Repositório inválido.')
  }
  const titulo = entrada.titulo.replace(/\s+/g, ' ').trim()
  if (titulo.length < 1 || titulo.length > 120) return falha('O título do milestone precisa ter de 1 a 120 caracteres.')
  let venceEm: string | null = null
  if (entrada.venceEm) {
    const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entrada.venceEm.trim())
    if (!dia || Number.isNaN(Date.parse(`${dia[0]}T00:00:00Z`)) || new Date(`${dia[0]}T00:00:00Z`).toISOString().slice(0, 10) !== dia[0]) return falha('A data de vencimento precisa ser um dia válido no formato AAAA-MM-DD.')
    venceEm = `${dia[0]}T23:59:59Z`
  }
  const remoto = cliente(deps)
  if (!remoto) return falha('Sem GITHUB_TOKEN: nenhum milestone foi criado.')
  try {
    const existente = (await milestonesAbertos(owner, name, remoto)).find((m) => m.titulo.trim().toLowerCase() === titulo.toLowerCase())
    if (existente) return { ok: true, milestone: existente, jaExistia: true, nota: `Já existe o milestone "${existente.titulo}" (#${existente.numero}) em ${owner}/${name}. Usei esse e não criei outro.` }
    const criado = paraMilestone(
      await pedir(`https://api.github.com/repos/${owner}/${name}/milestones`, remoto, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titulo, ...(entrada.descricao?.trim() ? { description: entrada.descricao.trim().slice(0, 2000) } : {}), ...(venceEm ? { due_on: venceEm } : {}) }),
      }),
    )
    if (!criado) return falha('O GitHub não confirmou o milestone criado. Confira em github.com antes de tentar de novo, para não duplicar.')
    return { ok: true, milestone: criado, jaExistia: false, nota: `Milestone "${criado.titulo}" (#${criado.numero}) criado em ${owner}/${name}${venceEm ? `, vence em ${entrada.venceEm}` : ''}.` }
  } catch (erro) {
    return falha(explicarEscrita(erro, 'Não consegui criar o milestone.'))
  }
}

/**
 * Põe issues (ou pull requests) num milestone e/ou acrescenta responsáveis. "@me" é o dono do token.
 * Responsável é acrescentado, nunca substitui os que já existem. Uma falha não derruba as outras issues.
 * Só os logins pedidos entram, e cada um precisa poder ser atribuído no repositório: o GitHub ignora o resto sem avisar,
 * então a resposta é conferida.
 */
export async function atribuirIssuesGithub(
  repositorio: string,
  entrada: { issues: number[]; milestone?: string | number; atribuirA?: string[] },
  deps?: GithubDeps,
): Promise<ResultadoDaAtribuicao> {
  const falha = (nota: string): ResultadoDaAtribuicao => ({ ok: false, milestone: null, resultados: [], nota })
  let owner: string
  let name: string
  try {
    ;({ owner, name } = dividirRepositorio(repositorio))
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Repositório inválido.')
  }
  const issues = [...new Set(entrada.issues)]
  if (issues.length === 0) return falha('Informe pelo menos uma issue.')
  if (issues.length > MAXIMO_DE_ISSUES_POR_VEZ) return falha(`No máximo ${MAXIMO_DE_ISSUES_POR_VEZ} issues por vez. Divida em lotes.`)
  if (issues.some((n) => !Number.isInteger(n) || n < 1 || n > 9_999_999)) return falha('Número de issue inválido.')
  const pedidos = [...new Set((entrada.atribuirA ?? []).map((l) => l.trim().replace(/^@(?!me$)/, '')).filter(Boolean))]
  if (pedidos.length > MAXIMO_DE_RESPONSAVEIS) return falha(`No máximo ${MAXIMO_DE_RESPONSAVEIS} responsáveis por issue.`)
  const ehEu = (l: string) => /^(@me|me|eu)$/i.test(l)
  const nomesFixos = pedidos.filter((l) => !ehEu(l))
  if (nomesFixos.some((l) => !LOGIN_VALIDO.test(l))) return falha('Login inválido: use o nome de usuário do GitHub, sem @ (ou "@me" para o dono do token).')
  const marco = entrada.milestone
  if (marco === undefined && pedidos.length === 0) return falha('Informe o milestone, os responsáveis, ou os dois.')
  if (typeof marco === 'number' && (!Number.isInteger(marco) || marco < 1)) return falha('Número de milestone inválido.')
  if (typeof marco === 'string' && (marco.trim().length < 1 || marco.length > 120)) return falha('Título de milestone inválido.')
  const remoto = cliente(deps)
  if (!remoto) return falha('Sem GITHUB_TOKEN: nenhuma issue foi alterada.')
  const base = `https://api.github.com/repos/${owner}/${name}`
  let milestone: MilestoneRemoto | null = null
  let logins: string[] = []
  try {
    if (marco !== undefined) {
      const abertos = await milestonesAbertos(owner, name, remoto)
      milestone = typeof marco === 'number' ? (abertos.find((m) => m.numero === marco) ?? null) : (abertos.find((m) => m.titulo.trim().toLowerCase() === marco.trim().toLowerCase()) ?? null)
      if (!milestone) return falha(`Não achei o milestone ${typeof marco === 'number' ? `#${marco}` : `"${marco}"`} aberto em ${owner}/${name}. Crie com criarMilestoneGithub.`)
    }
    if (pedidos.length > 0) {
      let eu: string | null = null
      if (pedidos.some(ehEu)) {
        const quem = (await pedir('https://api.github.com/user', remoto)) as { login?: string }
        eu = typeof quem.login === 'string' && LOGIN_VALIDO.test(quem.login) ? quem.login : null
        if (!eu) return falha('Não consegui descobrir de quem é o token (GET /user). Informe o login do GitHub.')
      }
      logins = [...new Set(pedidos.map((l) => (ehEu(l) ? (eu as string) : l)))]
    }
  } catch (erro) {
    return falha(explicarEscrita(erro, 'Não consegui ler o repositório.'))
  }
  const resultados: ResultadoPorIssue[] = []
  for (const numero of issues) {
    const feito: string[] = []
    try {
      if (milestone) {
        await pedir(`${base}/issues/${numero}`, remoto, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ milestone: milestone.numero }) })
        feito.push(`milestone "${milestone.titulo}"`)
      }
      if (logins.length > 0) {
        const resposta = (await pedir(`${base}/issues/${numero}/assignees`, remoto, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignees: logins }) })) as { assignees?: Array<{ login?: string }> }
        const atuais = new Set((resposta.assignees ?? []).map((a) => String(a.login ?? '').toLowerCase()))
        const faltou = logins.filter((l) => !atuais.has(l.toLowerCase()))
        if (faltou.length > 0) throw new Error(`${faltou.join(', ')} não pode ser responsável em ${owner}/${name} (o GitHub só aceita quem tem acesso ao repositório).${feito.length ? ` Já feito: ${feito.join(', ')}.` : ''}`)
        feito.push(`responsável ${logins.join(', ')}`)
      }
      resultados.push({ issue: numero, ok: true, nota: `#${numero}: ${feito.join(' e ')}.` })
    } catch (erro) {
      resultados.push({ issue: numero, ok: false, nota: `#${numero}: ${explicarEscrita(erro, 'falhou')}` })
    }
  }
  const certas = resultados.filter((r) => r.ok).length
  return { ok: certas === resultados.length, milestone, resultados, nota: `${certas} de ${resultados.length} issue(s) atualizada(s) em ${owner}/${name}.` }
}

export async function criarRascunhoGithub(
  repositorio: string,
  titulo: string,
  corpo: string,
  base: string,
  head: string,
  deps?: GithubDeps,
  opcoes: { rascunho?: boolean } = {},
): Promise<CriacaoRemota> {
  const rascunho = opcoes.rascunho ?? true
  const tipo = rascunho ? 'rascunho' : 'pronto para revisão'
  let owner: string
  let name: string
  try {
    ;({ owner, name } = dividirRepositorio(repositorio))
  } catch (error) {
    return { ok: false, modo: 'live', provedor: 'github', id: null, url: null, nota: error instanceof Error ? error.message : 'Repositório inválido.' }
  }
  const remoto = cliente(deps)
  if (!remoto) {
    return {
      ok: true,
      modo: 'fixture',
      provedor: 'github',
      id: 'fixture-pr',
      url: null,
      nota: `Simulado, sem GITHUB_TOKEN. Nenhum pull request ${tipo} foi aberto de ${head} para ${base}.`,
    }
  }
  try {
    const criado = (await pedir(`https://api.github.com/repos/${owner}/${name}/pulls`, remoto, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titulo, body: corpo, base, head, draft: rascunho }),
    })) as { number?: number; html_url?: string }
    return {
      ok: true,
      modo: 'live',
      provedor: 'github',
      id: String(criado.number ?? ''),
      url: typeof criado.html_url === 'string' ? criado.html_url : null,
      nota: `Pull request ${tipo} #${criado.number ?? ''} de ${head} para ${base}. Merge não foi feito.`,
    }
  } catch (error) {
    return {
      ok: false,
      modo: 'live',
      provedor: 'github',
      id: null,
      url: null,
      nota: error instanceof Error ? error.message : 'Falha ao abrir o rascunho.',
    }
  }
}
