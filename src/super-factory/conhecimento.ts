import { createTool } from '@mastra/core/tools'
import { Knowledge, knowledgeMemoryScopes, listKnowledgeTreeChildren } from '@mastra/core/knowledge'
import type { KnowledgePage, KnowledgeReadScope } from '@mastra/core/knowledge'
import { z } from 'zod'

import { segmento, varrerSegredos } from '../factory/guards.ts'

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
