// Liga a triagem de bug e o webhook do GitHub ao ambiente real: Docker, agente reprodutor e GITHUB_TOKEN.
// A triagem automática (pelo webhook) é opt-in: gasta sandbox e modelo. Pelo chat, é um pedido explícito de uma pessoa.

import { criarExecutorDocker } from '../factory/sandbox.ts'
import { triarBug, type DepsDaTriagem } from '../factory/triagem-bug.ts'
import { tratarWebhookGithub } from '../factory/webhook-github.ts'
import { criarLimitePorChave } from './protecao.ts'
import { reprodutorComAgente } from './agents/construtor.ts'

export function depsDeTriagemDoAmbiente(): DepsDaTriagem {
  return {
    criarExecutor: (id) => criarExecutorDocker({ cardId: id }),
    reprodutor: reprodutorComAgente,
    credenciais: { githubToken: process.env.GITHUB_TOKEN },
  }
}

export function triagemAutomaticaLigada(env: Record<string, string | undefined> = process.env): boolean {
  return ['1', 'sim', 'true'].includes(env.SUPER_FACTORY_TRIAGEM_BUGS?.trim().toLowerCase() ?? '')
}

const emAndamento = new Set<string>()
const limite = criarLimitePorChave(Math.max(1, Number(process.env.SUPER_FACTORY_TRIAGEM_MAX_POR_HORA) || 5), 3_600_000)

/** Uma triagem por issue de cada vez e um teto por hora: o webhook não vira uma torneira de custo. */
export async function triarBugDoAmbiente(repositorio: string, numero: number) {
  const chave = `${repositorio.toLowerCase()}#${numero}`
  if (emAndamento.has(chave)) return { ok: false, resultado: null, nota: `A triagem de ${chave} já está rodando.` }
  if (!limite('todas')) return { ok: false, resultado: null, nota: 'Teto de triagens por hora atingido (SUPER_FACTORY_TRIAGEM_MAX_POR_HORA). Tente mais tarde.' }
  emAndamento.add(chave)
  try {
    return await triarBug(repositorio, numero, depsDeTriagemDoAmbiente())
  } finally {
    emAndamento.delete(chave)
  }
}

export function tratarWebhook(req: Request): Promise<Response> {
  return tratarWebhookGithub(req, { triar: triagemAutomaticaLigada() ? triarBugDoAmbiente : undefined })
}
