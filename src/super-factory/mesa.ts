import { AgentController } from '@mastra/core/agent-controller'
import type { LibSQLStore } from '@mastra/libsql'

import { architect, backend, chiefOfStaff, docs, frontend, integrations, memoria, qa, security } from './agents/factory.ts'
import { habilidades } from './habilidades.ts'

const LEITURA = ['statusQuadro', 'lerLedger', 'lintarCriterios', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao']
const QUADRO = [...LEITURA, 'validarManifesto']
const TAREFAS = ['ask_user', 'task_write', 'task_update', 'task_complete', 'task_check']

export function criarMesa(storage: LibSQLStore) {
  return new AgentController({
    id: 'factory',
    storage,
    agent: chiefOfStaff,
    memory: memoria,
    workspace: habilidades,
    defaultModeId: 'chief-of-staff',
    disableBuiltinTools: ['submit_plan', 'subagent'],
    instructions: [
      'A Factory troca o papel, não o contrato.',
      'Portão, merge e deploy continuam fora daqui. O ciclo com pausa humana é o workflow sdlc.',
      'submit_plan não existe. Uma tarefa concluída nesta Factory não é uma aprovação.',
    ].join('\n'),
    modes: [
      {
        id: 'chief-of-staff',
        name: 'Chief of Staff',
        description: 'Abre card e encaminha. Não aprova portão.',
        agent: chiefOfStaff,
        metadata: { default: true },
        availableTools: [...TAREFAS, ...QUADRO, 'abrirCard', 'planejarOnda', 'avaliarPortaoMerge', 'listarGithub', 'listarAzure', 'criarIssueGithub', 'criarWorkItemAzure', 'registrarRegraProjeto', 'definirPoliticaProjeto', 'relatarMerge'],
      },
      {
        id: 'architect',
        name: 'Architect',
        description: 'Olha manifesto, onda e critérios.',
        agent: architect,
        availableTools: [...QUADRO, 'planejarOnda'],
      },
      {
        id: 'frontend',
        name: 'Frontend',
        description: 'Lê a fatia de UI.',
        agent: frontend,
        availableTools: LEITURA,
      },
      {
        id: 'backend',
        name: 'Backend',
        description: 'Lê a fatia de API.',
        agent: backend,
        availableTools: LEITURA,
      },
      {
        id: 'integrations',
        name: 'Integrations',
        description: 'Lista e abre issue ou work item. Não faz merge.',
        agent: integrations,
        availableTools: ['statusQuadro', 'lerLedger', 'lerBaseProjeto', 'lerPoliticaProjeto', 'listarGithub', 'listarAzure', 'criarIssueGithub', 'criarWorkItemAzure'],
      },
      {
        id: 'qa',
        name: 'QA',
        description: 'Lê evidência. Não transforma NOT_RUN em PASS.',
        agent: qa,
        availableTools: [...LEITURA, 'avaliarPortaoMerge', 'relatarMerge'],
      },
      {
        id: 'security',
        name: 'Security',
        description: 'Somente leitura.',
        agent: security,
        availableTools: [...QUADRO, 'avaliarPortaoMerge'],
      },
      {
        id: 'docs',
        name: 'Docs',
        description: 'Lê o quadro e o relatório.',
        agent: docs,
        availableTools: LEITURA,
      },
    ],
  })
}
