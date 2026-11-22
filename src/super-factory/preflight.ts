// Liga a pré-validação do sandbox ao ambiente real: o container da imagem configurada e a raiz do repositório no GitHub.

import { inspecionarSandbox, type DepsDoPreflight, type FerramentasDoSandbox } from '../factory/preflight.ts'
import { criarExecutorDocker } from '../factory/sandbox.ts'
import { listarArquivosGithub } from '../factory/repositorio.ts'

const VALIDADE_MS = 10 * 60_000
let guardado: { imagem: string; em: number; ferramentas: FerramentasDoSandbox } | null = null

export function imagemDoSandbox(): string {
  return process.env.SUPER_FACTORY_SANDBOX_IMAGE?.trim() || 'node:22-bookworm'
}

/** Abre um container descartável só para perguntar o que a imagem tem. O resultado vale 10 minutos. */
export async function ferramentasDaImagem(): Promise<FerramentasDoSandbox> {
  const imagem = imagemDoSandbox()
  if (guardado && guardado.imagem === imagem && Date.now() - guardado.em < VALIDADE_MS) return guardado.ferramentas
  const executor = await criarExecutorDocker({ cardId: 'preflight' })
  try {
    const ferramentas = await inspecionarSandbox(executor)
    guardado = { imagem, em: Date.now(), ferramentas }
    return ferramentas
  } finally {
    await executor.encerrar()
  }
}

export function depsDoPreflight(): DepsDoPreflight {
  return {
    imagem: imagemDoSandbox(),
    ferramentas: ferramentasDaImagem,
    arquivosDaRaiz: async (repositorio, branch) => {
      const r = await listarArquivosGithub(repositorio, branch)
      return r.ok ? r.arquivos.map((a) => a.caminho).filter((c) => !c.includes('/')) : null
    },
  }
}
