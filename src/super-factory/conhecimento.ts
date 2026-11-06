import { createTool } from '@mastra/core/tools'
import { Knowledge, knowledgeMemoryScopes, listKnowledgeTreeChildren } from '@mastra/core/knowledge'
import type { KnowledgePage, KnowledgeReadScope } from '@mastra/core/knowledge'
import { z } from 'zod'

import { segmento, validarBranch, varrerSegredos } from '../factory/guards.ts'

const PAPEIS = new Set([
  'chief-of-staff',
  'chief of staff',
  'architect',
  'frontend',
  'backend',
  'integrations',
  'qa',
  'security',
  'docs',
  'agente',
  'agent',
])

export const conhecimento = new Knowledge({
  id: 'projeto',
  name: 'Projeto',
  description:
    'Regras do cliente, uma base por repositório. Quem preenche é uma pessoa. Os papéis só leem. Base vazia não vira regra inventada.',
  scopes: {
    ...knowledgeMemoryScopes(),
    'leitura:$repositorio': {
      description: 'Leitura da base deste repositório.',
      access: [{ principal: 'self', role: 'viewer' }],
    },
    'projeto:$repositorio': {
      description: 'Regras que este cliente já decidiu.',
      displayLabel: 'Projeto',
      access: [{ principal: 'leitura:$repositorio', role: 'viewer' }],
    },
  },
  tools: { read: true },
})

export function slugRepositorio(repositorio: string): string {
  const partes = repositorio.trim().split('/')
  if (partes.length < 1 || partes.length > 2) throw new Error('Repositório inválido.')
  return partes.map((parte, indice) => segmento(parte, indice === 0 ? 'Dono' : 'Repositório')).join('__')
}

function autorHumano(autor: string): string {
  const nome = autor.trim()
  if (nome.length < 2 || nome.length > 60 || !/^[\p{L}][\p{L}\s.'-]{1,59}$/u.test(nome)) {
    throw new Error('A regra precisa do nome de uma pessoa.')
  }
  if (PAPEIS.has(nome.toLowerCase())) throw new Error('Um papel da mesa não registra regra de cliente.')
  return nome
}

function pedeMergeAutomatico(texto: string): boolean {
  return /merge\s+when\s+confident|merge\s+autom[aá]tico|auto-?merge|a f[aá]brica (funde|faz merge)|autonomia\s*:\s*auto/i.test(texto)
}

function chaveRegra(chave: string): string {
  const limpa = chave.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(limpa) || limpa.length > 40) throw new Error('Chave de regra inválida.')
  return limpa
}

async function filhos(parentId: string | null, read: KnowledgeReadScope): Promise<KnowledgePage[]> {
  const store = await conhecimento.getStorage()
  const paginas: KnowledgePage[] = []
  let cursor: string | undefined
  do {
    const nivel = await listKnowledgeTreeChildren(store, { parentId, read, cursor, limit: 50 })
    paginas.push(...nivel.pages)
    cursor = nivel.nextCursor
  } while (cursor)
  return paginas
}

async function regrasDoEscopo(scopeId: string, read: KnowledgeReadScope, caminho: string[]): Promise<string[]> {
  const linhas: string[] = []
  for (const pagina of await filhos(scopeId, read)) {
    if (pagina.isScope) continue
    const proximo = pagina.key ? [...caminho, pagina.key] : caminho
    if (pagina.body?.trim()) {
      linhas.push(`- ${proximo.join('/')} — ${pagina.name}\n${pagina.body.trim()}`)
    }
    linhas.push(...(await regrasDoEscopo(pagina.id, read, proximo)))
  }
  return linhas
}

export async function lerBaseDoProjeto(repositorio: string): Promise<{ resumo: string }> {
  const slug = slugRepositorio(repositorio)
  const read = await conhecimento.readScopeFor([`leitura:${slug}`])
  const raiz = (await filhos(null, read)).find((pagina) => pagina.address === `projeto:${slug}`)
  const regras = raiz ? await regrasDoEscopo(raiz.id, read, []) : []
  if (regras.length === 0) {
    return {
      resumo: `A base de ${repositorio.trim()} está vazia. Quem registra a regra é uma pessoa. A fábrica não inventa regra de cliente.`,
    }
  }
  return { resumo: `Base de ${repositorio.trim()}\n${regras.join('\n')}` }
}

export async function registrarRegraDoProjeto(entrada: {
  repositorio: string
  autor: string
  chave: string
  nome: string
  texto: string
}): Promise<{ resumo: string }> {
  const slug = slugRepositorio(entrada.repositorio)
  const autor = autorHumano(entrada.autor)
  const chave = chaveRegra(entrada.chave)
  const nome = entrada.nome.trim()
  const texto = entrada.texto.trim()
  if (nome.length < 2 || nome.length > 80) throw new Error('Nome da regra inválido.')
  if (texto.length < 20 || texto.length > 4000) throw new Error('A regra precisa do texto que a pessoa ditou.')
  if (pedeMergeAutomatico(`${nome}\n${texto}`)) throw new Error('A política desta fábrica é entrega humana.')
  if (varrerSegredos(texto).encontrado || varrerSegredos(nome).encontrado) throw new Error('A regra não guarda segredo.')
  await conhecimento.upsertPage({
    scope: `projeto:${slug}`,
    path: `regras/${chave}`,
    name: nome,
    body: texto,
    author: autor,
  })
  return { resumo: `Regra ${chave} gravada em ${entrada.repositorio.trim()} por ${autor}. Isso não aprova portão.` }
}

const POLITICA_PADRAO = [
  'Autonomia: entrega humana.',
  'Branch protegida: main.',
  'Checks que o cliente nomeou: nenhum.',
  'A fábrica não executa esses checks e não funde.',
].join('\n')

async function corpoDaPagina(repositorio: string, chave: string): Promise<string | null> {
  const slug = slugRepositorio(repositorio)
  const read = await conhecimento.readScopeFor([`leitura:${slug}`])
  const raiz = (await filhos(null, read)).find((pagina) => pagina.address === `projeto:${slug}`)
  if (!raiz) return null
  const paginas = await regrasDoEscopo(raiz.id, read, [])
  const linha = paginas.find((item) => item.startsWith(`- ${chave} `) || item.startsWith(`- ${chave}\n`))
  if (!linha) return null
  const corpo = linha.split('\n').slice(1).join('\n').trim()
  return corpo || null
}

export async function lerPoliticaDoProjeto(repositorio: string): Promise<{ resumo: string }> {
  slugRepositorio(repositorio)
  const gravada = await corpoDaPagina(repositorio, 'politica')
  const resumo = gravada ?? `Base de ${repositorio.trim()} sem política gravada.\n${POLITICA_PADRAO}`
  return { resumo }
}

export async function definirPoliticaDoProjeto(entrada: {
  repositorio: string
  autor: string
  branch?: string
  checks?: string
}): Promise<{ resumo: string }> {
  const slug = slugRepositorio(entrada.repositorio)
  const autor = autorHumano(entrada.autor)
  const branch = validarBranch(entrada.branch?.trim() || 'main')
  const checks = entrada.checks?.trim() ?? ''
  if (checks && (checks.length < 10 || checks.length > 500)) throw new Error('Os checks nomeados precisam do texto que a pessoa ditou.')
  if (pedeMergeAutomatico(checks)) throw new Error('A política desta fábrica é entrega humana.')
  if (checks && varrerSegredos(checks).encontrado) throw new Error('A política não guarda segredo.')
  const corpo = [
    'Autonomia: entrega humana.',
    `Branch protegida: ${branch}.`,
    checks ? `Checks que o cliente nomeou: ${checks}` : 'Checks que o cliente nomeou: nenhum.',
    'A fábrica não executa esses checks e não funde.',
  ].join('\n')
  await conhecimento.upsertPage({
    scope: `projeto:${slug}`,
    path: 'politica',
    name: 'Política',
    body: corpo,
    author: autor,
  })
  return { resumo: `Política de ${entrada.repositorio.trim()} gravada por ${autor}. Autonomia: entrega humana. Isso não aprova portão.` }
}

export async function relatarMergeDoProjeto(entrada: {
  repositorio: string
  papel: 'qa' | 'chief-of-staff'
  interpretacao: string
  premissas: string[]
  confianca: 'confiante' | 'entrega'
  motivo?: string
}): Promise<{ resumo: string }> {
  const slug = slugRepositorio(entrada.repositorio)
  if (entrada.papel !== 'qa' && entrada.papel !== 'chief-of-staff') throw new Error('Só QA ou o Chief of Staff relatam o merge.')
  const interpretacao = entrada.interpretacao.trim()
  const premissas = entrada.premissas.map((item) => item.trim()).filter(Boolean)
  const motivo = entrada.motivo?.trim() ?? ''
  if (interpretacao.length < 20 || interpretacao.length > 2000) throw new Error('A interpretação precisa dizer como o pedido foi lido.')
  if (premissas.length < 1 || premissas.length > 6 || premissas.some((item) => item.length < 5 || item.length > 300)) {
    throw new Error('O relato precisa das premissas, uma por item.')
  }
  if (entrada.confianca === 'entrega' && motivo.length < 10) throw new Error('Sem confiança, o relato diz o motivo da entrega.')
  if (entrada.confianca !== 'confiante' && entrada.confianca !== 'entrega') throw new Error('A confiança é confiante ou entrega.')
  const texto = [interpretacao, ...premissas, motivo].join('\n')
  if (varrerSegredos(texto).encontrado) throw new Error('O relato não guarda segredo.')
  const corpo = [
    `Interpretação: ${interpretacao}`,
    'Premissas:',
    ...premissas.map((item) => `- ${item}`),
    `Confiança: ${entrada.confianca}.`,
    motivo ? `Motivo: ${motivo}` : 'Motivo: nenhum.',
    'Este relato não aprova o portão beforeMerge. A política é entrega humana.',
  ].join('\n')
  await conhecimento.upsertPage({
    scope: `projeto:${slug}`,
    path: 'relatorio/merge',
    name: 'Relato de merge',
    body: corpo,
    author: entrada.papel,
  })
  return {
    resumo: `Relato de merge gravado em ${entrada.repositorio.trim()}. Confiança: ${entrada.confianca}. Isso não aprova o portão.`,
  }
}

export const lerPoliticaProjeto = createTool({
  id: 'ler-politica-projeto',
  description: 'Lê a política do repositório. A autonomia é sempre entrega humana.',
  inputSchema: z.object({
    repositorio: z.string().describe('GitHub: owner/repo. Azure: projeto ou projeto/repositorio.'),
  }),
  outputSchema: z.object({ resumo: z.string() }),
  execute: async ({ repositorio }) => lerPoliticaDoProjeto(repositorio),
})

export const definirPoliticaProjeto = createTool({
  id: 'definir-politica-projeto',
  description: 'Grava a política que uma pessoa ditou. A autonomia continua entrega humana. Não liga merge automático.',
  inputSchema: z.object({
    repositorio: z.string(),
    autor: z.string().describe('Nome da pessoa que ditou a política.'),
    branch: z.string().optional().describe('Branch protegida. Sem valor, fica main.'),
    checks: z.string().optional().describe('Checks que o cliente já usa. A fábrica não os executa.'),
  }),
  outputSchema: z.object({ resumo: z.string() }),
  execute: async (entrada) => definirPoliticaDoProjeto(entrada),
})

export const relatarMerge = createTool({
  id: 'relatar-merge',
  description: 'Grava interpretação, premissas e confiança sobre um pedido. Não aprova o portão de merge.',
  inputSchema: z.object({
    repositorio: z.string(),
    papel: z.enum(['qa', 'chief-of-staff']),
    interpretacao: z.string(),
    premissas: z.array(z.string()).min(1).max(6),
    confianca: z.enum(['confiante', 'entrega']),
    motivo: z.string().optional().describe('Obrigatório quando a confiança é entrega.'),
  }),
  outputSchema: z.object({ resumo: z.string() }),
  execute: async (entrada) => relatarMergeDoProjeto(entrada),
})

export const lerBaseProjeto = createTool({
  id: 'ler-base-projeto',
  description: 'Lê as regras do cliente para um repositório. Base vazia continua vazia.',
  inputSchema: z.object({
    repositorio: z.string().describe('GitHub: owner/repo. Azure: projeto ou projeto/repositorio.'),
  }),
  outputSchema: z.object({ resumo: z.string() }),
  execute: async ({ repositorio }) => lerBaseDoProjeto(repositorio),
})

export const registrarRegraProjeto = createTool({
  id: 'registrar-regra-projeto',
  description: 'Grava uma regra que uma pessoa ditou para o repositório dela. O autor é o nome dessa pessoa, nunca um papel da mesa.',
  inputSchema: z.object({
    repositorio: z.string(),
    autor: z.string().describe('Nome da pessoa que ditou a regra.'),
    chave: z.string().describe('Identificador curto, como escrita ou pastas.'),
    nome: z.string(),
    texto: z.string().describe('O texto da regra, como a pessoa disse.'),
  }),
  outputSchema: z.object({ resumo: z.string() }),
  execute: async (entrada) => registrarRegraDoProjeto(entrada),
})
