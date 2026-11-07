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
