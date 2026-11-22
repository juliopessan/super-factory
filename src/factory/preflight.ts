// Antes de gastar uma execução: o sandbox tem o que o repositório pede? Uma onda inteira já falhou em
// "pip: command not found" depois de clonar, instalar e esperar. Aqui a conferência vem antes e a resposta é BLOCKED, com o conserto.

import type { Executor } from './sandbox.ts'

export const FERRAMENTAS = ['git', 'node', 'npm', 'python3', 'pip', 'go', 'dotnet'] as const
export type Ferramenta = (typeof FERRAMENTAS)[number]
export type FerramentasDoSandbox = Record<Ferramenta, boolean>

/** Pergunta ao container quais ferramentas existem nele. Um comando só. */
export async function inspecionarSandbox(executor: Executor): Promise<FerramentasDoSandbox> {
  const r = await executor.executar(`for c in ${FERRAMENTAS.join(' ')}; do if command -v "$c" >/dev/null 2>&1; then echo "$c=1"; else echo "$c=0"; fi; done`, { timeoutMs: 30_000 })
  const achou = Object.fromEntries(r.saida.split('\n').map((l) => l.trim().split('=')).filter((p) => p.length === 2)) as Record<string, string>
  return Object.fromEntries(FERRAMENTAS.map((f) => [f, achou[f] === '1'])) as FerramentasDoSandbox
}

export type Exigencia = { pilha: string; precisa: Ferramenta[]; porque: string }

/** O que o repositório pede, pelos arquivos da raiz. Só raiz: é o que o modo autônomo também lê. */
export function exigenciasDosArquivos(arquivos: string[]): Exigencia[] {
  const tem = (re: RegExp) => arquivos.find((a) => re.test(a))
  const saida: Exigencia[] = [{ pilha: 'git', precisa: ['git'], porque: 'clonar e enviar a branch' }]
  const node = tem(/^package\.json$/)
  if (node) saida.push({ pilha: 'Node', precisa: ['node', 'npm'], porque: `${node} pede instalar dependências` })
  const py = tem(/^(requirements[^/]*\.txt|pyproject\.toml|setup\.py|Pipfile)$/)
  if (py) saida.push({ pilha: 'Python', precisa: ['python3', 'pip'], porque: `${py} pede pip install` })
  const go = tem(/^go\.mod$/)
  if (go) saida.push({ pilha: 'Go', precisa: ['go'], porque: `${go} pede o toolchain Go` })
  const dn = tem(/\.(sln|csproj)$/)
  if (dn) saida.push({ pilha: '.NET', precisa: ['dotnet'], porque: `${dn} pede o SDK .NET` })
  return saida
}

const CONSERTO: Partial<Record<Ferramenta, string>> = {
  python3: 'rode sudo bash /opt/super-factory/deploy/construir-sandbox.sh (a imagem traz Python 3 e pip)',
  pip: 'rode sudo bash /opt/super-factory/deploy/construir-sandbox.sh (a imagem traz Python 3 e pip)',
  go: 'use uma imagem de sandbox com Go (SUPER_FACTORY_SANDBOX_IMAGE)',
  dotnet: 'use uma imagem de sandbox com o SDK .NET (SUPER_FACTORY_SANDBOX_IMAGE)',
  node: 'use uma imagem de sandbox com Node (SUPER_FACTORY_SANDBOX_IMAGE)',
  npm: 'use uma imagem de sandbox com Node e npm (SUPER_FACTORY_SANDBOX_IMAGE)',
  git: 'use uma imagem de sandbox com git (SUPER_FACTORY_SANDBOX_IMAGE)',
}

export function bloqueiosDoSandbox(ferramentas: FerramentasDoSandbox, exigencias: Exigencia[], imagem: string): string[] {
  const motivos: string[] = []
  for (const e of exigencias) {
    const faltam = e.precisa.filter((f) => !ferramentas[f])
    if (faltam.length === 0) continue
    const conserto = CONSERTO[faltam[0]!]
    motivos.push(`A imagem do sandbox (${imagem}) não tem ${faltam.join(' nem ')}, e este repositório precisa (${e.porque}).${conserto ? ` Conserto: ${conserto}.` : ''}`)
  }
  return motivos
}

export type DepsDoPreflight = {
  ferramentas: () => Promise<FerramentasDoSandbox>
  /** Nomes dos arquivos da raiz do repositório na branch base. Null quando não deu para ler. */
  arquivosDaRaiz: (repositorio: string, branch: string) => Promise<string[] | null>
  imagem: string
}

export type ResultadoDoPreflight = { resultado: 'PASS' | 'BLOCKED' | 'NOT_RUN'; motivos: string[]; ferramentas: FerramentasDoSandbox | null; pilhas: string[] }

/** PASS: o sandbox cobre o que o repositório pede. BLOCKED: falta algo (não gaste a execução). NOT_RUN: não deu para conferir (sem Docker, repositório ilegível). */
export async function preValidarSandbox(card: { repositorio: string; branchBase: string; provedor: string }, deps: DepsDoPreflight): Promise<ResultadoDoPreflight> {
  let ferramentas: FerramentasDoSandbox
  try {
    ferramentas = await deps.ferramentas()
  } catch (erro) {
    return { resultado: 'NOT_RUN', motivos: [`Não consegui abrir o sandbox para conferir: ${erro instanceof Error ? erro.message.slice(0, 200) : 'erro'}`], ferramentas: null, pilhas: [] }
  }
  if (card.provedor !== 'github') return { resultado: 'NOT_RUN', motivos: ['Conferi o sandbox, mas só leio a raiz de repositórios GitHub: o que o repositório pede não foi comparado.'], ferramentas, pilhas: [] }
  const arquivos = await deps.arquivosDaRaiz(card.repositorio, card.branchBase).catch(() => null)
  if (!arquivos) return { resultado: 'NOT_RUN', motivos: ['Não consegui ler a raiz do repositório para saber o que ele pede.'], ferramentas, pilhas: [] }
  const exigencias = exigenciasDosArquivos(arquivos)
  const motivos = bloqueiosDoSandbox(ferramentas, exigencias, deps.imagem)
  return { resultado: motivos.length ? 'BLOCKED' : 'PASS', motivos, ferramentas, pilhas: exigencias.map((e) => e.pilha) }
}
