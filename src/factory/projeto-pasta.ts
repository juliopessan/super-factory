// Muito repositório tem o projeto numa subpasta (src-maf/, backend/, app/), com a raiz só de infraestrutura e docs.
// A Factory procura o manifesto (package.json, pyproject.toml, requirements.txt, go.mod, .sln/.csproj, Makefile) na raiz e,
// se não houver, em UM nível de pasta. Mais fundo que isso é ambíguo demais para adivinhar. Funções puras, sem rede nem disco.

const PASTAS_IGNORADAS = /^(node_modules|vendor|docs?|dist|build|out|examples?|samples?|tests?|scripts|\.[^/]*)$/i

/** Quanto menor, mais cedo o manifesto decide qual pasta é "o projeto". */
function postoDoManifesto(arquivo: string): number {
  const nome = arquivo.split('/').pop() ?? ''
  if (nome === 'package.json') return 1
  if (nome === 'pyproject.toml' || nome === 'requirements.txt') return 2
  if (nome === 'go.mod') return 3
  if (/\.(sln|csproj)$/.test(nome)) return 4
  if (nome === 'Makefile') return 5
  return 99
}

export type EscolhaDePasta = { pasta: string; alternativas: string[] }

/** Recebe caminhos de manifestos (da raiz e de um nível abaixo). Raiz ganha sempre; senão, a pasta do manifesto de maior posto. */
export function escolherPasta(manifestos: string[]): EscolhaDePasta | null {
  const limpos = manifestos.map((m) => m.trim()).filter(Boolean)
  if (limpos.some((m) => !m.includes('/'))) return { pasta: '', alternativas: [] }
  const porPasta = new Map<string, number>()
  for (const m of limpos) {
    const partes = m.split('/')
    if (partes.length !== 2) continue
    const pasta = partes[0]!
    if (PASTAS_IGNORADAS.test(pasta) || !/^[A-Za-z0-9._-]+$/.test(pasta)) continue
    porPasta.set(pasta, Math.min(porPasta.get(pasta) ?? 99, postoDoManifesto(m)))
  }
  const ordem = [...porPasta.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
  if (ordem.length === 0) return null
  return { pasta: ordem[0]![0], alternativas: ordem.slice(1).map(([p]) => p) }
}

/** "requires-python = \">=3.13\"" → "3.13". Só o piso (>=): é o que decide se a imagem serve. */
export function versaoMinimaDoPython(pyproject: string): string | null {
  return /^\s*requires-python\s*=\s*["']\s*>=\s*(\d+\.\d+)/m.exec(pyproject)?.[1] ?? null
}

/** Compara "3.11" com "3.13": negativo, zero ou positivo. */
export function compararVersoes(a: string, b: string): number {
  const [a1 = 0, a2 = 0] = a.split('.').map(Number)
  const [b1 = 0, b2 = 0] = b.split('.').map(Number)
  return a1 - b1 || a2 - b2
}

/** Prefixo de um comando para rodar dentro da pasta do projeto. Pasta vazia: o comando segue como está. */
export function naPasta(comando: string, pasta: string): string {
  return pasta ? `cd '${pasta}' && ${comando}` : comando
}
