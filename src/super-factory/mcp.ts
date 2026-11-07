import { MCPServer } from '@mastra/mcp'

import { architect, backend, chiefOfStaff, docs, frontend, integrations, qa, security } from './agents/factory.ts'
import { definirPoliticaProjeto, lerBaseProjeto, lerPoliticaProjeto, registrarRegraProjeto, relatarMerge } from './conhecimento.ts'
import { conduzirInstalacaoFerramenta } from './instalacao.ts'
import {
  abrirCard,
  avaliarGateMerge,
  criarIssueGithub,
  criarWorkItemAzure,
  lerLedger,
  lintarCriterios,
  listarAzure,
  listarGithub,
  planejarOnda,
  statusQuadro,
  validarManifesto,
} from './tools/factory.ts'
import { sdlcWorkflow } from './workflows/sdlc.ts'

const INSTRUCOES = [
  'Este servidor é a Super Factory.',
  'O ciclo governado é o workflow sdlc. Ele suspende em implementação, merge e release.',
  'Quem retoma um gate é uma pessoa, com aprovado, aprovador e nota. Um agente não aprova.',
  'Não há ferramenta de shell, merge, force-push ou deploy.',
  'Sem credencial, GitHub e Azure DevOps respondem em modo simulado e dizem isso.',
].join('\n')

export const servidorMcp = new MCPServer({
  id: 'super-factory',
  name: 'Super Factory',
  version: '1.0.0',
  description: 'Quadro, gates humanos, GitHub, Azure DevOps e o workflow sdlc. Sem merge, sem deploy e sem shell.',
  instructions: INSTRUCOES,
  websiteUrl: 'https://github.com/juliopessan/super-factory',
  repository: {
    url: 'https://github.com/juliopessan/super-factory',
    source: 'github',
    id: 'juliopessan/super-factory',
  },
  agents: {
    chiefOfStaff,
    architect,
    frontend,
    backend,
    integrations,
    qa,
    security,
    docs,
  },
  tools: {
    statusQuadro,
    validarManifesto,
    lintarCriterios,
    abrirCard,
    planejarOnda,
    avaliarGateMerge,
    lerLedger,
    listarGithub,
    criarIssueGithub,
    listarAzure,
    criarWorkItemAzure,
    lerBaseProjeto,
    registrarRegraProjeto,
    lerPoliticaProjeto,
    definirPoliticaProjeto,
    relatarMerge,
    conduzirInstalacao: conduzirInstalacaoFerramenta,
  },
  workflows: { sdlc: sdlcWorkflow },
})
