import { createStep, createWorkflow } from '@mastra/core/workflows'

import {
  decidirPortao,
  entregar,
  especificar,
  fechar,
  iniciar,
  planejar,
  revisar,
  verificar,
} from '../../factory/pipeline.ts'
import { estadoSchema, pausaSchema, pedidoSchema, retomadaSchema } from '../../factory/schemas.ts'
import type { Estado, Portao } from '../../factory/schemas.ts'
import { persistir } from '../../factory/store.ts'
import { evidenciaScorer, portoesScorer, relatorioScorer } from '../scorers/factory.ts'

const amostragem = { type: 'ratio' as const, rate: 1 }

const abrirCard = createStep({
  id: 'abrir-card',
  description: 'Faz a triagem. Card vago, com segredo ou com pedido de push protegido para na hora.',
  inputSchema: pedidoSchema,
  outputSchema: estadoSchema,
  execute: async ({ inputData }) => iniciar(inputData),
})

function passo(id: string, description: string, run: (estado: Estado) => Estado | Promise<Estado>) {
  return createStep({
    id,
    description,
    inputSchema: estadoSchema,
    outputSchema: estadoSchema,
    execute: async ({ inputData }) => persistir(await run(inputData)),
  })
}

function passoPortao(id: string, portao: Portao, description: string) {
  return createStep({
    id,
    description,
    inputSchema: estadoSchema,
    outputSchema: estadoSchema,
    resumeSchema: retomadaSchema,
    suspendSchema: pausaSchema,
    execute: async ({ inputData, resumeData, suspend }) => {
      const decisao = decidirPortao(inputData, portao, resumeData)
      if (decisao.acao === 'suspender') return await suspend(decisao.pausa)
      return persistir(decisao.estado)
    },
  })
}

const especificarPasso = passo('especificar', 'Registra a especificação. Não altera o repositório.', especificar)
const gateImplementacao = passoPortao(
  'gate-implementacao',
  'beforeImplementation',
  'Para até uma pessoa liberar a implementação.',
)
const planejarPasso = passo('planejar', 'Separa os donos e os caminhos. As escritas não se sobrepõem.', planejar)
const verificarPasso = passo(
  'verificar',
  'Registra os checks internos. Testes do produto ficam NOT_RUN: a fábrica não executa comando.',
  verificar,
)
const revisarPasso = passo('revisar', 'Segurança e revisão. Achado bloqueante impede o merge.', revisar)
const gateMerge = passoPortao('gate-merge', 'beforeMerge', 'Para até uma pessoa liberar o acompanhamento. Não faz merge.')
const entregarPasso = passo('entregar', 'Abre issue ou work item e, se houver branch, um pull request rascunho.', entregar)
const gateRelease = passoPortao('gate-release', 'beforeRelease', 'Para até uma pessoa aceitar o release. Não faz deploy.')

const fecharPasso = createStep({
  id: 'fechar',
  description: 'Fecha o relatório com o desfecho, a evidência e o que ainda falta.',
  inputSchema: estadoSchema,
  outputSchema: estadoSchema,
  scorers: {
    evidencia: { scorer: evidenciaScorer, sampling: amostragem },
    portoes: { scorer: portoesScorer, sampling: amostragem },
    relatorio: { scorer: relatorioScorer, sampling: amostragem },
  },
  execute: async ({ inputData }) => persistir(fechar(inputData)),
})

export const sdlcWorkflow = createWorkflow({
  id: 'sdlc',
  description: 'Conduz um card da triagem ao release, com três portões humanos. Não faz merge, push protegido nem deploy.',
  inputSchema: pedidoSchema,
  outputSchema: estadoSchema,
})
  .then(abrirCard)
  .then(especificarPasso)
  .then(gateImplementacao)
  .then(planejarPasso)
  .then(verificarPasso)
  .then(revisarPasso)
  .then(gateMerge)
  .then(entregarPasso)
  .then(gateRelease)
  .then(fecharPasso)
  .commit()
