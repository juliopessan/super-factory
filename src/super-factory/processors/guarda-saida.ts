import { RegexFilterProcessor, type RegexRule } from '@mastra/core/processors'

// Guarda determinística na saída dos agentes. A política mora no código, não no prompt:
// um agente não pode afirmar que fez merge, deploy ou aprovou um gate.
// Negações próximas ("nenhum merge foi feito", "não fiz o deploy") passam intactas.

export const AVISO_SAIDA = '[afirmação removida pela Factory: merge, deploy e gates exigem uma pessoa]'

const NEGACAO = String.raw`(?<!\b(?:não|nao|nunca|nem|nenhum|nenhuma|sem)\s+(?:\S+\s+){0,3})`
const ALVO = String.raw`(?:merge|deploy|force-push|push|release|gate|aprova[çc][ãa]o)`

export const REGRAS_SAIDA: RegexRule[] = [
  {
    name: 'acao-em-primeira-pessoa',
    pattern: new RegExp(
      String.raw`${NEGACAO}\b(?:eu\s+)?(?:já\s+)?(?:fiz|realizei|executei|conclu[ií]|aprovei|liberei|publiquei|apliquei|mergeei|subi)\s+(?:o\s+|a\s+|os\s+|as\s+)?${ALVO}\b`,
      'gi',
    ),
    replacement: AVISO_SAIDA,
  },
  {
    name: 'merge-ou-deploy-feito',
    pattern: new RegExp(
      String.raw`${NEGACAO}\b(?:o\s+)?(?:merge|deploy|release)\s+(?:já\s+)?(?:foi|está|esta)\s+(?:feito|realizado|conclu[ií]do|publicado|aplicado|no\s+ar)\b`,
      'gi',
    ),
    replacement: AVISO_SAIDA,
  },
  {
    name: 'gate-aprovado-pelo-agente',
    pattern: new RegExp(
      String.raw`${NEGACAO}\b(?:o\s+)?(?:gate|aprova[çc][ãa]o)\s+(?:\S+\s+){0,2}(?:aprovad[oa]|liberad[oa]|registrad[oa])\s+por\s+mim\b`,
      'gi',
    ),
    replacement: AVISO_SAIDA,
  },
]

/** Aplica as mesmas regras do processor a um texto. Usado nos testes. */
export function guardarTexto(texto: string): string {
  return REGRAS_SAIDA.reduce((saida, regra) => saida.replace(regra.pattern, regra.replacement ?? AVISO_SAIDA), texto)
}

export function guardaDeSaida(): RegexFilterProcessor {
  return new RegexFilterProcessor({ rules: REGRAS_SAIDA, strategy: 'redact', phase: 'output', streamCarryoverSize: 200 })
}
