import { z } from 'zod'

export const provedorSchema = z.enum(['github', 'azure-devops'])
export const colunaSchema = z.enum(['backlog', 'ready', 'build', 'qa', 'review', 'blocked', 'done'])
export const rotaSchema = z.enum(['clear', 'foggy', 'bug'])
export const grauSchema = z.enum(['easy', 'medium', 'hard'])
export const estagioSchema = z.enum([
  'triage',
  'specification',
  'implementation',
  'verification',
  'human-review',
  'delivery',
])
export const portaoSchema = z.enum(['beforeImplementation', 'beforeMerge', 'beforeRelease'])
export const resultadoSchema = z.enum(['PASS', 'FAIL', 'NOT_RUN', 'BLOCKED'])
export const evidenciaSchema = z.enum(['CURRENT', 'STALE', 'NONE'])
export const desfechoSchema = z.enum(['em-andamento', 'bloqueado', 'retido', 'aceito-com-ressalvas'])
export const donoSchema = z.enum(['frontend', 'backend', 'integrations', 'docs'])

export const cardSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  criterios: z.array(z.string()),
  coluna: colunaSchema,
  rota: rotaSchema,
  grau: grauSchema,
  provedor: provedorSchema,
  repositorio: z.string(),
  branchBase: z.string(),
  branchHead: z.string().nullable(),
  onda: z.number().nullable(),
  itemExterno: z.string().nullable(),
})

export const checkSchema = z.object({
  nome: z.string(),
  resultado: resultadoSchema,
  comando: z.string().nullable(),
  evidencia: z.string(),
})

export const achadoSchema = z.object({
  id: z.string(),
  severidade: z.enum(['blocking', 'note']),
  trilha: z.enum(['qa', 'review', 'security']),
  texto: z.string(),
})

export const fatiaSchema = z.object({
  dono: donoSchema,
  caminhos: z.array(z.string()),
})

export const aprovacaoSchema = z.object({
  portao: portaoSchema,
  aprovado: z.boolean(),
  aprovador: z.string(),
  nota: z.string(),
  origem: z.literal('human'),
  em: z.string(),
})

export const trilhaSchema = z.object({
  sequencia: z.number(),
  runId: z.string(),
  em: z.string(),
  estagio: estagioSchema,
  tipo: z.enum(['observed', 'reported', 'human']),
  resumo: z.string(),
  ator: z.string(),
})

export const entregaSchema = z.object({
  modo: z.enum(['fixture', 'live']),
  provedor: provedorSchema,
  ok: z.boolean(),
  itemId: z.string().nullable(),
  itemUrl: z.string().nullable(),
  pullRequestId: z.string().nullable(),
  pullRequestUrl: z.string().nullable(),
  nota: z.string(),
})

export const estadoSchema = z.object({
  runId: z.string(),
  card: cardSchema,
  estagio: estagioSchema,
  parado: z.boolean(),
  motivo: z.string().nullable(),
  desfecho: desfechoSchema,
  especificacao: z.string(),
  fatias: z.array(fatiaSchema),
  checks: z.array(checkSchema),
  achados: z.array(achadoSchema),
  aprovacoes: z.array(aprovacaoSchema),
  entrega: entregaSchema.nullable(),
  evidencia: evidenciaSchema,
  trilha: z.array(trilhaSchema),
  relatorio: z.string(),
  atualizadoEm: z.string(),
})

export const pedidoSchema = z.object({
  titulo: z.string().min(4).max(120).describe('Nome curto do card.'),
  descricao: z.string().min(20).max(4000).describe('O que muda, para quem, e o que fica de fora.'),
  criterios: z.string().min(4).max(4000).describe('Um critério de aceite por linha, com condição observável.'),
  provedor: provedorSchema.describe('Onde o acompanhamento vive.'),
  repositorio: z
    .string()
    .min(3)
    .max(140)
    .describe('GitHub: owner/repo. Azure DevOps: projeto ou projeto/repositorio. O endereço do repositório copiado do navegador também serve.'),
  branchBase: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe('Branch protegida de destino. Vazio significa main. A Factory não faz push nela.'),
  branchHead: z
    .string()
    .max(120)
    .optional()
    .describe('Branch já existente para um pull request rascunho. Sem isso, só abre o item de acompanhamento.'),
})

export const retomadaSchema = z.object({
  aprovado: z.boolean().describe('A pessoa aprova ou recusa este gate.'),
  aprovador: z.string().min(2).max(80).describe('Nome de quem decide. Um agente não preenche isto.'),
  nota: z.string().min(3).max(500).describe('Por que aprovou ou recusou.'),
})

export const pausaSchema = z.object({
  portao: portaoSchema,
  cardId: z.string(),
  resumo: z.string(),
  motivos: z.array(z.string()),
})

export type Provedor = z.infer<typeof provedorSchema>
export type Coluna = z.infer<typeof colunaSchema>
export type Rota = z.infer<typeof rotaSchema>
export type Grau = z.infer<typeof grauSchema>
export type Estagio = z.infer<typeof estagioSchema>
export type Portao = z.infer<typeof portaoSchema>
export type Resultado = z.infer<typeof resultadoSchema>
export type Evidencia = z.infer<typeof evidenciaSchema>
export type Desfecho = z.infer<typeof desfechoSchema>
export type Dono = z.infer<typeof donoSchema>
export type Card = z.infer<typeof cardSchema>
export type Check = z.infer<typeof checkSchema>
export type Achado = z.infer<typeof achadoSchema>
export type Fatia = z.infer<typeof fatiaSchema>
export type Aprovacao = z.infer<typeof aprovacaoSchema>
export type Evento = z.infer<typeof trilhaSchema>
export type Entrega = z.infer<typeof entregaSchema>
export type Estado = z.infer<typeof estadoSchema>
export type PedidoBruto = z.infer<typeof pedidoSchema>
export type Pausa = z.infer<typeof pausaSchema>

export type Pedido = {
  titulo: string
  descricao: string
  criterios: string[]
  provedor: Provedor
  repositorio: string
  branchBase: string
  branchHead: string | null
}
