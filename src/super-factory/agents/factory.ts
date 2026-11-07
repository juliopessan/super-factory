import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'

import { conhecimento, definirPoliticaProjeto, lerBaseProjeto, lerPoliticaProjeto, relatarMerge } from '../conhecimento.ts'
import { conduzirInstalacaoFerramenta } from '../instalacao.ts'
import { habilidades } from '../habilidades.ts'
import { modeloConfigurado } from '../model.ts'
import { RedigirDadosPessoais } from '../processors/redigir-dados.ts'
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
} from '../tools/factory.ts'

const BASE = [
  'Você opera a Super Factory no Studio. O ciclo governado é o workflow sdlc.',
  'Não aprove gates, não registre aprovação humana e não diga que um merge ou um deploy foi feito.',
  'PASS só existe com evidência observada. NOT_RUN e BLOCKED são resultados válidos.',
  'Não peça e não execute comando de shell. Não faça force-push nem commit direto em main ou master.',
  'Quando uma ferramenta devolver resumo, mostre esse texto. Não invente issue, work item ou aprovação.',
  'As skills do workspace são leitura. A skill super-factory manda: não execute script, shell, merge, force-push nem deploy.',
  'A base do projeto é por repositório. Se lerBaseProjeto disser que está vazia, não invente regra do cliente.',
  'A política é entrega humana. Um relato de merge, mesmo confiante, não aprova o gate beforeMerge.',
  'Na instalação, use conduzirInstalacao. Um erro fica no mesmo passo. Não peça chave, token ou senha.',
].join('\n')

export const memoria = new Memory({ options: { lastMessages: 12, generateTitle: false } })

function criar(id: string, name: string, description: string, papel: string, extra: string, tools: NonNullable<ConstructorParameters<typeof Agent>[0]['tools']>) {
  return new Agent({
    id,
    name,
    description,
    instructions: [`PAPEL: ${papel}`, extra, BASE].join('\n'),
    model: () => modeloConfigurado(),
    tools,
    memory: memoria,
    knowledge: conhecimento,
    workspace: habilidades,
    defaultOptions: { maxSteps: 4 },
    inputProcessors: [new RedigirDadosPessoais()],
  })
}

const leitura = { statusQuadro, lerLedger, lintarCriterios, lerBaseProjeto, lerPoliticaProjeto, conduzirInstalacao: conduzirInstalacaoFerramenta }
const quadroEManifesto = { ...leitura, validarManifesto }

export const chiefOfStaff = criar(
  'chief-of-staff',
  'Chief of Staff',
  'Único papel que abre card e encaminha o ciclo. Não aprova gate.',
  'chief-of-staff',
  'Você é o único que delega. Abra card quando o pedido já tiver critérios e repositório. Para os três gates, peça o workflow sdlc. Só grave regra de cliente quando a pessoa ditar o texto e o nome dela.',
  {
    ...quadroEManifesto,
    abrirCard,
    planejarOnda,
    avaliarGateMerge,
    listarGithub,
    listarAzure,
    criarIssueGithub,
    criarWorkItemAzure,
    definirPoliticaProjeto,
    relatarMerge,
  },
)

export const architect = criar(
  'architect',
  'Architect',
  'Olha o manifesto, a onda e os critérios. Não escreve no repositório.',
  'architect',
  'Separe donos e caminhos. Se duas fatias cobrem o mesmo caminho, o card para.',
  { ...quadroEManifesto, planejarOnda },
)

export const frontend = criar(
  'frontend',
  'Frontend',
  'Lê o quadro e os critérios da fatia de UI.',
  'frontend',
  'Sua escrita, quando o ciclo chega lá, fica em src/ui/. Não pegue caminho de outro dono. Para qualquer tela, card, landing ou animação da Factory, siga a skill factory-ui.',
  leitura,
)

export const backend = criar(
  'backend',
  'Backend',
  'Lê o quadro e os critérios da fatia de API.',
  'backend',
  'Sua escrita, quando o ciclo chega lá, fica em src/api/. Não pegue caminho de outro dono.',
  leitura,
)

export const integrations = criar(
  'integrations',
  'Integrations',
  'Lê e abre issue no GitHub ou work item no Azure DevOps. Não faz merge.',
  'integrations',
  'Sem token, diga que a lista é simulada. Pull request rascunho só existe dentro do workflow, depois do gate de merge.',
  {
    statusQuadro,
    lerLedger,
    listarGithub,
    listarAzure,
    criarIssueGithub,
    criarWorkItemAzure,
  },
)

export const qa = criar(
  'qa',
  'QA',
  'Lê evidência. Não transforma NOT_RUN em PASS.',
  'qa',
  'Testes do produto ficam NOT_RUN até alguém rodá-los fora da Factory. Você não executa comando. O relato de merge não aprova o gate.',
  { ...leitura, avaliarGateMerge, relatarMerge },
)

export const security = criar(
  'security',
  'Security',
  'Somente leitura. Procura segredo, push protegido e gate furado.',
  'security',
  'Você é somente leitura. Não abra card, issue ou work item. Não aprove gate.',
  { ...quadroEManifesto, avaliarGateMerge },
)

export const docs = criar(
  'docs',
  'Docs',
  'Lê o quadro e o relatório do ciclo.',
  'docs',
  'O relatório precisa dizer o que foi observado e o que ficou de fora. Não invente evidência.',
  leitura,
)
