// Orçamento de tamanho de PR: PR pequeno e atômico se revisa de verdade; PR grande se aprova no escuro.
// Quando a mudança passa do orçamento, a Factory não corta nada sozinha: avisa no PR e propõe uma divisão em PRs
// empilhados (testes junto do código que cobrem, pastas juntas, dependências e configuração primeiro).

export type ArquivoMedido = { caminho: string; adicoes: number; remocoes: number }
export type Orcamento = { linhas: number; arquivos: number }
export type AvaliacaoDoOrcamento = { estourou: boolean; linhas: number; arquivos: number; motivos: string[] }
export type PrDaDivisao = { titulo: string; arquivos: string[]; linhas: number }

export const ORCAMENTO_PADRAO: Orcamento = { linhas: 400, arquivos: 15 }

/** Lê SUPER_FACTORY_PR_MAX_LINHAS e SUPER_FACTORY_PR_MAX_ARQUIVOS. 0 desliga o limite; valor inválido volta ao padrão. */
export function lerOrcamento(env: Record<string, string | undefined> = process.env): Orcamento {
  const num = (valor: string | undefined, padrao: number) => {
    if (valor === undefined || valor.trim() === '') return padrao
    const n = Number(valor)
    return Number.isInteger(n) && n >= 0 ? n : padrao
  }
  return { linhas: num(env.SUPER_FACTORY_PR_MAX_LINHAS, ORCAMENTO_PADRAO.linhas), arquivos: num(env.SUPER_FACTORY_PR_MAX_ARQUIVOS, ORCAMENTO_PADRAO.arquivos) }
}

/** Saída de `git diff --numstat`: "12\t3\tcaminho". Binário vem como "-\t-". */
export function lerNumstat(texto: string): ArquivoMedido[] {
  const saida: ArquivoMedido[] = []
  for (const linha of texto.split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(linha.trim())
    if (!m) continue
    saida.push({ caminho: m[3]!.replace(/\{[^{}]* => ([^{}]*)\}/, '$1').replace(/^.* => /, '').replace(/\/\//g, '/'), adicoes: m[1] === '-' ? 0 : Number(m[1]), remocoes: m[2] === '-' ? 0 : Number(m[2]) })
  }
  return saida
}

const tamanho = (a: ArquivoMedido) => a.adicoes + a.remocoes

export function avaliarOrcamento(arquivos: ArquivoMedido[], orcamento: Orcamento): AvaliacaoDoOrcamento {
  const linhas = arquivos.reduce((n, a) => n + tamanho(a), 0)
  const motivos: string[] = []
  if (orcamento.linhas > 0 && linhas > orcamento.linhas) motivos.push(`${linhas} linhas mudadas (orçamento: ${orcamento.linhas})`)
  if (orcamento.arquivos > 0 && arquivos.length > orcamento.arquivos) motivos.push(`${arquivos.length} arquivos (orçamento: ${orcamento.arquivos})`)
  return { estourou: motivos.length > 0, linhas, arquivos: arquivos.length, motivos }
}

const ARQUIVO_DE_TESTE = /(^|\/)(tests?|__tests__|specs?)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.(py|go)$/i

/** Chave da unidade: o código e o teste dele ficam juntos ("src/a/filtro.ts" e "src/a/filtro.test.ts"). */
function unidadeDe(caminho: string): string {
  const base = caminho.replace(/\.(test|spec)(\.[cm]?[jt]sx?)$/i, '$2').replace(/(^|\/)test_([^/]*\.py)$/i, '$1$2').replace(/_test(\.(py|go))$/i, '$1')
  return base.replace(/\.[A-Za-z0-9]+$/, '')
}

function pastaDe(caminho: string): string {
  const partes = caminho.split('/')
  return partes.length <= 1 ? '.' : partes.slice(0, Math.min(2, partes.length - 1)).join('/')
}

/** Quanto menor o posto, mais embaixo na pilha: dependências e configuração primeiro, documentação por último. */
function posto(caminho: string): number {
  if (/(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig[^/]*\.json|Dockerfile|docker-compose\.ya?ml|\.github\/|go\.(mod|sum)|requirements[^/]*\.txt|pyproject\.toml)$/.test(caminho) || caminho.startsWith('.github/')) return 0
  if (/\.(md|mdx|rst|txt)$/i.test(caminho) || caminho.startsWith('docs/')) return 3
  if (/(^|\/)(ui|components?|pages?|views?|app|styles?|public)\//i.test(caminho) || /\.(tsx|jsx|vue|svelte|css|scss|html)$/i.test(caminho)) return 2
  return 1
}

/**
 * Divide a mudança em PRs que cabem no orçamento. Cada PR leva unidades inteiras (código + teste) da mesma pasta,
 * e a ordem de empilhar vai de dependências e núcleo até interface e documentação. Uma unidade maior que o orçamento
 * fica sozinha: dividir um arquivo ao meio não é proposta que a Factory faça.
 */
export function propostaDeDivisao(arquivos: ArquivoMedido[], orcamento: Orcamento): PrDaDivisao[] {
  if (arquivos.length === 0) return []
  const unidades = new Map<string, ArquivoMedido[]>()
  for (const a of arquivos) {
    const chave = unidadeDe(a.caminho)
    unidades.set(chave, [...(unidades.get(chave) ?? []), a])
  }
  const lista = [...unidades.entries()].map(([chave, itens]) => ({ chave, itens, linhas: itens.reduce((n, i) => n + tamanho(i), 0), pasta: pastaDe(itens[0]!.caminho), posto: Math.min(...itens.map((i) => posto(i.caminho))) }))
  lista.sort((a, b) => a.posto - b.posto || a.pasta.localeCompare(b.pasta) || a.chave.localeCompare(b.chave))
  const maxLinhas = orcamento.linhas > 0 ? orcamento.linhas : Number.POSITIVE_INFINITY
  const maxArquivos = orcamento.arquivos > 0 ? orcamento.arquivos : Number.POSITIVE_INFINITY
  const prs: Array<{ itens: ArquivoMedido[]; linhas: number; pastas: Set<string>; posto: number }> = []
  for (const u of lista) {
    const atual = prs.at(-1)
    const cabe = atual && atual.posto === u.posto && atual.linhas + u.linhas <= maxLinhas && atual.itens.length + u.itens.length <= maxArquivos
    if (cabe) {
      atual.itens.push(...u.itens)
      atual.linhas += u.linhas
      atual.pastas.add(u.pasta)
    } else prs.push({ itens: [...u.itens], linhas: u.linhas, pastas: new Set([u.pasta]), posto: u.posto })
  }
  return prs.map((p, i) => {
    const pastas = [...p.pastas]
    const nome = pastas.length === 1 ? pastas[0]! : `${pastas[0]} e mais ${pastas.length - 1} pasta(s)`
    const ehTeste = p.itens.every((a) => ARQUIVO_DE_TESTE.test(a.caminho))
    return { titulo: `Parte ${i + 1}/${prs.length}: ${nome === '.' ? 'raiz' : nome}${ehTeste ? ' (só testes)' : ''}`, arquivos: p.itens.map((a) => a.caminho), linhas: p.linhas }
  })
}

/** Texto do ponto de atenção do PR: o que estourou e a divisão sugerida. Vazio se coube no orçamento. */
export function textoDoOrcamento(arquivos: ArquivoMedido[], orcamento: Orcamento): string[] {
  const av = avaliarOrcamento(arquivos, orcamento)
  if (!av.estourou) return []
  const divisao = propostaDeDivisao(arquivos, orcamento)
  const cabecalho = `PR maior que o orçamento: ${av.motivos.join('; ')}. PR pequeno se revisa de verdade.`
  if (divisao.length < 2) return [`${cabecalho} Não achei um corte natural: considere pedir ao card uma mudança menor.`]
  const linhas = divisao.slice(0, 8).map((p, i) => `${i + 1}. ${p.titulo} (${p.arquivos.length} arquivo(s), ${p.linhas} linhas)`)
  return [`${cabecalho} Sugestão de divisão em ${divisao.length} PRs empilhados, do de baixo para o de cima:\n${linhas.map((l) => `  ${l}`).join('\n')}${divisao.length > 8 ? '\n  …' : ''}`]
}
