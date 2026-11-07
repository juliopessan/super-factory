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
import { conduzirInstalacaoFerramenta } from './instalacao.ts'
import { criarFactory } from './controle.ts'
import { servidorMcp } from './mcp.ts'
import { evidenciaScorer, portoesScorer, relatorioScorer } from './scorers/factory.ts'
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
  scorers: {
    evidencia: evidenciaScorer,
    portoes: portoesScorer,
    relatorio: relatorioScorer,
  },
  storage,
  memory: { factory: memoria },
  workspace: habilidades,
  knowledge: { projeto: conhecimento },
  mcpServers: { 'super-factory': servidorMcp },
  agentControllers: { factory: criarFactory(storage) },
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
    // Por padrão, só este computador abre a Factory: o Studio não tem login.
    // SUPER_FACTORY_HOST=0.0.0.0 libera para a rede, de propósito.
    host: process.env.SUPER_FACTORY_HOST?.trim() || 'localhost',
    cors: false,
    apiRoutes: [...KNOWLEDGE_ROUTES],
    middleware: marcaSuperFactory,
  },
})
