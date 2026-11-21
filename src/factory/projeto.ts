// GitHub Projects v2 (GraphQL): ler o quadro, mover cards entre colunas, adicionar itens e ordenar.
// Só estas ações. Não há exclusão de item, de projeto nem de campo.
//
// Token: GITHUB_PROJECT_TOKEN, ou GITHUB_TOKEN se o outro não existir. Projeto de USUÁRIO só aceita
// token clássico com o escopo "project"; token fine-grained cobre apenas projeto de organização.

import { criarFilaSerial } from './paralelo.ts'
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
// O GitHub pede escrita em série: duas chamadas de organizar no mesmo Project esperam uma pela outra.
const filaDeEscrita = criarFilaSerial()

export function organizarProjeto(
  referencia: ReferenciaDoProjeto,
  acoes: Acao[],
  campo = 'Status',
  deps?: DepsProjeto,
): Promise<{ ok: boolean; resultados: ResultadoDaAcao[]; nota: string }> {
  return filaDeEscrita(`${referencia.dono}/${referencia.numero}`, () => organizarProjetoAgora(referencia, acoes, campo, deps))
}

async function organizarProjetoAgora(
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

export type ProjetoCriado = { id: string; numero: number; titulo: string; url: string }

const DONO_VALIDO = /^[A-Za-z0-9-]{1,39}$/

/**
 * Cria um GitHub Project (v2) vazio na conta do dono (usuário ou organização). O GitHub já cria o campo Status
 * com Todo, In Progress e Done. A API não escolhe o modelo nem o layout: quem quiser o quadro em colunas troca a
 * visão para Board na tela do Project. Se já existe um Project aberto com o mesmo título, devolve esse e não cria
 * outro: pedir duas vezes (ou o agente repetir) não duplica.
 */
export function criarProjeto(
  dono: string,
  titulo: string,
  opcoes: { repositorio?: string } = {},
  deps?: DepsProjeto,
): Promise<{ ok: boolean; projeto: ProjetoCriado | null; jaExistia: boolean; ligadoAoRepositorio: boolean; nota: string }> {
  return filaDeEscrita(`${dono.toLowerCase()}/novo`, () => criarProjetoAgora(dono, titulo, opcoes, deps))
}

async function criarProjetoAgora(
  dono: string,
  tituloBruto: string,
  opcoes: { repositorio?: string },
  deps?: DepsProjeto,
): Promise<{ ok: boolean; projeto: ProjetoCriado | null; jaExistia: boolean; ligadoAoRepositorio: boolean; nota: string }> {
  const falha = (nota: string) => ({ ok: false, projeto: null, jaExistia: false, ligadoAoRepositorio: false, nota })
  if (!DONO_VALIDO.test(dono)) return falha('Dono inválido: use o usuário ou a organização do GitHub, sem @.')
  const titulo = tituloBruto.replace(/\s+/g, ' ').trim()
  if (titulo.length < 3 || titulo.length > 120) return falha('O título do Project precisa ter de 3 a 120 caracteres.')
  let repoDono = ''
  let repoNome = ''
  if (opcoes.repositorio) {
    const partes = opcoes.repositorio.trim().split('/')
    if (partes.length !== 2 || !DONO_VALIDO.test(partes[0] ?? '') || !/^[A-Za-z0-9._-]{1,100}$/.test(partes[1] ?? '')) return falha('Repositório inválido: use owner/repo.')
    ;[repoDono, repoNome] = partes as [string, string]
  }
  try {
    const achado = await graphql(
      `query($dono:String!){ repositoryOwner(login:$dono){ id __typename ... on ProjectV2Owner { projectsV2(first:50){ nodes { id number title url closed } } } } }`,
      { dono },
      false,
      deps,
    )
    const dono_ = achado.repositoryOwner as { id?: string; projectsV2?: { nodes?: Array<{ id?: string; number?: number; title?: string; url?: string; closed?: boolean } | null> } } | null
    if (!dono_?.id) return falha(`Não achei o usuário ou a organização "${dono}" no GitHub.`)
    const existente = dono_.projectsV2?.nodes?.find((no) => no && !no.closed && (no.title ?? '').trim().toLowerCase() === titulo.toLowerCase())
    if (existente?.id && typeof existente.number === 'number' && existente.url) {
      const projeto = { id: existente.id, numero: existente.number, titulo: existente.title ?? titulo, url: existente.url }
      return { ok: true, projeto, jaExistia: true, ligadoAoRepositorio: false, nota: `Já existe o Project "${projeto.titulo}" (${dono}/${projeto.numero}). Usei esse e não criei outro.` }
    }
    const dados = await graphql(
      `mutation($dono:ID!,$titulo:String!){ createProjectV2(input:{ownerId:$dono,title:$titulo}){ projectV2 { id number title url } } }`,
      { dono: dono_.id, titulo },
      true,
      deps,
    )
    const novo = (dados.createProjectV2 as { projectV2?: { id?: string; number?: number; title?: string; url?: string } } | undefined)?.projectV2
    if (!novo?.id || typeof novo.number !== 'number' || !novo.url) return falha('O GitHub não confirmou o Project criado. Confira em github.com antes de tentar de novo, para não duplicar.')
    const projeto = { id: novo.id, numero: novo.number, titulo: novo.title ?? titulo, url: novo.url }
    let ligado = false
    let aviso = ''
    if (repoNome) {
      try {
        const repo = await graphql(`query($o:String!,$n:String!){ repository(owner:$o,name:$n){ id } }`, { o: repoDono, n: repoNome }, false, deps)
        const repoId = (repo.repository as { id?: string } | null)?.id
        if (!repoId) throw new Error('repositório não encontrado')
        await graphql(`mutation($p:ID!,$r:ID!){ linkProjectV2ToRepository(input:{projectId:$p,repositoryId:$r}){ repository { id } } }`, { p: projeto.id, r: repoId }, true, deps)
        ligado = true
      } catch (erro) {
        aviso = ` Não consegui ligar ao repositório ${opcoes.repositorio}: ${erro instanceof Error ? erro.message : 'falhou'}.`
      }
    }
    return {
      ok: true,
      projeto,
      jaExistia: false,
      ligadoAoRepositorio: ligado,
      nota: `Project "${projeto.titulo}" criado: ${projeto.url} (referência ${dono}/${projeto.numero}). Vem com o campo Status (Todo, In Progress, Done). Para ver em colunas, troque a visão para Board na tela do Project.${ligado ? ` Ligado a ${opcoes.repositorio}.` : ''}${aviso}`,
    }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Não consegui criar o Project.')
  }
}

export type ProjetoDaLista = { numero: number; titulo: string; url: string; descricao: string; itens: number; atualizadoEm: string | null }

/** Os Projects v2 abertos de um usuário ou organização, do mais recente ao mais antigo. Só lê. */
export async function listarProjetos(dono: string, deps?: DepsProjeto): Promise<{ ok: boolean; projetos: ProjetoDaLista[]; nota: string }> {
  if (!DONO_VALIDO.test(dono)) return { ok: false, projetos: [], nota: 'Dono inválido: use o usuário ou a organização do GitHub, sem @.' }
  try {
    const dados = await graphql(
      `query($dono:String!){ repositoryOwner(login:$dono){ ... on ProjectV2Owner { projectsV2(first:50, orderBy:{field:UPDATED_AT,direction:DESC}){ nodes { number title url closed shortDescription updatedAt items { totalCount } } } } } }`,
      { dono },
      false,
      deps,
    )
    const dono_ = dados.repositoryOwner as { projectsV2?: { nodes?: Array<{ number?: number; title?: string; url?: string; closed?: boolean; shortDescription?: string | null; updatedAt?: string; items?: { totalCount?: number } } | null> } } | null
    if (!dono_) return { ok: false, projetos: [], nota: `Não achei o usuário ou a organização "${dono}" no GitHub.` }
    const projetos = (dono_.projectsV2?.nodes ?? [])
      .filter((n): n is NonNullable<typeof n> => Boolean(n) && !n?.closed && typeof n?.number === 'number' && typeof n?.url === 'string')
      .map((n) => ({ numero: n.number as number, titulo: String(n.title ?? '').slice(0, 120), url: n.url as string, descricao: String(n.shortDescription ?? '').slice(0, 200), itens: n.items?.totalCount ?? 0, atualizadoEm: n.updatedAt ?? null }))
    return { ok: true, projetos, nota: `${projetos.length} Project(s) aberto(s) de ${dono}. Use a referência ${dono}/NÚMERO com lerProjetoGithub.` }
  } catch (erro) {
    return { ok: false, projetos: [], nota: erro instanceof Error ? erro.message : 'Não consegui listar os Projects.' }
  }
}

// ---------- campos do Project (prioridade, estimativa, data, iteração) ----------

export type TipoDeCampo = 'single_select' | 'number' | 'text' | 'date'

type CampoDoProjeto = { id: string; nome: string; tipo: 'SINGLE_SELECT' | 'NUMBER' | 'TEXT' | 'DATE' | 'ITERATION' | 'OUTRO'; opcoes: Array<{ id: string; nome: string }>; iteracoes: Array<{ id: string; titulo: string }> }

const CAMPOS = `query($dono:String!,$numero:Int!){
  repositoryOwner(login:$dono){
    ... on ProjectV2Owner {
      projectV2(number:$numero){
        id title
        fields(first:50){ nodes {
          __typename
          ... on ProjectV2Field { id name dataType }
          ... on ProjectV2SingleSelectField { id name options { id name } }
          ... on ProjectV2IterationField { id name configuration { iterations { id title } } }
        } }
      }
    }
  }
}`

async function lerCampos(ref: ReferenciaDoProjeto, deps?: DepsProjeto): Promise<{ id: string; titulo: string; campos: CampoDoProjeto[] } | null> {
  const dados = await graphql(CAMPOS, { dono: ref.dono, numero: ref.numero }, false, deps)
  const projeto = (dados.repositoryOwner as { projectV2?: { id?: string; title?: string; fields?: { nodes?: Array<Record<string, unknown> | null> } } | null } | null)?.projectV2
  if (!projeto?.id) return null
  const campos = (projeto.fields?.nodes ?? [])
    .filter((n): n is Record<string, unknown> => Boolean(n) && typeof n?.id === 'string' && typeof n?.name === 'string')
    .map((n): CampoDoProjeto => {
      const tipoDeDados = String(n.dataType ?? '')
      const tipo = n.__typename === 'ProjectV2SingleSelectField' ? 'SINGLE_SELECT' : n.__typename === 'ProjectV2IterationField' ? 'ITERATION' : tipoDeDados === 'NUMBER' || tipoDeDados === 'TEXT' || tipoDeDados === 'DATE' ? tipoDeDados : 'OUTRO'
      return {
        id: n.id as string,
        nome: n.name as string,
        tipo,
        opcoes: ((n.options as Array<{ id?: string; name?: string }> | undefined) ?? []).filter((o) => o.id && o.name).map((o) => ({ id: o.id as string, nome: o.name as string })),
        iteracoes: (((n.configuration as { iterations?: Array<{ id?: string; title?: string }> } | undefined)?.iterations) ?? []).filter((i) => i.id && i.title).map((i) => ({ id: i.id as string, titulo: i.title as string })),
      }
    })
  return { id: projeto.id, titulo: projeto.title ?? '', campos }
}

const CORES_DAS_OPCOES = ['GRAY', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'RED', 'PINK', 'PURPLE']
const TIPOS_DE_CAMPO: Record<TipoDeCampo, string> = { single_select: 'SINGLE_SELECT', number: 'NUMBER', text: 'TEXT', date: 'DATE' }

/**
 * Cria um campo no Project (seleção única, número, texto ou data), sem duplicar: se já existe um campo com o mesmo nome,
 * devolve esse. Seleção única precisa das opções (por exemplo P1, P2, P3). Não exclui nem renomeia campo.
 */
export function criarCampoDoProjeto(
  ref: ReferenciaDoProjeto,
  entrada: { nome: string; tipo: TipoDeCampo; opcoes?: string[] },
  deps?: DepsProjeto,
): Promise<{ ok: boolean; jaExistia: boolean; nota: string }> {
  return filaDeEscrita(`${ref.dono}/${ref.numero}`, () => criarCampoAgora(ref, entrada, deps))
}

async function criarCampoAgora(ref: ReferenciaDoProjeto, entrada: { nome: string; tipo: TipoDeCampo; opcoes?: string[] }, deps?: DepsProjeto): Promise<{ ok: boolean; jaExistia: boolean; nota: string }> {
  const falha = (nota: string) => ({ ok: false, jaExistia: false, nota })
  const nome = entrada.nome.replace(/\s+/g, ' ').trim()
  if (nome.length < 1 || nome.length > 60) return falha('O nome do campo precisa ter de 1 a 60 caracteres.')
  if (!(entrada.tipo in TIPOS_DE_CAMPO)) return falha('Tipo inválido: use single_select, number, text ou date.')
  const opcoes = [...new Set((entrada.opcoes ?? []).map((o) => o.replace(/\s+/g, ' ').trim()).filter(Boolean))]
  if (entrada.tipo === 'single_select' && (opcoes.length < 1 || opcoes.length > 20 || opcoes.some((o) => o.length > 50))) return falha('Seleção única precisa de 1 a 20 opções, de até 50 caracteres.')
  if (entrada.tipo !== 'single_select' && opcoes.length > 0) return falha('Só o campo de seleção única tem opções.')
  try {
    const lido = await lerCampos(ref, deps)
    if (!lido) return falha(`Não achei o projeto ${ref.dono}/${ref.numero}.`)
    const existente = lido.campos.find((c) => c.nome.toLowerCase() === nome.toLowerCase())
    if (existente) return { ok: true, jaExistia: true, nota: `O campo "${existente.nome}" já existe em ${lido.titulo} (${existente.tipo.toLowerCase().replace('_', ' ')}). Usei esse e não criei outro.` }
    await graphql(
      `mutation($projeto:ID!,$nome:String!,$tipo:ProjectV2CustomFieldType!,$opcoes:[ProjectV2SingleSelectFieldOptionInput!]){ createProjectV2Field(input:{projectId:$projeto,name:$nome,dataType:$tipo,singleSelectOptions:$opcoes}){ projectV2Field { ... on ProjectV2FieldCommon { id name } } } }`,
      { projeto: lido.id, nome, tipo: TIPOS_DE_CAMPO[entrada.tipo], opcoes: entrada.tipo === 'single_select' ? opcoes.map((o, i) => ({ name: o, color: CORES_DAS_OPCOES[i % CORES_DAS_OPCOES.length], description: '' })) : null },
      true,
      deps,
    )
    return { ok: true, jaExistia: false, nota: `Campo "${nome}" criado em ${lido.titulo}${entrada.tipo === 'single_select' ? ` com as opções ${opcoes.join(', ')}` : ''}.` }
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Não consegui criar o campo.')
  }
}

export type AcaoDeCampo = { itemId: string; campo: string; valor: string | number }

/**
 * Define o valor de um campo em itens do Project: seleção única (pelo nome da opção), número, texto, data (AAAA-MM-DD) ou
 * iteração (pelo título). Serve para Prioridade, Estimativa, Prazo e também para o Status. Até 40 ações; uma falha não derruba as outras.
 */
export function definirCamposDoProjeto(ref: ReferenciaDoProjeto, acoes: AcaoDeCampo[], deps?: DepsProjeto): Promise<{ ok: boolean; resultados: ResultadoDaAcao[]; nota: string }> {
  return filaDeEscrita(`${ref.dono}/${ref.numero}`, () => definirCamposAgora(ref, acoes, deps))
}

async function definirCamposAgora(ref: ReferenciaDoProjeto, acoes: AcaoDeCampo[], deps?: DepsProjeto): Promise<{ ok: boolean; resultados: ResultadoDaAcao[]; nota: string }> {
  if (acoes.length === 0) return { ok: false, resultados: [], nota: 'Nenhuma ação para executar.' }
  if (acoes.length > MAXIMO_DE_ACOES) return { ok: false, resultados: [], nota: `No máximo ${MAXIMO_DE_ACOES} ações por vez. Divida em lotes.` }
  let lido
  try {
    lido = await lerCampos(ref, deps)
  } catch (erro) {
    return { ok: false, resultados: [], nota: erro instanceof Error ? erro.message : 'Não consegui ler o projeto.' }
  }
  if (!lido) return { ok: false, resultados: [], nota: `Não achei o projeto ${ref.dono}/${ref.numero}.` }
  const projeto = lido
  const resultados: ResultadoDaAcao[] = []
  for (const acao of acoes) {
    try {
      if (!ID_DE_NO.test(acao.itemId)) throw new Error('Identificador de item inválido.')
      const campo = projeto.campos.find((c) => c.nome.toLowerCase() === String(acao.campo).trim().toLowerCase())
      if (!campo) throw new Error(`O campo "${acao.campo}" não existe. Campos: ${projeto.campos.map((c) => c.nome).join(', ')}.`)
      let valor: Record<string, unknown>
      const bruto = acao.valor
      if (campo.tipo === 'SINGLE_SELECT') {
        const opcao = achar(campo.opcoes, String(bruto))
        if (!opcao) throw new Error(`A opção "${bruto}" não existe em "${campo.nome}". Opções: ${campo.opcoes.map((o) => o.nome).join(', ')}.`)
        valor = { singleSelectOptionId: opcao.id }
      } else if (campo.tipo === 'NUMBER') {
        const n = typeof bruto === 'number' ? bruto : Number(String(bruto).replace(',', '.'))
        if (!Number.isFinite(n)) throw new Error(`"${bruto}" não é um número.`)
        valor = { number: n }
      } else if (campo.tipo === 'DATE') {
        const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(bruto).trim())
        if (!dia || new Date(`${dia[0]}T00:00:00Z`).toISOString().slice(0, 10) !== dia[0]) throw new Error('A data precisa ser um dia válido no formato AAAA-MM-DD.')
        valor = { date: dia[0] }
      } else if (campo.tipo === 'ITERATION') {
        const alvo = campo.iteracoes.find((i) => i.titulo.toLowerCase() === String(bruto).trim().toLowerCase())
        if (!alvo) throw new Error(`A iteração "${bruto}" não existe. Iterações: ${campo.iteracoes.map((i) => i.titulo).join(', ')}.`)
        valor = { iterationId: alvo.id }
      } else if (campo.tipo === 'TEXT') {
        const texto = String(bruto).trim()
        if (!texto || texto.length > 1000) throw new Error('O texto precisa ter de 1 a 1000 caracteres.')
        valor = { text: texto }
      } else {
        throw new Error(`O campo "${campo.nome}" é de um tipo que esta ferramenta não preenche.`)
      }
      await graphql(
        `mutation($projeto:ID!,$item:ID!,$campo:ID!,$valor:ProjectV2FieldValue!){ updateProjectV2ItemFieldValue(input:{projectId:$projeto,itemId:$item,fieldId:$campo,value:$valor}){ projectV2Item { id } } }`,
        { projeto: projeto.id, item: acao.itemId, campo: campo.id, valor },
        true,
        deps,
      )
      resultados.push({ acao: 'definir', ok: true, itemId: acao.itemId, nota: `${campo.nome} = ${bruto}.` })
    } catch (erro) {
      resultados.push({ acao: 'definir', ok: false, itemId: acao.itemId, nota: erro instanceof Error ? erro.message : 'Falhou.' })
    }
  }
  const certas = resultados.filter((r) => r.ok).length
  return { ok: certas === resultados.length, resultados, nota: `${certas} de ${resultados.length} campo(s) definido(s) em ${projeto.titulo}.` }
}
