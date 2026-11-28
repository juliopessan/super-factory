// Validar o plano: a etapa entre "especificar" e "abrir o card". Quem especifica é o Chief (lê o repositório, conversa com a pessoa e
// escreve o plano); esta função confere o plano ANTES de abrir qualquer card: a mesma triagem de qualquer card (critério observável,
// segredo, pedido de push protegido, merge automático), chaves e dependências da onda, e duplicata do quadro e do próprio plano.
// Determinística e sem modelo: a mesma entrada dá sempre a mesma resposta.

import { z } from 'zod'

import { duplicatasDe } from './cards.ts'
import { MAXIMO_DE_CARDS_POR_ONDA, PADRAO_DE_CHAVE, validarOnda } from './dependencias.ts'
import { triarPedido } from './pipeline.ts'
import type { Card, Provedor } from './schemas.ts'
import { lerEstado, type FabricaEstado } from './store.ts'

export const CardDoPlanoSchema = z.object({
  chave: z.string().regex(PADRAO_DE_CHAVE, 'A chave usa de 1 a 24 letras minúsculas, números e hífen.').describe('Nome curto do card dentro do plano.'),
  titulo: z.string().min(4).max(120),
  descricao: z.string().min(20).max(4000).describe('O que muda, para quem, e o que fica de fora.'),
  criterios: z.array(z.string().min(8).max(400)).min(1).max(8).describe('Critérios de aceite OBSERVÁVEIS: uma condição que um teste consegue verificar.'),
  dependeDe: z.string().regex(PADRAO_DE_CHAVE).nullish().describe('Chave de UM só card pai. O filho nasce da branch do pai e abre um PR em pilha.'),
})
export type CardDoPlano = z.infer<typeof CardDoPlanoSchema>

export type ValidacaoDoPlano = { ok: boolean; problemas: string[]; duplicatas: string[] }

export function validarPlano(entrada: { cards: CardDoPlano[]; provedor?: Provedor; repositorio: string; branchBase?: string }, estado: FabricaEstado = lerEstado()): ValidacaoDoPlano {
  const provedor: Provedor = entrada.provedor ?? 'github'
  const branchBase = entrada.branchBase?.trim() || 'main'
  const { cards } = entrada
  const problemas: string[] = []
  const duplicatas: string[] = []
  if (cards.length === 0) return { ok: false, problemas: ['O plano não tem nenhum card.'], duplicatas }
  if (cards.length > MAXIMO_DE_CARDS_POR_ONDA) return { ok: false, problemas: [`O plano tem ${cards.length} cards; uma onda leva até ${MAXIMO_DE_CARDS_POR_ONDA}. Junte ou divida em duas demandas.`], duplicatas }
  try {
    validarOnda(cards.map((c) => ({ chave: c.chave, dependeDe: c.dependeDe ?? null })))
  } catch (erro) {
    problemas.push(erro instanceof Error ? erro.message : 'Chaves ou dependências inválidas.')
  }
  const chaves = new Set(cards.map((c) => c.chave))
  if (chaves.size !== cards.length) problemas.push('Há chaves repetidas entre os cards.')
  const comoCard = (c: CardDoPlano, id: string, t: { titulo: string; descricao: string; criterios: string[]; rota: Card['rota'] }) => ({ id, titulo: t.titulo, descricao: t.descricao, criterios: t.criterios, coluna: 'ready', rota: t.rota, grau: 'easy', provedor, repositorio: entrada.repositorio, branchBase, branchHead: null, onda: null, itemExterno: null }) as unknown as Card
  const doPlano: Card[] = []
  cards.forEach((c, i) => {
    if (c.dependeDe && !chaves.has(c.dependeDe)) problemas.push(`O card "${c.chave}" depende de "${c.dependeDe}", que não existe no plano.`)
    try {
      const t = triarPedido({ titulo: c.titulo, descricao: c.descricao, criterios: c.criterios.join('\n'), provedor, repositorio: entrada.repositorio, branchBase, branchHead: '' })
      for (const b of t.bloqueios) problemas.push(`Card "${c.chave}": ${b}`)
      const card = comoCard(c, `P-${i + 1}`, t)
      doPlano.push(card)
      for (const p of duplicatasDe(estado.cards, card)) {
        duplicatas.push(p.id)
        problemas.push(`Card "${c.chave}" parece o mesmo trabalho de ${p.id} (${p.coluna}: ${p.titulo}).`)
      }
    } catch (erro) {
      problemas.push(`Card "${c.chave}": ${erro instanceof Error ? erro.message : 'pedido inválido'}`)
    }
  })
  // Dois cards do mesmo plano que são o mesmo trabalho: a onda pularia um deles em silêncio.
  const indice = (id: string) => Number(id.slice(2)) - 1
  for (const c of doPlano) for (const outro of duplicatasDe(doPlano, c)) if (indice(outro.id) > indice(c.id)) problemas.push(`Os cards "${cards[indice(c.id)]!.chave}" e "${cards[indice(outro.id)]!.chave}" parecem o mesmo trabalho: junte-os num só.`)
  return { ok: problemas.length === 0, problemas, duplicatas: [...new Set(duplicatas)] }
}
