import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Mastra } from '@mastra/core/mastra'
import { LibSQLStore } from '@mastra/libsql'
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability'

import { architect, backend, chiefOfStaff, docs, frontend, integrations, qa, security } from './agents/factory.ts'
import { marcaSuperFactory } from './marca.ts'
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
  },
  scorers: {
    evidencia: evidenciaScorer,
    portoes: portoesScorer,
    relatorio: relatorioScorer,
  },
  storage: new LibSQLStore({
    id: 'super-factory-storage',
    url: `file:${path.join(root, 'factory.db')}`,
  }),
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
    middleware: marcaSuperFactory,
  },
})
