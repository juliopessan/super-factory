import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Mastra } from '@mastra/core/mastra'
import { LibSQLStore } from '@mastra/libsql'
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter'
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability'

import { architect, backend, chiefOfStaff, docs, frontend, integrations, memoria, qa, security } from './agents/factory.ts'
import { marcaSuperFactory } from './marca.ts'
import { conhecimento, definirPoliticaProjeto, lerBaseProjeto, lerPoliticaProjeto, registrarRegraProjeto, relatarMerge } from './conhecimento.ts'
import { habilidades } from './habilidades.ts'
import { criarMesa } from './mesa.ts'
import { servidorMcp } from './mcp.ts'
import { evidenciaScorer, portoesScorer, relatorioScorer } from './scorers/factory.ts'
import {
  abrirCard,
  avaliarPortaoMerge,
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const storage = new LibSQLStore({
  id: 'super-factory-storage',
  url: `file:${path.join(root, 'factory.db')}`,
})

export const mastra = new Mastra({
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
  workflows: { sdlc: sdlcWorkflow },
  tools: {
    statusQuadro,
    validarManifesto,
    lintarCriterios,
    abrirCard,
    planejarOnda,
    avaliarPortaoMerge,
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
  },
  scorers: {
    evidencia: evidenciaScorer,
    portoes: portoesScorer,
    relatorio: relatorioScorer,
  },
  storage,
  memory: { mesa: memoria },
  workspace: habilidades,
  knowledge: { projeto: conhecimento },
  mcpServers: { 'super-factory': servidorMcp },
  agentControllers: { mesa: criarMesa(storage) },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'super-factory',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  server: {
    port: 4721,
    studioBase: '/studio',
    // Escuta em todas as interfaces. O Studio usa o endereço da página,
    // então o navegador fala com a mesma origem.
    host: '0.0.0.0',
    cors: false,
    apiRoutes: [...KNOWLEDGE_ROUTES],
    middleware: marcaSuperFactory,
  },
})
