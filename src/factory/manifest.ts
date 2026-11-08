export const MANIFEST = {
  apiVersion: 'super-factory/v1',
  stages: ['triage', 'specification', 'implementation', 'verification', 'human-review', 'delivery'],
  // A única decisão humana do ciclo é o merge. Implementação e testes seguem sozinhos até o pull request.
  gates: {
    beforeMerge: { human: true, requiresEvidence: true, agentMayApprove: false },
  },
  agents: ['chief-of-staff', 'architect', 'frontend', 'backend', 'integrations', 'qa', 'security', 'docs'],
  invariants: {
    chiefIsOnlyDelegator: true,
    securityIsReadOnly: true,
    agentsCannotApproveGates: true,
    noFalsePass: true,
    disjointWriteSets: true,
    noDirectPushToProtectedBranches: true,
    noAutoDeploy: true,
    productTestsAreNotExecutedHere: true,
  },
} as const

export type Manifesto = {
  apiVersion?: string
  stages: readonly string[]
  gates: {
    beforeMerge: { human: boolean; requiresEvidence: boolean; agentMayApprove: boolean }
  }
  agents: readonly string[]
  invariants: {
    chiefIsOnlyDelegator: boolean
    securityIsReadOnly: boolean
    agentsCannotApproveGates: boolean
    noFalsePass: boolean
    disjointWriteSets: boolean
    noDirectPushToProtectedBranches: boolean
    noAutoDeploy: boolean
    productTestsAreNotExecutedHere: boolean
  }
}

const ESTAGIOS = ['triage', 'specification', 'implementation', 'verification', 'human-review', 'delivery']

export function validarManifesto(manifesto: Manifesto = MANIFEST): { ok: boolean; falhas: string[] } {
  const falhas: string[] = []
  for (const estagio of ESTAGIOS) {
    if (!manifesto.stages.includes(estagio)) falhas.push(`Falta o estágio ${estagio}.`)
  }
  if (!manifesto.gates.beforeMerge.human || !manifesto.gates.beforeMerge.requiresEvidence) {
    falhas.push('Merge exige pessoa e evidência.')
  }
  if (manifesto.gates.beforeMerge.agentMayApprove) falhas.push('Agente não aprova o merge.')
  if (!manifesto.invariants.securityIsReadOnly) falhas.push('Segurança precisa ser somente leitura.')
  if (!manifesto.invariants.agentsCannotApproveGates) falhas.push('Agente não registra gate.')
  if (!manifesto.invariants.noFalsePass) falhas.push('PASS exige evidência observada.')
  if (!manifesto.invariants.disjointWriteSets) falhas.push('As escritas dos donos precisam ser disjuntas.')
  if (!manifesto.invariants.noDirectPushToProtectedBranches) falhas.push('Branch protegida não recebe push direto.')
  if (!manifesto.invariants.noAutoDeploy) falhas.push('Não há deploy automático.')
  if (!manifesto.invariants.productTestsAreNotExecutedHere) falhas.push('Teste de produto não roda nesta Factory.')
  if (!manifesto.invariants.chiefIsOnlyDelegator) falhas.push('Só o chief of staff delega.')
  if (!manifesto.agents.includes('security') || !manifesto.agents.includes('chief-of-staff')) {
    falhas.push('Faltam os papéis de chief of staff e segurança.')
  }
  return { ok: falhas.length === 0, falhas }
}
