// Escrita reversível do GitHub para a gestão: comentar e editar issue (inclui fechar e reabrir), labels, pedir revisão e
// marcar um PR como pronto. Nada aqui faz merge, aprova PR, fecha PR, exclui coisa ou mexe em proteção.
//
// Regras comuns:
//  - a escrita nunca é repetida em falha de rede (repetir poderia comentar ou criar duas vezes);
//  - o texto vem de agente ou de terceiros: segredo sai redigido e @menção é neutralizada (um comentário automático não chama ninguém);
//  - tudo é validado antes de qualquer chamada; o token é um só (GITHUB_TOKEN);
//  - comentário leva uma marca visível de automação, porque sai com o nome de quem operou a Factory.

import { cliente, MAXIMO_DE_ISSUES_POR_VEZ, pedir, type GithubDeps } from './github.ts'
import { lerChecksGithub } from './github-leitura.ts'
import { dividirRepositorio, semSegredo } from './guards.ts'
import { criarFilaSerial } from './paralelo.ts'
import { limparTexto } from './revisao.ts'

type Preparado = { remoto: NonNullable<ReturnType<typeof cliente>>; owner: string; name: string } | { erro: string }

function preparar(repositorio: string, deps?: GithubDeps): Preparado {
  let r: { owner: string; name: string }
  try {
    r = dividirRepositorio(repositorio)
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Repositório inválido.' }
  }
  const remoto = cliente(deps)
  if (!remoto) return { erro: 'Sem GITHUB_TOKEN: nada foi alterado no GitHub.' }
  return { remoto, ...r }
}

const base = (p: { owner: string; name: string }) => `https://api.github.com/repos/${p.owner}/${p.name}`
const LOGIN_VALIDO = /^[A-Za-z0-9-]{1,39}$/
const NUMERO_MAXIMO = 9_999_999

function numeroValido(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= NUMERO_MAXIMO
}

/** Erro de escrita em português, dizendo qual permissão do token resolve. */
function explicar(erro: unknown, fallback: string): string {
  const texto = erro instanceof Error ? erro.message : fallback
  if (/\b(401|403|404)\b/.test(texto)) return `${texto} O token precisa de escrita no repositório (clássico: escopo repo; fine-grained: Issues e Pull requests em Read and write).`
  return texto
}

const MARCA = 'super-factory'
const RODAPE = '<sub>Comentário automático da Super Factory.</sub>'

// ---------- comentar ----------

export type ResultadoDoComentario = { ok: boolean; comentario: { id: number; url: string | null } | null; jaExistia: boolean; nota: string }

const MARCADOR_VALIDO = /^[A-Za-z0-9:._#/-]{1,120}$/

/**
 * Comenta numa issue ou num pull request (a conversa). Com "marcador", o comentário é idempotente: se já existe um comentário
 * com a mesma marca, nada é postado de novo (a Factory usa isso para avisar uma vez só que o PR abriu).
 */
export async function comentarIssueGithub(repositorio: string, numero: number, texto: string, deps?: GithubDeps, opcoes: { marcador?: string } = {}): Promise<ResultadoDoComentario> {
  const falha = (nota: string): ResultadoDoComentario => ({ ok: false, comentario: null, jaExistia: false, nota })
  if (!numeroValido(numero)) return falha('Número de issue inválido.')
  const limpo = limparTexto(texto, 4000)
  if (!limpo) return falha('O comentário está vazio.')
  if (opcoes.marcador !== undefined && !MARCADOR_VALIDO.test(opcoes.marcador)) return falha('Marcador inválido.')
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  const marca = `<!-- ${MARCA}${opcoes.marcador ? `:${opcoes.marcador}` : ''} -->`
  try {
    if (opcoes.marcador) {
      for (let pagina = 1; pagina <= 3; pagina++) {
        const lote = (await pedir(`${base(p)}/issues/${numero}/comments?per_page=100&page=${pagina}`, p.remoto)) as Array<{ body?: string }> | unknown
        const lista = Array.isArray(lote) ? lote : []
        if (lista.some((c) => typeof (c as { body?: string }).body === 'string' && ((c as { body: string }).body).includes(marca))) {
          return { ok: true, comentario: null, jaExistia: true, nota: `A issue #${numero} já tem este comentário (${opcoes.marcador}). Não postei de novo.` }
        }
        if (lista.length < 100) break
      }
    }
    const criado = (await pedir(`${base(p)}/issues/${numero}/comments`, p.remoto, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: `${limpo}\n\n${RODAPE}\n${marca}` }),
    })) as { id?: number; html_url?: string }
    if (typeof criado.id !== 'number') return falha('O GitHub não confirmou o comentário. Confira em github.com antes de tentar de novo, para não duplicar.')
    return { ok: true, comentario: { id: criado.id, url: typeof criado.html_url === 'string' ? criado.html_url : null }, jaExistia: false, nota: `Comentário postado em #${numero} de ${p.owner}/${p.name}.` }
  } catch (erro) {
    return falha(explicar(erro, 'Não consegui comentar.'))
  }
}

// ---------- editar / fechar / reabrir ----------

export type ResultadoDaEdicao = { ok: boolean; issue: { numero: number; titulo: string; estado: string; url: string | null } | null; mudancas: string[]; nota: string }

/**
 * Edita título, corpo e estado de uma ISSUE. Fechar e reabrir são reversíveis. Pull request fica de fora: fechar um PR é
 * decisão de uma pessoa, e o GitHub trata PR como issue nesta rota, então a leitura prévia recusa.
 */
export async function editarIssueGithub(
  repositorio: string,
  numero: number,
  mudanca: { titulo?: string; corpo?: string; estado?: 'open' | 'closed'; motivo?: 'completed' | 'not_planned' },
  deps?: GithubDeps,
): Promise<ResultadoDaEdicao> {
  const falha = (nota: string): ResultadoDaEdicao => ({ ok: false, issue: null, mudancas: [], nota })
  if (!numeroValido(numero)) return falha('Número de issue inválido.')
  if (mudanca.titulo === undefined && mudanca.corpo === undefined && mudanca.estado === undefined) return falha('Informe o que mudar: título, corpo ou estado.')
  if (mudanca.estado !== undefined && !['open', 'closed'].includes(mudanca.estado)) return falha('Estado inválido: use open ou closed.')
  if (mudanca.motivo !== undefined && !['completed', 'not_planned'].includes(mudanca.motivo)) return falha('Motivo inválido: use completed ou not_planned.')
  if (mudanca.motivo !== undefined && mudanca.estado !== 'closed') return falha('O motivo só vale ao fechar (estado closed).')
  const titulo = mudanca.titulo === undefined ? undefined : limparTexto(mudanca.titulo, 256).replace(/\s+/g, ' ').trim()
  if (mudanca.titulo !== undefined && !titulo) return falha('O título não pode ficar vazio.')
  const corpo = mudanca.corpo === undefined ? undefined : limparTexto(mudanca.corpo, 20_000)
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  try {
    const atual = (await pedir(`${base(p)}/issues/${numero}`, p.remoto)) as { title?: string; body?: string | null; state?: string; pull_request?: unknown; html_url?: string }
    if (atual.pull_request) return falha(`#${numero} é um pull request. Fechar ou editar pull request é decisão de uma pessoa: esta ferramenta só mexe em issues.`)
    const corpoDoPedido: Record<string, unknown> = {}
    const mudancas: string[] = []
    if (titulo !== undefined && titulo !== atual.title) { corpoDoPedido.title = titulo; mudancas.push('título') }
    if (corpo !== undefined && corpo !== (atual.body ?? '')) { corpoDoPedido.body = corpo; mudancas.push('corpo') }
    if (mudanca.estado !== undefined && mudanca.estado !== atual.state) {
      corpoDoPedido.state = mudanca.estado
      corpoDoPedido.state_reason = mudanca.estado === 'closed' ? (mudanca.motivo ?? 'completed') : 'reopened'
      mudancas.push(mudanca.estado === 'closed' ? `fechada (${mudanca.motivo ?? 'completed'})` : 'reaberta')
    }
    if (mudancas.length === 0) return { ok: true, issue: { numero, titulo: String(atual.title ?? ''), estado: String(atual.state ?? ''), url: atual.html_url ?? null }, mudancas: [], nota: `#${numero} já está como pedido: nada a mudar.` }
    const editada = (await pedir(`${base(p)}/issues/${numero}`, p.remoto, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpoDoPedido) })) as { title?: string; state?: string; html_url?: string }
    return { ok: true, issue: { numero, titulo: String(editada.title ?? atual.title ?? ''), estado: String(editada.state ?? ''), url: editada.html_url ?? atual.html_url ?? null }, mudancas, nota: `#${numero} de ${p.owner}/${p.name}: ${mudancas.join(', ')}.` }
  } catch (erro) {
    return falha(explicar(erro, 'Não consegui editar a issue.'))
  }
}

// ---------- labels ----------

export type ResultadoDeLabel = { ok: boolean; jaExistia: boolean; resultados: Array<{ issue: number; ok: boolean; nota: string }>; nota: string }

const LABEL_VALIDA = /^[^,\u0000-\u001f]{1,50}$/
const filaDeLabels = criarFilaSerial()

type LabelRemota = { name?: string; color?: string; description?: string | null }

async function todasAsLabels(p: { owner: string; name: string; remoto: NonNullable<ReturnType<typeof cliente>> }): Promise<LabelRemota[]> {
  const todas: LabelRemota[] = []
  for (let pagina = 1; pagina <= 5; pagina++) {
    const lote = await pedir(`${base(p)}/labels?per_page=100&page=${pagina}`, p.remoto)
    const lista = Array.isArray(lote) ? (lote as LabelRemota[]) : []
    todas.push(...lista)
    if (lista.length < 100) break
  }
  return todas
}

/**
 * Cria uma label (sem duplicar), aplica uma label existente a até 40 issues (acrescenta, não substitui) ou remove uma label
 * de issues. Aplicar uma label que não existe é recusado: o GitHub criaria uma nova, com a cor padrão, por causa de um erro de digitação.
 * Não há exclusão de label.
 */
export function gerenciarLabelsGithub(
  repositorio: string,
  entrada: { acao: 'criar' | 'aplicar' | 'remover'; label: string; cor?: string; descricao?: string; issues?: number[] },
  deps?: GithubDeps,
): Promise<ResultadoDeLabel> {
  return filaDeLabels(repositorio.trim().toLowerCase(), () => gerenciarLabelsAgora(repositorio, entrada, deps))
}

async function gerenciarLabelsAgora(
  repositorio: string,
  entrada: { acao: 'criar' | 'aplicar' | 'remover'; label: string; cor?: string; descricao?: string; issues?: number[] },
  deps?: GithubDeps,
): Promise<ResultadoDeLabel> {
  const falha = (nota: string): ResultadoDeLabel => ({ ok: false, jaExistia: false, resultados: [], nota })
  if (!['criar', 'aplicar', 'remover'].includes(entrada.acao)) return falha('Ação inválida: use criar, aplicar ou remover.')
  const nome = entrada.label.trim()
  if (!LABEL_VALIDA.test(nome)) return falha('Label inválida: de 1 a 50 caracteres, sem vírgula.')
  const cor = (entrada.cor ?? 'ededed').replace(/^#/, '').toLowerCase()
  if (entrada.acao === 'criar' && !/^[0-9a-f]{6}$/.test(cor)) return falha('Cor inválida: use 6 dígitos hexadecimais, como d73a4a.')
  const descricao = entrada.descricao === undefined ? undefined : limparTexto(entrada.descricao, 100)
  const issues = [...new Set(entrada.issues ?? [])]
  if (entrada.acao !== 'criar') {
    if (issues.length === 0) return falha('Informe as issues.')
    if (issues.length > MAXIMO_DE_ISSUES_POR_VEZ) return falha(`No máximo ${MAXIMO_DE_ISSUES_POR_VEZ} issues por vez. Divida em lotes.`)
    if (!issues.every(numeroValido)) return falha('Número de issue inválido.')
  }
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  try {
    const existente = (await todasAsLabels(p)).find((l) => String(l.name ?? '').toLowerCase() === nome.toLowerCase())
    if (entrada.acao === 'criar') {
      if (existente) return { ok: true, jaExistia: true, resultados: [], nota: `A label "${existente.name}" já existe em ${p.owner}/${p.name}. Não criei outra.` }
      await pedir(`${base(p)}/labels`, p.remoto, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nome, color: cor, ...(descricao ? { description: descricao } : {}) }) })
      return { ok: true, jaExistia: false, resultados: [], nota: `Label "${nome}" criada em ${p.owner}/${p.name} (cor ${cor}).` }
    }
    if (!existente && entrada.acao === 'aplicar') return falha(`A label "${nome}" não existe em ${p.owner}/${p.name}. Crie com gerenciarLabelsGithub (ação criar) antes de aplicar.`)
    const nomeExato = String(existente?.name ?? nome)
    const resultados: ResultadoDeLabel['resultados'] = []
    for (const numero of issues) {
      try {
        if (entrada.acao === 'aplicar') {
          const resposta = await pedir(`${base(p)}/issues/${numero}/labels`, p.remoto, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labels: [nomeExato] }) })
          const tem = (Array.isArray(resposta) ? (resposta as LabelRemota[]) : []).some((l) => String(l.name ?? '').toLowerCase() === nomeExato.toLowerCase())
          if (!tem) throw new Error('O GitHub não confirmou a label na issue.')
          resultados.push({ issue: numero, ok: true, nota: `#${numero}: label "${nomeExato}" aplicada.` })
        } else {
          try {
            await pedir(`${base(p)}/issues/${numero}/labels/${encodeURIComponent(nomeExato)}`, p.remoto, { method: 'DELETE' })
            resultados.push({ issue: numero, ok: true, nota: `#${numero}: label "${nomeExato}" removida.` })
          } catch (erro) {
            if (erro instanceof Error && /\b404\b/.test(erro.message)) resultados.push({ issue: numero, ok: true, nota: `#${numero}: já não tinha a label "${nomeExato}" (ou a issue não existe).` })
            else throw erro
          }
        }
      } catch (erro) {
        resultados.push({ issue: numero, ok: false, nota: `#${numero}: ${explicar(erro, 'falhou')}` })
      }
    }
    const certas = resultados.filter((r) => r.ok).length
    return { ok: certas === resultados.length, jaExistia: false, resultados, nota: `${certas} de ${resultados.length} issue(s) atualizada(s) em ${p.owner}/${p.name}.` }
  } catch (erro) {
    return falha(explicar(erro, 'Não consegui mexer nas labels.'))
  }
}

// ---------- pull request: pedir revisão, marcar como pronto ----------

export type ResultadoDoPr = { ok: boolean; nota: string }

const MAXIMO_DE_REVISORES = 5

/** Pede revisão a pessoas (nunca aprova). Só aos logins informados; o GitHub notifica quem recebe. */
export async function pedirRevisaoGithub(repositorio: string, numero: number, revisores: string[], deps?: GithubDeps): Promise<ResultadoDoPr> {
  const falha = (nota: string): ResultadoDoPr => ({ ok: false, nota })
  if (!numeroValido(numero)) return falha('Número de pull request inválido.')
  const logins = [...new Set(revisores.map((r) => r.trim().replace(/^@/, '')).filter(Boolean))]
  if (logins.length === 0) return falha('Informe pelo menos um revisor.')
  if (logins.length > MAXIMO_DE_REVISORES) return falha(`No máximo ${MAXIMO_DE_REVISORES} revisores por vez.`)
  if (logins.some((l) => !LOGIN_VALIDO.test(l))) return falha('Login inválido: use o nome de usuário do GitHub, sem @.')
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  try {
    const pr = (await pedir(`${base(p)}/pulls/${numero}`, p.remoto)) as { state?: string; user?: { login?: string } }
    if (pr.state !== 'open') return falha(`O pull request #${numero} não está aberto.`)
    const autor = String(pr.user?.login ?? '').toLowerCase()
    if (logins.some((l) => l.toLowerCase() === autor)) return falha('O autor do pull request não pode ser o próprio revisor.')
    const resposta = (await pedir(`${base(p)}/pulls/${numero}/requested_reviewers`, p.remoto, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewers: logins }) })) as { requested_reviewers?: Array<{ login?: string }> }
    const pedidos = new Set((resposta.requested_reviewers ?? []).map((r) => String(r.login ?? '').toLowerCase()))
    const faltou = logins.filter((l) => !pedidos.has(l.toLowerCase()))
    if (faltou.length > 0) return falha(`${faltou.join(', ')} não ficou como revisor em ${p.owner}/${p.name} (o GitHub só aceita quem tem acesso ao repositório).`)
    return { ok: true, nota: `Revisão pedida a ${logins.join(', ')} no pull request #${numero}. Quem aprova e faz o merge é uma pessoa.` }
  } catch (erro) {
    return falha(explicar(erro, 'Não consegui pedir a revisão.'))
  }
}

/**
 * Tira um pull request do rascunho (pronto para revisão). Recusa quando o CI falhou ou ainda roda: o PR do modo autônomo
 * abre como rascunho justamente quando os testes não passaram. Não faz merge nem aprova.
 */
export async function marcarPrProntoGithub(repositorio: string, numero: number, deps?: GithubDeps): Promise<ResultadoDoPr> {
  const falha = (nota: string): ResultadoDoPr => ({ ok: false, nota })
  if (!numeroValido(numero)) return falha('Número de pull request inválido.')
  const p = preparar(repositorio, deps)
  if ('erro' in p) return falha(p.erro)
  try {
    const pr = (await pedir(`${base(p)}/pulls/${numero}`, p.remoto)) as { state?: string; draft?: boolean; node_id?: string }
    if (pr.state !== 'open') return falha(`O pull request #${numero} não está aberto.`)
    if (!pr.draft) return { ok: true, nota: `O pull request #${numero} já está pronto para revisão.` }
    if (!pr.node_id || !/^[A-Za-z0-9_=-]{8,80}$/.test(pr.node_id)) return falha('O GitHub não devolveu o identificador do pull request.')
    const ci = await lerChecksGithub(repositorio, numero, deps)
    if (ci.ok && ci.dado?.estadoGeral === 'falha') return falha(`O CI do pull request #${numero} falhou. Corrija antes de marcá-lo como pronto (veja com lerChecksGithub).`)
    if (ci.ok && ci.dado?.estadoGeral === 'pendente') return falha(`O CI do pull request #${numero} ainda está rodando. Espere terminar para marcá-lo como pronto.`)
    const resposta = await fetchGraphql(`mutation($id:ID!){ markPullRequestReadyForReview(input:{pullRequestId:$id}){ pullRequest { isDraft } } }`, { id: pr.node_id }, p.remoto)
    const aindaRascunho = (resposta as { markPullRequestReadyForReview?: { pullRequest?: { isDraft?: boolean } } }).markPullRequestReadyForReview?.pullRequest?.isDraft
    if (aindaRascunho !== false) return falha('O GitHub não confirmou a mudança. Confira o pull request antes de tentar de novo.')
    return { ok: true, nota: `O pull request #${numero} saiu do rascunho e está pronto para revisão. O merge é de uma pessoa.` }
  } catch (erro) {
    return falha(explicar(erro, 'Não consegui marcar o pull request como pronto.'))
  }
}

async function fetchGraphql(consulta: string, variaveis: Record<string, unknown>, remoto: NonNullable<ReturnType<typeof cliente>>): Promise<Record<string, unknown>> {
  const resposta = await remoto.fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${remoto.token}`, 'Content-Type': 'application/json', 'User-Agent': 'sdlc-factory' },
    body: JSON.stringify({ query: consulta, variables: variaveis }),
    signal: AbortSignal.timeout(15_000),
  })
  const texto = await resposta.text()
  if (!resposta.ok) throw new Error(`GitHub respondeu ${resposta.status}. ${semSegredo(texto, [remoto.token]).slice(0, 200)}`)
  const corpo = JSON.parse(texto) as { data?: Record<string, unknown> | null; errors?: Array<{ message?: string }> }
  if (corpo.errors?.length) throw new Error(semSegredo(corpo.errors.map((e) => e.message ?? 'erro').join(' | '), [remoto.token]).slice(0, 300))
  return corpo.data ?? {}
}
