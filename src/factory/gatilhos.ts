// Gatilho de issues: a issue etiquetada no GitHub vira card no quadro.
// Duas travas de segurança:
//  1. Só entra issue com a etiqueta combinada (padrão "super-factory"). Etiquetar exige permissão de triagem no
//     repositório: é a decisão da pessoa. Quem só abriu a issue não faz a Factory trabalhar.
//  2. Importar só cria o card (em ready, ou bloqueado se faltar critério observável). Quem manda rodar é uma
//     pessoa (ou o Chief a pedido dela), nunca o gatilho: o texto da issue é dado de terceiros.

import { cliente, pedir, type GithubDeps } from './github.ts'
import { dividirRepositorio } from './guards.ts'
import { iniciar } from './pipeline.ts'
import { limparTexto } from './revisao.ts'
import { lerEstado, persistir } from './store.ts'

export const ETIQUETA_PADRAO = 'super-factory'
export const MAXIMO_POR_VARREDURA = 10
const MAXIMO_DE_CRITERIOS = 10

export type ImportadoDaIssue = { issue: string; cardId: string; coluna: string; motivo: string | null }

export type ResultadoDaVarredura = {
  ok: boolean
  importados: ImportadoDaIssue[]
  jaExistiam: number
  nota: string
}

/** Chave de dedupe guardada no card: a mesma issue nunca vira dois cards. */
export function chaveDaIssue(repositorio: string, numero: number): string {
  return `issue:${repositorio}#${numero}`
}

/** Critérios de aceite do corpo da issue: a seção "Critérios" ou, se não houver, a lista de tarefas ("- [ ] ..."). */
export function criteriosDoCorpo(corpo: string): string[] {
  const linhas = corpo.split(/\r?\n/)
  const achados: string[] = []
  let dentro = false
  for (const linha of linhas) {
    if (/^\s{0,3}#{1,6}\s*(crit[ée]rios?|acceptance criteria|aceite)/i.test(linha)) {
      dentro = true
      continue
    }
    if (dentro && /^\s{0,3}#{1,6}\s/.test(linha)) break
    if (dentro) {
      const item = /^\s*(?:[-*]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/.exec(linha)
      if (item?.[1]) achados.push(item[1])
    }
  }
  if (achados.length === 0) {
    for (const linha of linhas) {
      const tarefa = /^\s*[-*]\s+\[[ xX]\]\s+(.+?)\s*$/.exec(linha)
      if (tarefa?.[1]) achados.push(tarefa[1])
    }
  }
  return achados.slice(0, MAXIMO_DE_CRITERIOS).map((criterio) => limparTexto(criterio, 300))
}

type IssueDoGithub = {
  number?: number
  title?: string
  body?: string | null
  html_url?: string
  user?: { login?: string }
  pull_request?: unknown
}

export async function importarIssues(
  repositorio: string,
  opcoes: { etiqueta?: string; limite?: number } = {},
  deps?: GithubDeps,
): Promise<ResultadoDaVarredura> {
  const falha = (nota: string): ResultadoDaVarredura => ({ ok: false, importados: [], jaExistiam: 0, nota })
  let owner: string
  let name: string
  try {
    ;({ owner, name } = dividirRepositorio(repositorio))
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Repositório inválido.')
  }
  const etiqueta = (opcoes.etiqueta ?? ETIQUETA_PADRAO).trim()
  if (!/^[\w][\w .:-]{0,49}$/.test(etiqueta)) return falha('Etiqueta inválida: use letras, números, espaço, ponto, dois-pontos, hífen ou sublinhado.')
  const limite = Math.min(Math.max(Math.trunc(opcoes.limite ?? MAXIMO_POR_VARREDURA) || 1, 1), MAXIMO_POR_VARREDURA)
  const remoto = cliente(deps)
  if (!remoto) return falha('Sem GITHUB_TOKEN: nenhuma issue foi lida e nenhum card foi criado.')
  let lista: unknown
  try {
    lista = await pedir(`https://api.github.com/repos/${owner}/${name}/issues?state=open&labels=${encodeURIComponent(etiqueta)}&per_page=${limite}`, remoto)
  } catch (erro) {
    return falha(erro instanceof Error ? erro.message : 'Falha ao ler as issues.')
  }
  const issues = (Array.isArray(lista) ? lista : []).filter((item): item is IssueDoGithub => Boolean(item) && typeof item === 'object' && !('pull_request' in (item as object))).slice(0, limite)
  const repo = `${owner}/${name}`
  const existentes = new Set(lerEstado().cards.map((card) => card.itemExterno).filter((valor): valor is string => Boolean(valor)))
  const importados: ImportadoDaIssue[] = []
  let jaExistiam = 0
  for (const issue of issues) {
    const numero = Number(issue.number)
    if (!Number.isInteger(numero) || numero <= 0) continue
    const chave = chaveDaIssue(repo, numero)
    if (existentes.has(chave)) {
      jaExistiam++
      continue
    }
    const titulo = limparTexto(issue.title ?? '', 120) || `Issue ${numero}`
    const corpo = limparTexto(issue.body ?? '', 3500)
    const autor = limparTexto(issue.user?.login ?? 'desconhecido', 40)
    const origem = `Origem: issue ${repo}#${numero} (aberta por ${autor}; texto de terceiros).`
    const descricao = [corpo.length >= 20 ? corpo : `${titulo}. ${corpo}`.trim(), '', origem].join('\n')
    const estado = iniciar({
      titulo,
      descricao,
      criterios: criteriosDoCorpo(issue.body ?? '').join('\n'),
      provedor: 'github',
      repositorio: repo,
    })
    persistir({ ...estado, card: { ...estado.card, itemExterno: chave } })
    existentes.add(chave)
    importados.push({ issue: `${repo}#${numero}`, cardId: estado.card.id, coluna: estado.card.coluna, motivo: estado.motivo })
  }
  const bloqueados = importados.filter((i) => i.coluna === 'blocked').length
  return {
    ok: true,
    importados,
    jaExistiam,
    nota: `${importados.length} card(s) novo(s) a partir da etiqueta "${etiqueta}" em ${repo}${bloqueados ? ` (${bloqueados} bloqueado(s): falta critério observável na issue)` : ''}, ${jaExistiam} já existia(m). Nada foi executado: iniciar a onda é uma decisão sua.`,
  }
}
