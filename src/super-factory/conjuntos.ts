// Conjunto inicial do Studio (Datasets): casos de critério de aceite com o veredito esperado do lint.
// Serve de base para medir a triagem: o Studio deixa de abrir vazio e quem quiser roda um experimento em cima.

import type { Mastra } from '@mastra/core/mastra'

import { CARDS_DE_OURO, DIFFS_DE_OURO } from '../factory/evals.ts'

export const ID_CONJUNTO_CRITERIOS = 'criterios-de-aceite'
export const ID_CONJUNTO_CARDS_DE_OURO = 'cards-de-ouro'
export const ID_CONJUNTO_REVISAO_DE_OURO = 'revisao-de-ouro'

export type CasoDeCriterio = { nome: string; criterios: string[]; ok: boolean }

export const CASOS_DE_CRITERIOS: CasoDeCriterio[] = [
  { nome: 'critério observável', criterios: ['Quando o filtro por status for aplicado, a lista deve mostrar só os cards daquele status'], ok: true },
  { nome: 'dois critérios com número', criterios: ['A busca devolve no máximo 20 resultados por página', 'Quando não houver resultado, a tela mostra a mensagem "Nada encontrado"'], ok: true },
  { nome: 'recusa explícita', criterios: ['A API recusa o pedido sem token e retorna 401'], ok: true },
  { nome: 'sem critério', criterios: [], ok: false },
  { nome: 'curto demais', criterios: ['Funciona'], ok: false },
  { nome: 'vago', criterios: ['Deve ficar bom, se possível, depois a gente vê'], ok: false },
  { nome: 'sem condição observável', criterios: ['Ficar bonito e agradável para o usuário final'], ok: false },
  { nome: 'pendência escondida', criterios: ['O relatório deve ser exportado em CSV, TBD o formato das colunas'], ok: false },
]

/** Cria cada conjunto uma vez. Não mexe no que já existe, para não apagar o que a pessoa editou no Studio. */
export async function semearConjuntos(mastra: Mastra): Promise<'criado' | 'existente'> {
  const novos = [await semearCriterios(mastra), await semearDeOuro(mastra)]
  return novos.includes('criado') ? 'criado' : 'existente'
}

async function semearDeOuro(mastra: Mastra): Promise<'criado' | 'existente'> {
  let criou = false
  try {
    await mastra.datasets.get({ id: ID_CONJUNTO_CARDS_DE_OURO })
  } catch {
    const cards = await mastra.datasets.create({ id: ID_CONJUNTO_CARDS_DE_OURO, name: 'Cards de ouro (triagem)', description: 'Pedidos com a rota e o lint esperados. Rode um experimento com o scorer "triagem" para medir a triagem.' })
    await cards.addItems({ items: CARDS_DE_OURO.map((c) => ({ input: { nome: c.nome, titulo: c.titulo, descricao: c.descricao, criterios: c.criterios }, groundTruth: { rota: c.rota, ok: c.lintOk } })) })
    criou = true
  }
  try {
    await mastra.datasets.get({ id: ID_CONJUNTO_REVISAO_DE_OURO })
  } catch {
    const revisao = await mastra.datasets.create({ id: ID_CONJUNTO_REVISAO_DE_OURO, name: 'Diffs de ouro (revisão)', description: 'Mudanças com um defeito plantado. A boa revisão aponta o defeito. Rode um experimento com o scorer "revisao" e compare modelos.' })
    await revisao.addItems({ items: DIFFS_DE_OURO.map((d) => ({ input: { nome: d.nome, diff: d.diff }, groundTruth: { palavras: d.palavras } })) })
    criou = true
  }
  return criou ? 'criado' : 'existente'
}

async function semearCriterios(mastra: Mastra): Promise<'criado' | 'existente'> {
  try {
    await mastra.datasets.get({ id: ID_CONJUNTO_CRITERIOS })
    return 'existente'
  } catch {
    // Não existe ainda: cria abaixo.
  }
  const conjunto = await mastra.datasets.create({
    id: ID_CONJUNTO_CRITERIOS,
    name: 'Critérios de aceite (triagem)',
    description: 'Casos para o lint de critérios: o veredito esperado (ok) de cada lista. Base para medir a triagem da Factory.',
  })
  await conjunto.addItems({
    items: CASOS_DE_CRITERIOS.map((caso) => ({
      input: { nome: caso.nome, criterios: caso.criterios },
      groundTruth: { ok: caso.ok },
    })),
  })
  return 'criado'
}
