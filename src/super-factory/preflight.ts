// Liga a pré-validação do sandbox ao ambiente real: o container da imagem configurada e o repositório no GitHub.

import { escolherPasta, versaoMinimaDoPython } from '../factory/projeto-pasta.ts'
import { inspecionarSandbox, versaoDoPythonNoSandbox, type DepsDoPreflight, type FerramentasDoSandbox, type ProjetoLido } from '../factory/preflight.ts'
import { lerArquivoGithub, listarArquivosGithub, type DepsRepositorio } from '../factory/repositorio.ts'
import { criarExecutorDocker } from '../factory/sandbox.ts'

const VALIDADE_MS = 10 * 60_000
let guardado: { imagem: string; em: number; ferramentas: FerramentasDoSandbox; python: string | null } | null = null

export function imagemDoSandbox(): string {
  return process.env.SUPER_FACTORY_SANDBOX_IMAGE?.trim() || 'node:22-bookworm'
}

/** Abre um container descartável só para perguntar o que a imagem tem. O resultado vale 10 minutos. */
async function inspecionarImagem() {
  const imagem = imagemDoSandbox()
  if (guardado && guardado.imagem === imagem && Date.now() - guardado.em < VALIDADE_MS) return guardado
  const executor = await criarExecutorDocker({ cardId: 'preflight' })
  try {
    const ferramentas = await inspecionarSandbox(executor)
    const python = ferramentas.python3 ? await versaoDoPythonNoSandbox(executor) : null
    guardado = { imagem, em: Date.now(), ferramentas, python }
    return guardado
  } finally {
    await executor.encerrar()
  }
}

export async function ferramentasDaImagem(): Promise<FerramentasDoSandbox> {
  return (await inspecionarImagem()).ferramentas
}

const EH_MANIFESTO = /^(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Makefile|[^/]+\.(sln|csproj))$/

/** O projeto do repositório: a raiz ou, sem manifesto nela, a subpasta escolhida (a mesma regra do modo autônomo). */
export async function lerProjetoDoGithub(repositorio: string, branch: string, deps?: DepsRepositorio): Promise<ProjetoLido | null> {
  const lista = await listarArquivosGithub(repositorio, branch, '', deps)
  if (!lista.ok) return null
  const caminhos = lista.arquivos.map((a) => a.caminho)
  const manifestos = caminhos.filter((c) => c.split('/').length <= 2 && EH_MANIFESTO.test(c.split('/').pop() ?? ''))
  const escolha = escolherPasta(manifestos)
  const pasta = escolha?.pasta ?? ''
  const arquivos = pasta ? caminhos.filter((c) => c.startsWith(`${pasta}/`) && c.split('/').length === 2).map((c) => c.split('/')[1]!) : caminhos.filter((c) => !c.includes('/'))
  let pythonMinimo: string | null = null
  if (arquivos.includes('pyproject.toml')) {
    const arq = await lerArquivoGithub(repositorio, branch, pasta ? `${pasta}/pyproject.toml` : 'pyproject.toml', deps)
    if (arq.ok) pythonMinimo = versaoMinimaDoPython(arq.conteudo)
  }
  return { arquivos, pasta, pythonMinimo }
}

export function depsDoPreflight(): DepsDoPreflight {
  return {
    imagem: imagemDoSandbox(),
    ferramentas: ferramentasDaImagem,
    versaoDoPython: async () => (await inspecionarImagem()).python,
    projeto: lerProjetoDoGithub,
    arquivosDaRaiz: async (repositorio, branch) => (await lerProjetoDoGithub(repositorio, branch))?.arquivos ?? null,
  }
}
