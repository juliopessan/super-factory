import { createStep, createWorkflow } from '@mastra/core/workflows'

import { executarAutonomo, type DepsAutonomo } from '../../factory/autonomo.ts'
import { parar, iniciar } from '../../factory/pipeline.ts'
import { criarExecutorDocker } from '../../factory/sandbox.ts'
import { estadoSchema, pedidoSchema } from '../../factory/schemas.ts'
import { persistir } from '../../factory/store.ts'
import { implementadorComAgente } from '../agents/construtor.ts'

/** Dependências de verdade: Docker local, agente construtor e credenciais do ambiente. */
export function depsDoAmbiente(): DepsAutonomo {
  return {
    criarExecutor: (cardId) => criarExecutorDocker({ cardId }),
    implementador: implementadorComAgente,
    credenciais: {
      githubToken: process.env.GITHUB_TOKEN,
      azureOrg: process.env.AZURE_DEVOPS_ORG,
      azurePat: process.env.AZURE_DEVOPS_PAT,
    },
  }
}

const conduzir = createStep({
  id: 'conduzir-ate-o-pr',
  description:
    'Triagem, clone num container Docker, implementação pelo agente construtor, testes do repositório e pull request. Para no primeiro bloqueio. Merge fica com uma pessoa.',
  inputSchema: pedidoSchema,
  outputSchema: estadoSchema,
  execute: async ({ inputData }) => {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.SUPER_FACTORY_BUILDER_MODEL) {
      return persistir(parar(iniciar(inputData), 'O modo autônomo precisa de ANTHROPIC_API_KEY para o agente construtor escrever código.'))
    }
    const { estado } = await executarAutonomo(inputData, depsDoAmbiente())
    return persistir(estado)
  },
})

export const autonomoWorkflow = createWorkflow({
  id: 'autonomo',
  description:
    'Modo autônomo: do pedido ao pull request sem gate intermediário. Código e testes rodam num container Docker. A Factory nunca faz merge nem deploy.',
  inputSchema: pedidoSchema,
  outputSchema: estadoSchema,
})
  .then(conduzir)
  .commit()
