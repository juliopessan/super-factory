import { dividirRepositorio, semSegredo } from './guards.ts'

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
}

const FIXTURE_ISSUES: ItemRemoto[] = [
  { id: '41', titulo: 'Datas só com dia quebram o filtro', estado: 'open', url: null },
  { id: '42', titulo: 'Upload de recibo sem confirmação', estado: 'open', url: null },
]

function tokenDe(deps?: GithubDeps): string | null {
  const token = (deps?.token ?? process.env.GITHUB_TOKEN)?.trim()
  return token || null
}

function cliente(deps?: GithubDeps): { fetch: typeof fetch; token: string } | null {
  const token = tokenDe(deps)
  if (!token) return null
  return { fetch: deps?.fetch ?? fetch, token }
}

async function pedir(url: string, deps: { fetch: typeof fetch; token: string }, init: RequestInit = {}): Promise<unknown> {
  if (!url.startsWith('https://api.github.com/')) throw new Error('Host do GitHub recusado.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${deps.token}`)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('User-Agent', 'sdlc-factory')
  headers.set('X-GitHub-Api-Version', '2022-11-28')
  let response: Response
  try {
    response = await deps.fetch(url, { ...init, headers, signal: AbortSignal.timeout(8000) })
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

export async function criarRascunhoGithub(
  repositorio: string,
  titulo: string,
  corpo: string,
  base: string,
  head: string,
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
      id: 'fixture-pr',
      url: null,
      nota: `Simulado, sem GITHUB_TOKEN. Nenhum pull request rascunho foi aberto de ${head} para ${base}.`,
    }
  }
  try {
    const criado = (await pedir(`https://api.github.com/repos/${owner}/${name}/pulls`, remoto, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titulo, body: corpo, base, head, draft: true }),
    })) as { number?: number; html_url?: string }
    return {
      ok: true,
      modo: 'live',
      provedor: 'github',
      id: String(criado.number ?? ''),
      url: typeof criado.html_url === 'string' ? criado.html_url : null,
      nota: `Pull request rascunho #${criado.number ?? ''} de ${head} para ${base}. Merge não foi feito.`,
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
