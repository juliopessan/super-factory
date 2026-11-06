import { dividirAzure, segmento, semSegredo } from './guards.ts'

export type ItemAzure = {
  id: string
  titulo: string
  estado: string
  url: string | null
}

export type ListaAzure = {
  ok: boolean
  modo: 'fixture' | 'live'
  provedor: 'azure-devops'
  itens: ItemAzure[]
  nota: string
}

export type CriacaoAzure = {
  ok: boolean
  modo: 'fixture' | 'live'
  provedor: 'azure-devops'
  id: string | null
  url: string | null
  nota: string
}

export type AzureDeps = {
  fetch?: typeof fetch
  pat?: string
  org?: string
}

const FIXTURE_ITENS: ItemAzure[] = [
  { id: '1842', titulo: 'Datas só com dia quebram o filtro', estado: 'Active', url: null },
  { id: '1843', titulo: 'Upload de recibo sem confirmação', estado: 'New', url: null },
]

export function modoAzure(deps?: AzureDeps): 'fixture' | 'live' | 'incomplete' {
  const pat = (deps?.pat ?? process.env.AZURE_DEVOPS_PAT)?.trim()
  const org = (deps?.org ?? process.env.AZURE_DEVOPS_ORG)?.trim()
  if (!pat && !org) return 'fixture'
  if (!pat || !org) return 'incomplete'
  return 'live'
}

function cliente(deps?: AzureDeps): { fetch: typeof fetch; pat: string; org: string } | { erro: string } | null {
  const modo = modoAzure(deps)
  if (modo === 'fixture') return null
  if (modo === 'incomplete') {
    return { erro: 'Para o Azure DevOps ao vivo, defina AZURE_DEVOPS_ORG e AZURE_DEVOPS_PAT juntos.' }
  }
  try {
    const org = segmento((deps?.org ?? process.env.AZURE_DEVOPS_ORG ?? '').trim(), 'Organização')
    const pat = (deps?.pat ?? process.env.AZURE_DEVOPS_PAT ?? '').trim()
    return { fetch: deps?.fetch ?? fetch, pat, org }
  } catch (error) {
    return { erro: error instanceof Error ? error.message : 'Organização inválida.' }
  }
}

async function pedir(
  url: string,
  deps: { fetch: typeof fetch; pat: string },
  init: RequestInit = {},
): Promise<unknown> {
  if (!url.startsWith('https://dev.azure.com/')) throw new Error('Host do Azure DevOps recusado.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Basic ${Buffer.from(`:${deps.pat}`).toString('base64')}`)
  headers.set('Accept', 'application/json')
  let response: Response
  try {
    response = await deps.fetch(url, { ...init, headers, signal: AbortSignal.timeout(8000) })
  } catch {
    throw new Error('Tempo esgotado ao falar com o Azure DevOps.')
  }
  const texto = await response.text()
  if (!response.ok) {
    throw new Error(`Azure DevOps respondeu ${response.status}. ${semSegredo(texto, [deps.pat])}`)
  }
  return texto ? (JSON.parse(texto) as unknown) : {}
}

function falha(nota: string, modo: 'fixture' | 'live' = 'live'): ListaAzure {
  return { ok: false, modo, provedor: 'azure-devops', itens: [], nota }
}

export async function listarWorkItemsAzure(projeto: string, deps?: AzureDeps): Promise<ListaAzure> {
  let project: string
  try {
    project = dividirAzure(projeto).project
  } catch (error) {
    return falha(error instanceof Error ? error.message : 'Projeto inválido.')
  }
  const remoto = cliente(deps)
  if (remoto && 'erro' in remoto) return falha(remoto.erro)
  if (!remoto) {
    return {
      ok: true,
      modo: 'fixture',
      provedor: 'azure-devops',
      itens: FIXTURE_ITENS,
      nota: `Simulado, sem AZURE_DEVOPS_PAT. Nenhum work item de ${project} foi lido.`,
    }
  }
  try {
    const wiql = (await pedir(`https://dev.azure.com/${remoto.org}/${project}/_apis/wit/wiql?api-version=7.1`, remoto, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.State] <> 'Closed' ORDER BY [System.ChangedDate] DESC`,
      }),
    })) as { workItems?: { id?: number }[] }
    const ids = (wiql.workItems ?? [])
      .map((item) => item.id)
      .filter((id): id is number => typeof id === 'number')
      .slice(0, 10)
    if (ids.length === 0) {
      return { ok: true, modo: 'live', provedor: 'azure-devops', itens: [], nota: `Nenhum work item aberto em ${project}.` }
    }
    const lote = (await pedir(
      `https://dev.azure.com/${remoto.org}/${project}/_apis/wit/workitems?ids=${ids.join(',')}&fields=System.Id,System.Title,System.State&api-version=7.1`,
      remoto,
    )) as { value?: { id?: number; fields?: Record<string, string> }[] }
    const itens = (lote.value ?? []).map((item) => ({
      id: String(item.id ?? ''),
      titulo: String(item.fields?.['System.Title'] ?? ''),
      estado: String(item.fields?.['System.State'] ?? ''),
      url: `https://dev.azure.com/${remoto.org}/${project}/_workitems/edit/${item.id ?? ''}`,
    }))
    return { ok: true, modo: 'live', provedor: 'azure-devops', itens, nota: `${itens.length} work items em ${project}.` }
  } catch (error) {
    return falha(error instanceof Error ? error.message : 'Falha ao listar work items.')
  }
}

export async function criarWorkItemAzure(
  projeto: string,
  titulo: string,
  corpo: string,
  deps?: AzureDeps,
): Promise<CriacaoAzure> {
  let project: string
  try {
    project = dividirAzure(projeto).project
  } catch (error) {
    return { ok: false, modo: 'live', provedor: 'azure-devops', id: null, url: null, nota: error instanceof Error ? error.message : 'Projeto inválido.' }
  }
  const remoto = cliente(deps)
  if (remoto && 'erro' in remoto) {
    return { ok: false, modo: 'live', provedor: 'azure-devops', id: null, url: null, nota: remoto.erro }
  }
  if (!remoto) {
    return {
      ok: true,
      modo: 'fixture',
      provedor: 'azure-devops',
      id: 'fixture-work-item',
      url: null,
      nota: `Simulado, sem AZURE_DEVOPS_PAT. Nenhum work item foi aberto em ${project}.`,
    }
  }
  try {
    const criado = (await pedir(
      `https://dev.azure.com/${remoto.org}/${project}/_apis/wit/workitems/$User%20Story?api-version=7.1`,
      remoto,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify([
          { op: 'add', path: '/fields/System.Title', value: titulo },
          { op: 'add', path: '/fields/System.Description', value: corpo },
        ]),
      },
    )) as { id?: number }
    const id = String(criado.id ?? '')
    return {
      ok: true,
      modo: 'live',
      provedor: 'azure-devops',
      id,
      url: id ? `https://dev.azure.com/${remoto.org}/${project}/_workitems/edit/${id}` : null,
      nota: `Work item #${id} aberto em ${project}. Nenhum deploy foi feito.`,
    }
  } catch (error) {
    return {
      ok: false,
      modo: 'live',
      provedor: 'azure-devops',
      id: null,
      url: null,
      nota: error instanceof Error ? error.message : 'Falha ao abrir work item.',
    }
  }
}

export async function criarRascunhoAzure(
  projeto: string,
  titulo: string,
  corpo: string,
  base: string,
  head: string,
  deps?: AzureDeps,
): Promise<CriacaoAzure> {
  let project: string
  let repository: string | null
  try {
    ;({ project, repository } = dividirAzure(projeto))
  } catch (error) {
    return { ok: false, modo: 'live', provedor: 'azure-devops', id: null, url: null, nota: error instanceof Error ? error.message : 'Projeto inválido.' }
  }
  if (!repository) {
    return {
      ok: false,
      modo: 'live',
      provedor: 'azure-devops',
      id: null,
      url: null,
      nota: 'Para um pull request no Azure DevOps informe projeto/repositorio.',
    }
  }
  const remoto = cliente(deps)
  if (remoto && 'erro' in remoto) {
    return { ok: false, modo: 'live', provedor: 'azure-devops', id: null, url: null, nota: remoto.erro }
  }
  if (!remoto) {
    return {
      ok: true,
      modo: 'fixture',
      provedor: 'azure-devops',
      id: 'fixture-pr',
      url: null,
      nota: `Simulado, sem AZURE_DEVOPS_PAT. Nenhum pull request rascunho foi aberto de ${head} para ${base}.`,
    }
  }
  try {
    const criado = (await pedir(
      `https://dev.azure.com/${remoto.org}/${project}/_apis/git/repositories/${repository}/pullrequests?api-version=7.1`,
      remoto,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titulo,
          description: corpo,
          sourceRefName: `refs/heads/${head}`,
          targetRefName: `refs/heads/${base}`,
          isDraft: true,
        }),
      },
    )) as { pullRequestId?: number }
    const id = String(criado.pullRequestId ?? '')
    return {
      ok: true,
      modo: 'live',
      provedor: 'azure-devops',
      id,
      url: id ? `https://dev.azure.com/${remoto.org}/${project}/_git/${repository}/pullrequest/${id}` : null,
      nota: `Pull request rascunho #${id} de ${head} para ${base}. Merge não foi feito.`,
    }
  } catch (error) {
    return {
      ok: false,
      modo: 'live',
      provedor: 'azure-devops',
      id: null,
      url: null,
      nota: error instanceof Error ? error.message : 'Falha ao abrir o rascunho.',
    }
  }
}
