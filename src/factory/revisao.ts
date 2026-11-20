// Revisão de pull request pelo agente revisor: ler o PR (título, corpo com a evidência, arquivos e trechos do diff) e
// deixar UM comentário estruturado na página do PR.
//
// Limites que moram no código, não no prompt:
//   - o evento da revisão é sempre "COMMENT". Não existe parâmetro para trocar: o revisor nunca aprova nem
//     trava o merge. Quem decide o merge é uma pessoa;
//   - o texto sai de um modelo montado aqui. O agente só preenche resumo, achados e critérios;
//   - @menções são neutralizadas (um comentário automático não pode chamar ninguém) e segredos são redigidos;
//   - o que vem do PR é de terceiros: vai marcado como dado e passa pela redação de segredos.

import { cliente, pedir as escrever, type GithubDeps } from './github.ts'
import { dividirRepositorio, redigirSegredos, semSegredo } from './guards.ts'
import { AVISO_DE_TERCEIROS, naoAcheiHint, pedir as ler, type DepsRepositorio } from './repositorio.ts'

export const AVISO_DA_REVISAO = '🤖 **Revisão automática da Super Factory.** Só comenta: não aprova, não pede mudanças e não faz merge. Quem decide o merge é uma pessoa.'

export const MAXIMO_DE_ARQUIVOS = 40
export const MAXIMO_DE_PATCH = 3500
export const MAXIMO_TOTAL_DE_PATCH = 40_000
export const MAXIMO_DE_ACHADOS = 25
export const MAXIMO_DE_COMENTARIOS_NO_CODIGO = 15

export type Severidade = 'bloqueante' | 'atencao' | 'sugestao'
export type Achado = { severidade: Severidade; titulo: string; detalhe: string; arquivo?: string | null; linha?: number | null }
export type Criterio = { criterio: string; situacao: 'atendido' | 'nao-atendido' | 'sem-evidencia' }

function numeroDoPr(bruto: unknown): number {
  const texto = String(bruto ?? '').trim().replace(/^#/, '')
  const m = /(?:\/pull\/)?(\d{1,7})\/?$/.exec(texto)
  const numero = m ? Number(m[1]) : Number.NaN
  if (!Number.isInteger(numero) || numero < 1) throw new Error('Informe o número do pull request (ex.: 12 ou #12).')
  return numero
}

/** Aceita "owner/repo" e também o endereço de um PR (https://github.com/owner/repo/pull/12), que traz os dois. */
export function referenciaDoPr(repositorio: string, numero: unknown): { owner: string; name: string; numero: number } {
  const url = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/.exec(repositorio)
  if (url) return { owner: url[1] as string, name: (url[2] as string).replace(/\.git$/, ''), numero: Number(url[3]) }
  const { owner, name } = dividirRepositorio(repositorio.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, ''))
  return { owner, name, numero: numeroDoPr(numero) }
}

export type ArquivoDoPr = { arquivo: string; status: string; adicoes: number; remocoes: number; patch: string | null; patchCortado: boolean }

export async function lerPullRequestGithub(repositorio: string, numero: unknown, deps?: DepsRepositorio) {
  const vazio = { ok: false, pr: null as null | { numero: number; titulo: string; corpo: string; estado: string; rascunho: boolean; base: string; head: string; autor: string; arquivosTotal: number; adicoes: number; remocoes: number; url: string }, arquivos: [] as ArquivoDoPr[], truncado: false, aviso: AVISO_DE_TERCEIROS }
  let ref: { owner: string; name: string; numero: number }
  try {
    ref = referenciaDoPr(repositorio, numero)
  } catch (erro) {
    return { ...vazio, nota: erro instanceof Error ? erro.message : 'Pedido inválido.' }
  }
  try {
    const base = `https://api.github.com/repos/${ref.owner}/${ref.name}/pulls/${ref.numero}`
    const dados = await ler(base, deps)
    if (dados.status === 404) return { ...vazio, nota: naoAcheiHint() }
    const pr = dados.corpo as { number?: number; title?: string; body?: string | null; state?: string; draft?: boolean; base?: { ref?: string }; head?: { ref?: string }; user?: { login?: string }; changed_files?: number; additions?: number; deletions?: number; html_url?: string }
    const lista = await ler(`${base}/files?per_page=100`, deps)
    const arquivosBrutos = (Array.isArray(lista.corpo) ? lista.corpo : []) as Array<{ filename?: string; status?: string; additions?: number; deletions?: number; patch?: string }>
    let restante = MAXIMO_TOTAL_DE_PATCH
    let truncado = arquivosBrutos.length > MAXIMO_DE_ARQUIVOS
    const arquivos = arquivosBrutos.slice(0, MAXIMO_DE_ARQUIVOS).map((a): ArquivoDoPr => {
      const bruto = typeof a.patch === 'string' ? redigirSegredos(a.patch) : null
      const limite = Math.max(0, Math.min(MAXIMO_DE_PATCH, restante))
      const patch = bruto === null ? null : bruto.slice(0, limite)
      const cortado = bruto !== null && bruto.length > (patch?.length ?? 0)
      if (cortado) truncado = true
      restante -= patch?.length ?? 0
      return { arquivo: String(a.filename ?? ''), status: String(a.status ?? ''), adicoes: Number(a.additions ?? 0), remocoes: Number(a.deletions ?? 0), patch, patchCortado: cortado }
    })
    const resumo = {
      numero: ref.numero,
      titulo: redigirSegredos(String(pr.title ?? '')),
      corpo: redigirSegredos(String(pr.body ?? '')).slice(0, 6000),
      estado: String(pr.state ?? ''),
      rascunho: Boolean(pr.draft),
      base: String(pr.base?.ref ?? ''),
      head: String(pr.head?.ref ?? ''),
      autor: String(pr.user?.login ?? ''),
      arquivosTotal: Number(pr.changed_files ?? arquivosBrutos.length),
      adicoes: Number(pr.additions ?? 0),
      remocoes: Number(pr.deletions ?? 0),
      url: String(pr.html_url ?? `https://github.com/${ref.owner}/${ref.name}/pull/${ref.numero}`),
    }
    return { ok: true, pr: resumo, arquivos, truncado, aviso: AVISO_DE_TERCEIROS, nota: `PR #${ref.numero} de ${ref.owner}/${ref.name}: ${resumo.arquivosTotal} arquivo(s), +${resumo.adicoes} −${resumo.remocoes}${truncado ? ' (diff cortado: leia os arquivos que importam com lerArquivoGithub)' : ''}.` }
  } catch (erro) {
    return { ...vazio, nota: erro instanceof Error ? erro.message : 'Não consegui ler o pull request.' }
  }
}

/** Texto de terceiros ou do próprio modelo, pronto para virar comentário: sem segredo e sem @menção que notifique alguém. */
export function limparTexto(texto: string, maximo: number): string {
  return redigirSegredos(String(texto ?? '').replace(/\u0000/g, ''))
    .replace(/@(?=[A-Za-z0-9])/g, '@​')
    .trim()
    .slice(0, maximo)
}

const ROTULO_SEVERIDADE: Record<Severidade, string> = { bloqueante: 'Bloqueante', atencao: 'Atenção', sugestao: 'Sugestão' }
const ROTULO_CRITERIO: Record<Criterio['situacao'], string> = { atendido: '✅ atendido', 'nao-atendido': '❌ não atendido', 'sem-evidencia': '⚠️ sem evidência no PR' }

/** O corpo da revisão. Montado aqui, não pelo agente: ele só entrega os campos. */
export function montarRevisao(entrada: { resumo: string; achados: Achado[]; criterios?: Criterio[] }, comentariosNoCodigo: boolean): string {
  const achados = entrada.achados.slice(0, MAXIMO_DE_ACHADOS)
  const contagem = (s: Severidade) => achados.filter((a) => a.severidade === s).length
  const partes = [AVISO_DA_REVISAO, '', '## Resumo', limparTexto(entrada.resumo, 2000) || '(sem resumo)', '']
  if (entrada.criterios && entrada.criterios.length > 0) {
    partes.push('## Critérios de aceite', ...entrada.criterios.slice(0, 20).map((c) => `- ${limparTexto(c.criterio, 300)}: ${ROTULO_CRITERIO[c.situacao] ?? ROTULO_CRITERIO['sem-evidencia']}`), '')
  }
  partes.push(`## Achados (${contagem('bloqueante')} bloqueantes, ${contagem('atencao')} de atenção, ${contagem('sugestao')} sugestões)`)
  if (achados.length === 0) partes.push('Nada a apontar no que foi lido.')
  for (const a of achados) {
    const onde = a.arquivo ? ` \`${limparTexto(a.arquivo, 200).replace(/`/g, "'")}${a.linha ? `:${a.linha}` : ''}\`` : ''
    // Quando o achado já foi para o código como comentário na linha, no corpo vai só o título.
    const noCodigo = comentariosNoCodigo && a.arquivo && a.linha
    partes.push(`- **${ROTULO_SEVERIDADE[a.severidade] ?? 'Sugestão'}**${onde}: ${limparTexto(a.titulo, 140)}${noCodigo ? '' : ` — ${limparTexto(a.detalhe, 800)}`}`)
  }
  partes.push('', '_Esta revisão é de uma máquina e pode errar. Leia o diff e decida o merge._')
  return partes.join('\n').slice(0, 20_000)
}

// Quais PRs já receberam a revisão nesta execução do servidor. A onda usa isto para só dizer "comentada" quando o
// comentário foi mesmo postado, e não porque o agente terminou de conversar.
const comentados = new Set<string>()
export function foiComentado(repositorio: string, numero: unknown): boolean {
  try {
    const ref = referenciaDoPr(repositorio, numero)
    return comentados.has(`${ref.owner}/${ref.name}#${ref.numero}`.toLowerCase())
  } catch {
    return false
  }
}

export type ResultadoDoComentario = { ok: boolean; modo: 'fixture' | 'live'; id: string | null; url: string | null; comentariosNoCodigo: number; nota: string }

export async function comentarPullRequestGithub(
  repositorio: string,
  numero: unknown,
  entrada: { resumo: string; achados: Achado[]; criterios?: Criterio[] },
  deps?: GithubDeps,
): Promise<ResultadoDoComentario> {
  let ref: { owner: string; name: string; numero: number }
  try {
    ref = referenciaDoPr(repositorio, numero)
  } catch (erro) {
    return { ok: false, modo: 'live', id: null, url: null, comentariosNoCodigo: 0, nota: erro instanceof Error ? erro.message : 'Pedido inválido.' }
  }
  const remoto = cliente(deps)
  if (!remoto) {
    return { ok: true, modo: 'fixture', id: 'fixture-revisao', url: null, comentariosNoCodigo: 0, nota: `Simulado, sem GITHUB_TOKEN. Nada foi postado no PR #${ref.numero} de ${ref.owner}/${ref.name}.` }
  }
  const noCodigo = entrada.achados
    .filter((a) => a.arquivo && a.linha && Number.isInteger(a.linha) && (a.linha as number) > 0)
    .slice(0, MAXIMO_DE_COMENTARIOS_NO_CODIGO)
    .map((a) => ({ path: String(a.arquivo).slice(0, 300), line: a.linha as number, side: 'RIGHT', body: limparTexto(`**${ROTULO_SEVERIDADE[a.severidade] ?? 'Sugestão'}:** ${a.titulo}\n\n${a.detalhe}`, 1500) }))
  const url = `https://api.github.com/repos/${ref.owner}/${ref.name}/pulls/${ref.numero}/reviews`
  const enviar = (comentarios: typeof noCodigo) =>
    escrever(url, remoto, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'COMMENT', body: montarRevisao(entrada, comentarios.length > 0), ...(comentarios.length > 0 ? { comments: comentarios } : {}) }) })
  try {
    let criado: unknown
    let usados = noCodigo.length
    try {
      criado = await enviar(noCodigo)
    } catch (erro) {
      // 422 costuma ser uma linha fora do diff. A escrita falhou sem efeito, então repetir sem os comentários no código é seguro.
      if (noCodigo.length > 0 && erro instanceof Error && /GitHub respondeu 422/.test(erro.message)) {
        usados = 0
        criado = await enviar([])
      } else throw erro
    }
    const r = criado as { id?: number; html_url?: string }
    comentados.add(`${ref.owner}/${ref.name}#${ref.numero}`.toLowerCase())
    return { ok: true, modo: 'live', id: r.id !== undefined ? String(r.id) : null, url: r.html_url ?? null, comentariosNoCodigo: usados, nota: `Revisão comentada no PR #${ref.numero}${usados ? ` (${usados} comentário(s) no código)` : ''}. Não aprova nem trava o merge.` }
  } catch (erro) {
    return { ok: false, modo: 'live', id: null, url: null, comentariosNoCodigo: 0, nota: semSegredo(erro instanceof Error ? erro.message : 'Não consegui comentar no pull request.', [remoto.token]) }
  }
}
