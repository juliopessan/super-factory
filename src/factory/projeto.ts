// GitHub Projects v2 (GraphQL): ler o quadro, mover cards entre colunas, adicionar itens e ordenar.
// Só estas ações. Não há exclusão de item, de projeto nem de campo.
//
// Token: GITHUB_PROJECT_TOKEN, ou GITHUB_TOKEN se o outro não existir. Projeto de USUÁRIO só aceita
// token clássico com o escopo "project"; token fine-grained cobre apenas projeto de organização.

import { semSegredo } from './guards.ts'
import { buscarComRetry, type Esperar } from './retry.ts'

export type DepsProjeto = { fetch?: typeof fetch; token?: string; esperar?: Esperar }

export type ReferenciaDoProjeto = { dono: string; numero: number }

export type ItemDoProjeto = {
  id: string
  tipo: string
  titulo: string
  numero: number | null
  url: string | null
  repositorio: string | null
  estado: string | null
  status: string | null
}

export type ProjetoLido = {
  id: string
  titulo: string
  url: string
  campo: { id: string; nome: string; opcoes: Array<{ id: string; nome: string }> } | null
  itens: ItemDoProjeto[]
  totalDeItens: number
  truncado: boolean
}

const PAGINAS = 2
const POR_PAGINA = 100

export function tokenDoProjeto(deps?: DepsProjeto): string | null {
  return (deps?.token ?? process.env.GITHUB_PROJECT_TOKEN ?? process.env.GITHUB_TOKEN)?.trim() || null
}

/** Aceita https://github.com/users/dono/projects/3, https://github.com/orgs/dono/projects/3 ou "dono/3". */
export function lerReferenciaDoProjeto(texto: string): ReferenciaDoProjeto {
  const entrada = texto.trim()
  const url = /github\.com\/(?:users|orgs)\/([A-Za-z0-9-]{1,39})\/projects\/(\d{1,6})(?:[/?#]|$)/i.exec(entrada)
  const simples = /^([A-Za-z0-9-]{1,39})[/#](\d{1,6})$/.exec(entrada)
  const achado = url ?? simples
  if (!achado) throw new Error('Informe o projeto como o endereço (https://github.com/users/dono/projects/3) ou "dono/3".')
  const numero = Number(achado[2])
  if (!Number.isInteger(numero) || numero < 1) throw new Error('Número de projeto inválido.')
  return { dono: achado[1] as string, numero }
}

type Resposta = { data?: Record<string, unknown> | null; errors?: Array<{ message?: string }> }

function explicar(mensagens: string[], token: string): string {
  const texto = semSegredo(mensagens.join(' | ').slice(0, 300), [token])
  if (/scope|resource not accessible|insufficient|forbidden/i.test(texto)) {
    return `${texto} O token precisa do escopo "project" (token clássico) para Projects de usuário, e de acesso de escrita para mover cards.`
  }
  return texto
}

async function graphql(consulta: string, variaveis: Record<string, unknown>, escrita: boolean, deps?: DepsProjeto): Promise<Record<string, unknown>> {
  const token = tokenDoProjeto(deps)
  if (!token) throw new Error('Defina o GITHUB_PROJECT_TOKEN (ou o GITHUB_TOKEN) em Chaves e acessos para ler e organizar o Project.')
  const buscar = deps?.fetch ?? fetch
  let resposta: Response
  try {
    // Leitura repete em falha transitória. Escrita não: repetir poderia mover ou criar duas vezes.
    resposta = await buscarComRetry(
      () =>
        buscar('https://api.github.com/graphql', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'super-factory' },
          body: JSON.stringify({ query: consulta, variables: variaveis }),
          signal: AbortSignal.timeout(15_000),
        }),
      escrita ? 'POST' : 'GET',
      { esperar: deps?.esperar },
    )
  } catch {
    throw new Error('Tempo esgotado ao falar com o GitHub.')
  }
  const texto = await resposta.text()
  if (!resposta.ok) throw new Error(`GitHub respondeu ${resposta.status}. ${explicar([texto], token)}`)
  let corpo: Resposta
  try {
    corpo = JSON.parse(texto) as Resposta
  } catch {
    throw new Error('Resposta ilegível do GitHub.')
  }
  if (corpo.errors?.length) throw new Error(explicar(corpo.errors.map((erro) => erro.message ?? 'erro'), token))
  return corpo.data ?? {}
}

const CONSULTA = `query($dono:String!,$numero:Int!,$campo:String!,$depois:String){
  repositoryOwner(login:$dono){
    ... on ProjectV2Owner {
      projectV2(number:$numero){
        id title url
        field(name:$campo){ ... on ProjectV2SingleSelectField { id name options { id name } } }
        items(first:${POR_PAGINA}, after:$depois){
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            id type
            content {
              __typename
              ... on Issue { title number url state repository { nameWithOwner } }
              ... on PullRequest { title number url state repository { nameWithOwner } }
              ... on DraftIssue { title }
            }
            fieldValueByName(name:$campo){ ... on ProjectV2ItemFieldSingleSelectValue { name } }
          }
        }
      }
    }
  }
}`

type NoDoItem = {
  id?: string
  type?: string
  content?: { __typename?: string; title?: string; number?: number; url?: string; state?: string; repository?: { nameWithOwner?: string } } | null
  fieldValueByName?: { name?: string } | null
}

type NoDoProjeto = {
  id?: string
  title?: string
  url?: string
  field?: { id?: string; name?: string; options?: Array<{ id?: string; name?: string }> } | null
  items?: { totalCount?: number; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: NoDoItem[] }
}

export async function lerProjeto(referencia: ReferenciaDoProjeto, campo = 'Status', deps?: DepsProjeto): Promise<{ ok: boolean; projeto: ProjetoLido | null; nota: string }> {
  try {
    const itens: ItemDoProjeto[] = []
    let depois: string | null = null
    let basico: NoDoProjeto | null = null
    let temMais = false
    for (let pagina = 0; pagina < PAGINAS; pagina++) {
      const dados = await graphql(CONSULTA, { dono: referencia.dono, numero: referencia.numero, campo, depois }, false, deps)
      const projeto = ((dados.repositoryOwner as { projectV2?: NoDoProjeto | null } | null)?.projectV2 ?? null) as NoDoProjeto | null
      if (!projeto) return { ok: false, projeto: null, nota: `Não achei o projeto ${referencia.dono}/${referencia.numero}, ou o token não enxerga ele.` }
      basico = basico ?? projeto
      for (const no of projeto.items?.nodes ?? []) {
        const conteudo = no.content ?? null
        itens.push({
          id: no.id ?? '',
          tipo: conteudo?.__typename ?? no.type ?? 'Item',
          titulo: conteudo?.title ?? '(item sem acesso)',
          numero: typeof conteudo?.number === 'number' ? conteudo.number : null,
          url: conteudo?.url ?? null,
          repositorio: conteudo?.repository?.nameWithOwner ?? null,
          estado: conteudo?.state ?? null,
          status: no.fieldValueByName?.name ?? null,
        })
      }
      temMais = Boolean(projeto.items?.pageInfo?.hasNextPage)
      depois = projeto.items?.pageInfo?.endCursor ?? null
      if (!temMais || !depois) break
    }
    const base = basico as NoDoProjeto
    const total = base.items?.totalCount ?? itens.length
    const opcoes = (base.field?.options ?? []).map((opcao) => ({ id: opcao.id ?? '', nome: opcao.name ?? '' }))
    const lido: ProjetoLido = {
      id: base.id ?? '',
      titulo: base.title ?? '',
      url: base.url ?? '',
      campo: base.field?.id ? { id: base.field.id, nome: base.field.name ?? campo, opcoes } : null,
      itens,
      totalDeItens: total,
      truncado: temMais || total > itens.length,
    }
    return { ok: true, projeto: lido, nota: `${lido.titulo}: ${itens.length} de ${total} itens${lido.truncado ? ' (lista cortada)' : ''}.` }
  } catch (erro) {
    return { ok: false, projeto: null, nota: erro instanceof Error ? erro.message : 'Não consegui ler o projeto.' }
  }
}

function achar(opcoes: Array<{ id: string; nome: string }>, nome: string): { id: string; nome: string } | undefined {
  const alvo = nome.trim().toLowerCase()
  return opcoes.find((opcao) => opcao.nome.toLowerCase() === alvo)
}

export type Acao =
  | { tipo: 'mover'; itemId: string; status: string }
  | { tipo: 'adicionar'; url?: string; titulo?: string; corpo?: string; status?: string }
  | { tipo: 'ordenar'; itemId: string; depoisDe: string | null }

export type ResultadoDaAcao = { acao: string; ok: boolean; nota: string; itemId?: string }

const ID_DE_NO = /^[A-Za-z0-9_=-]{8,80}$/
export const MAXIMO_DE_ACOES = 40

async function resolverConteudo(url: string, deps?: DepsProjeto): Promise<string> {
  const achado = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})\/(?:issues|pull)\/(\d{1,9})\/?$/.exec(url.trim())
  if (!achado) throw new Error('Informe o endereço de uma issue ou pull request do GitHub.')
  const token = tokenDoProjeto(deps) as string
  const buscar = deps?.fetch ?? fetch
  const resposta = await buscar(`https://api.github.com/repos/${achado[1]}/${achado[2]}/issues/${achado[3]}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'super-factory' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!resposta.ok) throw new Error(`GitHub respondeu ${resposta.status} ao buscar ${url}.`)
  const no = ((await resposta.json()) as { node_id?: string }).node_id
  if (!no || !ID_DE_NO.test(no)) throw new Error('O GitHub não devolveu o identificador do item.')
  return no
}

/**
 * Executa as ações em ordem, uma a uma. Uma falha não derruba as outras: cada ação devolve o próprio resultado.
 * O projeto é lido uma vez para achar o id dele e as opções do campo de status.
 */
export async function organizarProjeto(
  referencia: ReferenciaDoProjeto,
  acoes: Acao[],
  campo = 'Status',
  deps?: DepsProjeto,
): Promise<{ ok: boolean; resultados: ResultadoDaAcao[]; nota: string }> {
  if (acoes.length === 0) return { ok: false, resultados: [], nota: 'Nenhuma ação para executar.' }
  if (acoes.length > MAXIMO_DE_ACOES) return { ok: false, resultados: [], nota: `No máximo ${MAXIMO_DE_ACOES} ações por vez. Divida em lotes.` }
  const lido = await lerProjeto(referencia, campo, deps)
  if (!lido.ok || !lido.projeto) return { ok: false, resultados: [], nota: lido.nota }
  const projeto = lido.projeto
  const resultados: ResultadoDaAcao[] = []

  const mover = async (itemId: string, status: string): Promise<void> => {
    if (!projeto.campo) throw new Error(`O projeto não tem o campo "${campo}" de seleção única.`)
    const opcao = achar(projeto.campo.opcoes, status)
    if (!opcao) throw new Error(`O status "${status}" não existe. Opções: ${projeto.campo.opcoes.map((item) => item.nome).join(', ')}.`)
    await graphql(
      `mutation($projeto:ID!,$item:ID!,$campo:ID!,$opcao:String!){ updateProjectV2ItemFieldValue(input:{projectId:$projeto,itemId:$item,fieldId:$campo,value:{singleSelectOptionId:$opcao}}){ projectV2Item { id } } }`,
      { projeto: projeto.id, item: itemId, campo: projeto.campo.id, opcao: opcao.id },
      true,
      deps,
    )
  }

  for (const acao of acoes) {
    try {
      if (acao.tipo === 'mover') {
        if (!ID_DE_NO.test(acao.itemId)) throw new Error('Identificador de item inválido.')
        await mover(acao.itemId, acao.status)
        resultados.push({ acao: 'mover', ok: true, itemId: acao.itemId, nota: `Movido para ${acao.status}.` })
      } else if (acao.tipo === 'ordenar') {
        if (!ID_DE_NO.test(acao.itemId) || (acao.depoisDe !== null && !ID_DE_NO.test(acao.depoisDe))) throw new Error('Identificador de item inválido.')
        await graphql(
          `mutation($projeto:ID!,$item:ID!,$depois:ID){ updateProjectV2ItemPosition(input:{projectId:$projeto,itemId:$item,afterId:$depois}){ clientMutationId } }`,
          { projeto: projeto.id, item: acao.itemId, depois: acao.depoisDe },
          true,
          deps,
        )
        resultados.push({ acao: 'ordenar', ok: true, itemId: acao.itemId, nota: acao.depoisDe ? 'Reposicionado.' : 'Colocado no topo.' })
      } else {
        let itemId: string | undefined
        if (acao.url) {
          const conteudo = await resolverConteudo(acao.url, deps)
          const dados = await graphql(
            `mutation($projeto:ID!,$conteudo:ID!){ addProjectV2ItemById(input:{projectId:$projeto,contentId:$conteudo}){ item { id } } }`,
            { projeto: projeto.id, conteudo },
            true,
            deps,
          )
          itemId = (dados.addProjectV2ItemById as { item?: { id?: string } } | undefined)?.item?.id
        } else if (acao.titulo && acao.titulo.trim().length >= 3) {
          const dados = await graphql(
            `mutation($projeto:ID!,$titulo:String!,$corpo:String){ addProjectV2DraftIssue(input:{projectId:$projeto,title:$titulo,body:$corpo}){ projectItem { id } } }`,
            { projeto: projeto.id, titulo: acao.titulo.trim().slice(0, 200), corpo: acao.corpo?.slice(0, 4000) ?? null },
            true,
            deps,
          )
          itemId = (dados.addProjectV2DraftIssue as { projectItem?: { id?: string } } | undefined)?.projectItem?.id
        } else {
          throw new Error('Para adicionar, informe a url de uma issue ou pull request, ou um título.')
        }
        if (!itemId) throw new Error('O GitHub não confirmou o item criado.')
        if (acao.status) await mover(itemId, acao.status)
        resultados.push({ acao: 'adicionar', ok: true, itemId, nota: `Adicionado${acao.status ? ` em ${acao.status}` : ''}.` })
      }
    } catch (erro) {
      resultados.push({ acao: acao.tipo, ok: false, itemId: 'itemId' in acao ? acao.itemId : undefined, nota: erro instanceof Error ? erro.message : 'Falhou.' })
    }
  }
  const certas = resultados.filter((item) => item.ok).length
  return { ok: certas === resultados.length, resultados, nota: `${certas} de ${resultados.length} ações feitas em ${projeto.titulo}.` }
}
