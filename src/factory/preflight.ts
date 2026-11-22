// Antes de gastar uma execução: o sandbox tem o que o repositório pede? Uma onda inteira já falhou em
// "pip: command not found" depois de clonar, instalar e esperar. Aqui a conferência vem antes e a resposta é BLOCKED, com o conserto.

import { compararVersoes } from './projeto-pasta.ts'
import type { Executor } from './sandbox.ts'

export const FERRAMENTAS = ['git', 'node', 'npm', 'python3', 'pip', 'go', 'dotnet'] as const
export type Ferramenta = (typeof FERRAMENTAS)[number]
export type FerramentasDoSandbox = Record<Ferramenta, boolean>

/** Pergunta ao container quais ferramentas existem nele. Um comando só. */
export async function inspecionarSandbox(executor: Executor): Promise<FerramentasDoSandbox> {
  // cwd: /workspace existe na imagem pura. O padrão do executor (a pasta do repositório) só existe depois do clone.
  const r = await executor.executar(`for c in ${FERRAMENTAS.join(' ')}; do if command -v "$c" >/dev/null 2>&1; then echo "$c=1"; else echo "$c=0"; fi; done`, { timeoutMs: 30_000, cwd: '/workspace' })
  const achou = Object.fromEntries(r.saida.split('\n').map((l) => l.trim().split('=')).filter((p) => p.length === 2)) as Record<string, string>
  // Saída que não é a esperada é falha da inspeção, não "a imagem não tem nada": nunca vira BLOCKED por engano.
  if (!FERRAMENTAS.every((f) => achou[f] === '0' || achou[f] === '1')) throw new Error(`não consegui inspecionar o sandbox (código ${r.codigo}): ${`${r.saida}\n${r.erro}`.trim().slice(0, 160) || 'sem saída'}`)
  return Object.fromEntries(FERRAMENTAS.map((f) => [f, achou[f] === '1'])) as FerramentasDoSandbox
}

/** Versão do Python do container, "3.13" (maior.menor). Null se não houver Python. */
export async function versaoDoPythonNoSandbox(executor: Executor): Promise<string | null> {
  const r = await executor.executar(`python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true`, { timeoutMs: 30_000, cwd: '/workspace' })
  return /^\d+\.\d+$/.test(r.saida.trim()) ? r.saida.trim() : null
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

/** O que o repositório tem: os arquivos da pasta do projeto (raiz ou uma subpasta) e o piso de Python que ele declara. */
export type ProjetoLido = { arquivos: string[]; pasta: string; pythonMinimo: string | null }

export type DepsDoPreflight = {
  ferramentas: () => Promise<FerramentasDoSandbox>
  /** Nomes dos arquivos da raiz do repositório na branch base. Null quando não deu para ler. */
  arquivosDaRaiz: (repositorio: string, branch: string) => Promise<string[] | null>
  /** Como arquivosDaRaiz, mas acha o projeto também em uma subpasta e lê o requires-python. Tem prioridade quando existe. */
  projeto?: (repositorio: string, branch: string) => Promise<ProjetoLido | null>
  /** Versão do Python da imagem, para comparar com a que o projeto exige. */
  versaoDoPython?: () => Promise<string | null>
  imagem: string
}

export type ResultadoDoPreflight = { resultado: 'PASS' | 'BLOCKED' | 'NOT_RUN'; motivos: string[]; ferramentas: FerramentasDoSandbox | null; pilhas: string[]; pasta?: string }

/** PASS: o sandbox cobre o que o repositório pede. BLOCKED: falta algo (não gaste a execução). NOT_RUN: não deu para conferir (sem Docker, repositório ilegível). */
export async function preValidarSandbox(card: { repositorio: string; branchBase: string; provedor: string }, deps: DepsDoPreflight): Promise<ResultadoDoPreflight> {
  let ferramentas: FerramentasDoSandbox
  try {
    ferramentas = await deps.ferramentas()
  } catch (erro) {
    return { resultado: 'NOT_RUN', motivos: [`Não consegui abrir o sandbox para conferir: ${erro instanceof Error ? erro.message.slice(0, 200) : 'erro'}`], ferramentas: null, pilhas: [] }
  }
  if (card.provedor !== 'github') return { resultado: 'NOT_RUN', motivos: ['Conferi o sandbox, mas só leio a raiz de repositórios GitHub: o que o repositório pede não foi comparado.'], ferramentas, pilhas: [] }
  const projeto: ProjetoLido | null = deps.projeto
    ? await deps.projeto(card.repositorio, card.branchBase).catch(() => null)
    : await deps.arquivosDaRaiz(card.repositorio, card.branchBase).then((a) => (a ? { arquivos: a, pasta: '', pythonMinimo: null } : null)).catch(() => null)
  if (!projeto) return { resultado: 'NOT_RUN', motivos: ['Não consegui ler o repositório para saber o que ele pede.'], ferramentas, pilhas: [] }
  const exigencias = exigenciasDosArquivos(projeto.arquivos)
  const motivos = bloqueiosDoSandbox(ferramentas, exigencias, deps.imagem)
  // Python: ter o python3 não basta, a versão precisa servir (requires-python do projeto).
  if (projeto.pythonMinimo && exigencias.some((e) => e.pilha === 'Python') && ferramentas.python3 && deps.versaoDoPython) {
    const tem = await deps.versaoDoPython().catch(() => null)
    if (tem && compararVersoes(tem, projeto.pythonMinimo) < 0) {
      motivos.push(`O projeto exige Python >= ${projeto.pythonMinimo} e a imagem do sandbox (${deps.imagem}) tem ${tem}. Conserto: rode sudo bash /opt/super-factory/deploy/construir-sandbox.sh --python ${projeto.pythonMinimo} e aponte SUPER_FACTORY_SANDBOX_IMAGE para a imagem nova.`)
    }
  }
  return { resultado: motivos.length ? 'BLOCKED' : 'PASS', motivos, ferramentas, pilhas: exigencias.map((e) => e.pilha), ...(projeto.pasta ? { pasta: projeto.pasta } : {}) }
}
