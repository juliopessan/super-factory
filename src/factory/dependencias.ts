// Dependências entre cards de uma onda: o card filho nasce da branch do pai e abre o pull request contra ela
// (PRs em pilha). Cada card tem no máximo UM pai: a pilha é uma árvore, e o merge segue de baixo para cima.
// Juntar duas branches de pais diferentes seria um merge escondido, e merge é decisão de uma pessoa.

import { PARALELISMO_MAXIMO } from './paralelo.ts'

export const MAXIMO_DE_CARDS_POR_ONDA = 8
export const PADRAO_DE_CHAVE = /^[a-z0-9][a-z0-9-]{0,23}$/

export type NoDaOnda = { chave: string | null; dependeDe: string | null }

export class ErroDeOnda extends Error {}

/** Confere chaves, pais e ciclos. Lança ErroDeOnda com uma frase que a pessoa (ou o agente) consegue corrigir. */
export function validarOnda(nos: readonly NoDaOnda[]): void {
  if (nos.length === 0) throw new ErroDeOnda('A onda precisa de ao menos um card.')
  if (nos.length > MAXIMO_DE_CARDS_POR_ONDA) throw new ErroDeOnda(`No máximo ${MAXIMO_DE_CARDS_POR_ONDA} cards por onda (até ${PARALELISMO_MAXIMO} rodam ao mesmo tempo). Divida em duas ondas.`)
  const chaves = new Map<string, number>()
  nos.forEach((no, i) => {
    if (no.chave === null) return
    if (!PADRAO_DE_CHAVE.test(no.chave)) throw new ErroDeOnda(`A chave "${no.chave}" usa de 1 a 24 letras minúsculas, números e hífen.`)
    if (chaves.has(no.chave)) throw new ErroDeOnda(`A chave "${no.chave}" aparece em mais de um card.`)
    chaves.set(no.chave, i)
  })
  for (const no of nos) {
    if (no.dependeDe === null) continue
    if (!PADRAO_DE_CHAVE.test(no.dependeDe)) throw new ErroDeOnda(`"dependeDe" aceita uma só chave (letras minúsculas, números e hífen), não "${no.dependeDe}". Cada card tem no máximo um pai.`)
    if (!chaves.has(no.dependeDe)) throw new ErroDeOnda(`O card${no.chave ? ` "${no.chave}"` : ''} depende de "${no.dependeDe}", que não é a chave de nenhum card desta onda.`)
    if (no.dependeDe === no.chave) throw new ErroDeOnda(`O card "${no.chave}" não pode depender de si mesmo.`)
  }
  // Ciclo: sobe pelos pais a partir de cada card; passar do número de cards sem chegar a uma raiz é ciclo.
  const paiDe = new Map<string, string>()
  for (const no of nos) if (no.chave !== null && no.dependeDe !== null) paiDe.set(no.chave, no.dependeDe)
  for (const no of nos) {
    let atual = no.chave
    for (let passos = 0; atual !== null && paiDe.has(atual); passos++) {
      if (passos > nos.length) throw new ErroDeOnda(`As dependências formam um ciclo (passando por "${no.chave}").`)
      atual = paiDe.get(atual) ?? null
    }
  }
}

/** Do pai para o filho, na ordem em que as pessoas devem fazer o merge. Estável: respeita a ordem de entrada. */
export function ordemDeMerge<T extends NoDaOnda>(nos: readonly T[]): T[] {
  const prontos = new Set<string>()
  const saida: T[] = []
  const restantes = [...nos]
  while (restantes.length > 0) {
    const i = restantes.findIndex((no) => no.dependeDe === null || prontos.has(no.dependeDe))
    if (i < 0) throw new ErroDeOnda('As dependências formam um ciclo.')
    const [no] = restantes.splice(i, 1) as [T]
    if (no.chave !== null) prontos.add(no.chave)
    saida.push(no)
  }
  return saida
}

/**
 * Roda a onda respeitando as dependências e o teto de simultâneos. Um card só começa depois que o pai terminou;
 * se o pai não chegou ao pull request, o filho (e os filhos dele) ficam bloqueados e nunca rodam.
 * `executar` recebe o resultado do pai (ou null para quem não tem pai). O resultado sai na ordem de entrada.
 */
export async function executarOnda<N extends NoDaOnda, R extends { ok: boolean }>(
  nos: readonly N[],
  limite: number,
  executar: (no: N, pai: R | null) => Promise<R>,
  bloquear: (no: N, pai: R) => R,
): Promise<R[]> {
  validarOnda(nos)
  limite = Math.max(1, Math.floor(limite))
  // Array.from, não new Array: o every() de um array esparso pula as posições vazias e daria a onda por concluída antes de começar.
  const resultados = Array.from({ length: nos.length }, (): R | undefined => undefined)
  const porChave = new Map<string, number>()
  nos.forEach((no, i) => {
    if (no.chave !== null) porChave.set(no.chave, i)
  })
  const iniciados = new Set<number>()
  let rodando = 0
  return new Promise<R[]>((resolver, rejeitar) => {
    let encerrado = false
    const concluir = () => {
      if (!encerrado && resultados.every((r) => r !== undefined)) {
        encerrado = true
        resolver(resultados as R[])
      }
    }
    const andar = () => {
      if (encerrado) return
      for (let i = 0; i < nos.length; i++) {
        if (iniciados.has(i)) continue
        const no = nos[i] as N
        const iPai = no.dependeDe === null ? null : (porChave.get(no.dependeDe) ?? null)
        const pai = iPai === null ? null : (resultados[iPai] ?? undefined)
        if (iPai !== null && pai === undefined) continue // o pai ainda não terminou
        if (pai !== null && pai !== undefined && !pai.ok) {
          iniciados.add(i)
          resultados[i] = bloquear(no, pai)
          i = -1 // um bloqueio pode liberar o próximo bloqueio: recomeça a varredura
          continue
        }
        if (rodando >= limite) continue
        iniciados.add(i)
        rodando++
        executar(no, pai ?? null)
          .then((r) => {
            resultados[i] = r
          })
          .catch((erro) => {
            encerrado = true
            rejeitar(erro)
          })
          .finally(() => {
            rodando--
            andar()
            concluir()
          })
      }
      concluir()
    }
    andar()
  })
}
