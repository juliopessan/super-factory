// Minerador de regras: o mesmo comentário de revisão, feito por pessoas em PRs diferentes, é uma regra que o construtor
// ainda não sabe. Aqui só se propõe: gravar a regra (registrarRegraProjeto) é de uma pessoa, com o texto que ela aprovar.

export type ComentarioHumano = { pr: number; texto: string; arquivo?: string | null }
export type RegraProposta = { texto: string; ocorrencias: number; prs: number[]; exemplos: string[] }

const PARADAS = new Set(['para', 'com', 'que', 'uma', 'por', 'mais', 'como', 'isso', 'esse', 'essa', 'este', 'esta', 'the', 'and', 'this', 'that', 'for', 'with', 'you', 'are', 'was', 'não', 'nao', 'tem', 'ser', 'foi', 'aqui', 'ali', 'pode', 'precisa', 'favor', 'please'])
const SO_ELOGIO = /^(lgtm|ok|ótimo|otimo|obrigad[oa]|valeu|show|top|👍|\+1|ship it|aprovado)[\s.!]*$/i

export function palavrasDoComentario(texto: string): string[] {
  const limpo = texto
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
  return [...new Set(limpo.split(/\s+/).filter((p) => p.length > 2 && !PARADAS.has(p)))]
}

export function similaridade(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const B = new Set(b)
  const comuns = a.filter((p) => B.has(p)).length
  return comuns / (a.length + b.length - comuns)
}

export function minerarRegras(comentarios: ComentarioHumano[], opcoes: { minimoDePrs?: number; limiar?: number } = {}): RegraProposta[] {
  const minimo = Math.max(2, opcoes.minimoDePrs ?? 2)
  const limiar = opcoes.limiar ?? 0.45
  type Grupo = { chave: string[]; itens: ComentarioHumano[] }
  const grupos: Grupo[] = []
  for (const c of comentarios) {
    const texto = c.texto.trim()
    if (!texto || SO_ELOGIO.test(texto)) continue
    const palavras = palavrasDoComentario(texto)
    if (palavras.length < 4) continue
    const grupo = grupos.find((g) => similaridade(g.chave, palavras) >= limiar)
    if (grupo) grupo.itens.push(c)
    else grupos.push({ chave: palavras, itens: [c] })
  }
  return grupos
    .map((g) => ({ prs: [...new Set(g.itens.map((i) => i.pr))].sort((a, b) => a - b), itens: g.itens }))
    .filter((g) => g.prs.length >= minimo)
    .map((g) => {
      const curtos = [...g.itens].sort((a, b) => a.texto.length - b.texto.length)
      const representante = curtos[Math.floor(curtos.length / 2)]!.texto.trim().replace(/\s+/g, ' ')
      return { texto: representante.slice(0, 240), ocorrencias: g.itens.length, prs: g.prs, exemplos: curtos.slice(0, 3).map((i) => i.texto.trim().replace(/\s+/g, ' ').slice(0, 160)) }
    })
    .sort((a, b) => b.prs.length - a.prs.length || b.ocorrencias - a.ocorrencias)
}
