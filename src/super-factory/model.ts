import { criarFactoryModel } from './factory-model.ts'

const MODELOS = {
  openai: 'openai/gpt-6.1-sol',
  anthropic: 'anthropic/claude-sonnet-5-5',
  google: 'google/gemini-3.8-flash',
} as const

function modeloEscolhido(): string {
  return process.env.SUPER_FACTORY_MODEL?.trim() || process.env.FACTORY_MODEL?.trim() || ''
}

export function modeloConfigurado(): string | ReturnType<typeof criarFactoryModel> {
  const escolhido = modeloEscolhido()
  if (escolhido) return escolhido
  if (process.env.OPENAI_API_KEY) return MODELOS.openai
  if (process.env.ANTHROPIC_API_KEY) return MODELOS.anthropic
  if (process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) return MODELOS.google
  return criarFactoryModel()
}

export function origemDoModelo(): string {
  const escolhido = modeloEscolhido()
  if (escolhido) return escolhido
  if (process.env.OPENAI_API_KEY) return MODELOS.openai
  if (process.env.ANTHROPIC_API_KEY) return MODELOS.anthropic
  if (process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) return MODELOS.google
  return 'super-factory/factory'
}

/** Provedores com chave no ambiente, na ordem de preferência. */
function provedoresComChave(): string[] {
  const lista: string[] = []
  if (process.env.OPENAI_API_KEY) lista.push(MODELOS.openai)
  if (process.env.ANTHROPIC_API_KEY) lista.push(MODELOS.anthropic)
  if (process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) lista.push(MODELOS.google)
  return lista
}

/**
 * Cadeia de modelos do agente: o escolhido primeiro, com 2 novas tentativas,
 * e os outros provedores com chave como reserva, com 1. Sem chave, só o
 * modelo local da Factory, que não falha por rede.
 */
export function cadeiaDeModelos(): Array<{ model: string | ReturnType<typeof criarFactoryModel>; maxRetries: number }> {
  const escolhido = modeloEscolhido()
  const nomes = [...new Set([escolhido, ...provedoresComChave()].filter(Boolean))]
  if (nomes.length === 0) return [{ model: criarFactoryModel(), maxRetries: 0 }]
  return nomes.map((model, i) => ({ model, maxRetries: i === 0 ? 2 : 1 }))
}
