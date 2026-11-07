import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { lintarCriterios as avaliarCriterios, planejarOnda as montarOnda, quadro } from '../../factory/board.ts'
import { listarIssuesGithub, criarIssueGithub as abrirIssueGithub } from '../../factory/github.ts'
import { listarWorkItemsAzure, criarWorkItemAzure as abrirWorkItemAzure, modoAzure } from '../../factory/azure.ts'
import { validarManifesto as checarManifesto } from '../../factory/manifest.ts'
import { avaliarMerge, iniciar } from '../../factory/pipeline.ts'
import { pedidoSchema } from '../../factory/schemas.ts'
import { lerEstado, lerRun } from '../../factory/store.ts'

function resumirQuadro(): string {
  return quadro(lerEstado().cards)
    .map((coluna) => `${coluna.coluna}: ${coluna.cards.map((card) => `${card.id} ${card.titulo}`).join(', ') || 'vazio'}`)
    .join('\n')
}

export const statusQuadro = createTool({
  id: 'status-quadro',
  description: 'Mostra o quadro da Factory: backlog, ready, build, qa, review, blocked e done.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    colunas: z.array(
      z.object({
        coluna: z.string(),
        cards: z.array(z.object({ id: z.string(), titulo: z.string(), rota: z.string(), grau: z.string() })),
      }),
    ),
    resumo: z.string(),
  }),
  execute: async () => {
    const colunas = quadro(lerEstado().cards)
    return { colunas, resumo: resumirQuadro() }
  },
})

export const validarManifesto = createTool({
  id: 'validar-manifesto',
  description: 'Confere se os gates humanos, a segurança somente leitura e a proibição de deploy automático seguem de pé.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    ok: z.boolean(),
    falhas: z.array(z.string()),
    github: z.enum(['fixture', 'live']),
    azure: z.enum(['fixture', 'live', 'incomplete']),
    resumo: z.string(),
  }),
  execute: async () => {
    const manifesto = checarManifesto()
    const github = process.env.GITHUB_TOKEN?.trim() ? ('live' as const) : ('fixture' as const)
    const azure = modoAzure()
    const resumo = manifesto.ok
      ? `Manifesto íntegro. GitHub em modo ${github}. Azure DevOps em modo ${azure}.`
      : `Manifesto violado: ${manifesto.falhas.join(' ')}`
    return { ...manifesto, github, azure, resumo }
  },
})

export const lintarCriterios = createTool({
  id: 'lintar-criterios',
  description: 'Avalia critérios de aceite. Rejeita texto vago, curto ou sem condição observável.',
  inputSchema: z.object({
    criterios: z.string().min(1).describe('Um critério por linha.'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()),
    resumo: z.string(),
  }),
  execute: async ({ criterios }) => {
    const linhas = criterios
      .split(/\r?\n/)
      .map((linha) => linha.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
    const lint = avaliarCriterios(linhas)
    return {
      ...lint,
      resumo: lint.ok ? 'Critérios observáveis.' : lint.issues.join(' '),
    }
  },
})

export const abrirCard = createTool({
  id: 'abrir-card',
  description: 'Abre um card no quadro. Não aprova gate, não faz merge e não executa o ciclo. O ciclo governado é o workflow sdlc.',
  inputSchema: pedidoSchema,
  outputSchema: z.object({
    runId: z.string(),
    cardId: z.string(),
    coluna: z.string(),
    desfecho: z.string(),
    motivo: z.string().nullable(),
    resumo: z.string(),
  }),
  execute: async (pedido) => {
    const estado = iniciar(pedido)
    const resumo = estado.parado
      ? `Card ${estado.card.id} bloqueado na triagem. ${estado.motivo}`
      : `Card ${estado.card.id} em ready. Para os gates humanos, rode o workflow sdlc com o mesmo pedido.`
    return {
      runId: estado.runId,
      cardId: estado.card.id,
      coluna: estado.card.coluna,
      desfecho: estado.desfecho,
      motivo: estado.motivo,
      resumo,
    }
  },
})

export const planejarOnda = createTool({
  id: 'planejar-onda',
  description: 'Lista até cinco cards em ready. Não move card e não pula gate.',
  inputSchema: z.object({
    limite: z.number().int().min(1).max(5).optional().describe('Quantos cards, no máximo cinco.'),
  }),
  outputSchema: z.object({
    onda: z.number(),
    limite: z.number(),
    cardIds: z.array(z.string()),
    resumo: z.string(),
  }),
  execute: async ({ limite }) => {
    const plano = montarOnda(lerEstado().cards, limite ?? 3)
    return {
      ...plano,
      resumo: plano.cardIds.length ? `Onda ${plano.onda}: ${plano.cardIds.join(', ')}.` : 'Nenhum card em ready.',
    }
  },
})

export const avaliarGateMerge = createTool({
  id: 'avaliar-gate-merge',
  description: 'Lê se um ciclo já tem as aprovações humanas e a evidência para o merge. Não aprova.',
  inputSchema: z.object({
    runId: z.string().min(2).describe('Identificador do ciclo, no formato R-3.'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    motivos: z.array(z.string()),
    resumo: z.string(),
  }),
  execute: async ({ runId }) => {
    const estado = lerRun(runId)
    if (!estado) return { ok: false, motivos: ['Ciclo não encontrado.'], resumo: `Não achei o ciclo ${runId}.` }
    const avaliacao = avaliarMerge(estado)
    return {
      ...avaliacao,
      resumo: avaliacao.ok
        ? 'As condições do merge estão presentes. Quem decide é a pessoa, no workflow. A política é entrega humana. Este parecer não funde.'
        : `${avaliacao.motivos.join(' ')} A política é entrega humana. Este parecer não funde.`,
    }
  },
})

export const lerLedger = createTool({
  id: 'ler-ledger',
  description: 'Lê a trilha do ciclo. A trilha registra o que foi observado; não é prova por si só.',
  inputSchema: z.object({
    runId: z.string().optional().describe('Se vazio, devolve os eventos mais recentes.'),
  }),
  outputSchema: z.object({
    eventos: z.array(
      z.object({
        runId: z.string(),
        tipo: z.string(),
        ator: z.string(),
        resumo: z.string(),
      }),
    ),
    resumo: z.string(),
  }),
  execute: async ({ runId }) => {
    const eventos = lerEstado()
      .ledger.filter((evento) => (runId ? evento.runId === runId : true))
      .slice(-20)
      .map((evento) => ({ runId: evento.runId, tipo: evento.tipo, ator: evento.ator, resumo: evento.resumo }))
    return {
      eventos,
      resumo: eventos.length ? eventos.map((evento) => `${evento.runId} ${evento.tipo}: ${evento.resumo}`).join('\n') : 'Trilha vazia.',
    }
  },
})

export const listarGithub = createTool({
  id: 'listar-github',
  description: 'Lista issues abertas. Sem GITHUB_TOKEN, devolve uma amostra e avisa que nada foi lido no GitHub.',
  inputSchema: z.object({
    repositorio: z.string().min(3).describe('owner/repo'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    modo: z.string(),
    nota: z.string(),
    itens: z.array(z.object({ id: z.string(), titulo: z.string(), estado: z.string(), url: z.string().nullable() })),
    resumo: z.string(),
  }),
  execute: async ({ repositorio }) => {
    const lista = await listarIssuesGithub(repositorio)
    return { ...lista, resumo: lista.nota }
  },
})

export const criarIssueGithub = createTool({
  id: 'criar-issue-github',
  description: 'Abre uma issue. Não abre pull request, não faz merge e não faz push. Uma pessoa aprova antes de rodar.',
  requireApproval: true,
  inputSchema: z.object({
    repositorio: z.string().min(3),
    titulo: z.string().min(4).max(120),
    corpo: z.string().min(10).max(4000),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    modo: z.string(),
    id: z.string().nullable(),
    url: z.string().nullable(),
    nota: z.string(),
    resumo: z.string(),
  }),
  execute: async ({ repositorio, titulo, corpo }) => {
    const criado = await abrirIssueGithub(repositorio, titulo, corpo)
    return { ...criado, resumo: criado.nota }
  },
})

export const listarAzure = createTool({
  id: 'listar-azure',
  description: 'Lista work items abertos. Sem AZURE_DEVOPS_PAT, devolve uma amostra e avisa que nada foi lido.',
  inputSchema: z.object({
    projeto: z.string().min(1).describe('Nome do projeto, ou projeto/repositorio.'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    modo: z.string(),
    nota: z.string(),
    itens: z.array(z.object({ id: z.string(), titulo: z.string(), estado: z.string(), url: z.string().nullable() })),
    resumo: z.string(),
  }),
  execute: async ({ projeto }) => {
    const lista = await listarWorkItemsAzure(projeto)
    return { ...lista, resumo: lista.nota }
  },
})

export const criarWorkItemAzure = createTool({
  id: 'criar-work-item-azure',
  description: 'Abre uma user story. Não faz merge e não coloca nada em produção. Uma pessoa aprova antes de rodar.',
  requireApproval: true,
  inputSchema: z.object({
    projeto: z.string().min(1),
    titulo: z.string().min(4).max(120),
    corpo: z.string().min(10).max(4000),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    modo: z.string(),
    id: z.string().nullable(),
    url: z.string().nullable(),
    nota: z.string(),
    resumo: z.string(),
  }),
  execute: async ({ projeto, titulo, corpo }) => {
    const criado = await abrirWorkItemAzure(projeto, titulo, corpo)
    return { ...criado, resumo: criado.nota }
  },
})
