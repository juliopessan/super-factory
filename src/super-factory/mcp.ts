import { MCPServer } from '@mastra/mcp'

import { architect, backend, chiefOfStaff, docs, frontend, integrations, qa, security } from './agents/factory.ts'
import { definirPoliticaProjeto, lerBaseProjeto, lerPoliticaProjeto, registrarRegraProjeto, relatarMerge } from './conhecimento.ts'
import { conduzirInstalacaoFerramenta } from './instalacao.ts'
import {
  abrirCard,
  avaliarGateMerge,
  lerArquivoGithub,
  lerLedger,
  lerProjetoGithub,
  lintarCriterios,
  listarArquivosGithub,
  listarAzure,
  listarBranchesGithub,
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
  'Não há ferramenta de shell, merge, force-push ou deploy. A única decisão humana do ciclo é o merge.',
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
  // As ferramentas que escrevem (criar issue, criar work item, organizar o Project) ficam fora: quem fala
  // com este servidor MCP não passa pelo login do Studio nem pela conversa com um agente. Só leitura sai daqui.
  tools: {
    statusQuadro,
    validarManifesto,
    lintarCriterios,
    abrirCard,
    planejarOnda,
    avaliarGateMerge,
    lerLedger,
    listarGithub,
    listarAzure,
    listarBranchesGithub,
    listarArquivosGithub,
    lerArquivoGithub,
    lerProjetoGithub,
    lerBaseProjeto,
    registrarRegraProjeto,
    lerPoliticaProjeto,
    definirPoliticaProjeto,
    relatarMerge,
    conduzirInstalacao: conduzirInstalacaoFerramenta,
  },
  workflows: { sdlc: sdlcWorkflow },
})
