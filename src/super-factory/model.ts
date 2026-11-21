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


/** O revisor usa um modelo de mais raciocínio que o do construtor: um juiz do mesmo modelo que escreveu o código tende a concordar com ele. */
const REVISOR_PADRAO = 'anthropic/claude-opus-5-5'

/**
 * SUPER_FACTORY_REVIEWER_MODEL escolhe o modelo do revisor (formato provedor/modelo); "mesmo" usa o do chat.
 * Sem ela, vale o claude-opus-5-5 quando há ANTHROPIC_API_KEY; sem a chave da Anthropic, o modelo do chat.
 */
export function modeloDoRevisor(): string | ReturnType<typeof criarFactoryModel> {
  const explicito = process.env.SUPER_FACTORY_REVIEWER_MODEL?.trim()
  if (explicito?.toLowerCase() === 'mesmo') return modeloConfigurado()
  if (explicito) return explicito
  if (process.env.ANTHROPIC_API_KEY) return REVISOR_PADRAO
  return modeloConfigurado()
}
