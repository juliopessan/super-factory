// Paralelismo com teto. Leitura e cards independentes andam juntos; escrita no mesmo recurso, não.

export const PARALELISMO_PADRAO = 3
export const PARALELISMO_MAXIMO = 5

/** SUPER_FACTORY_PARALELISMO: quantos cards o modo autônomo roda ao mesmo tempo (1 a 5, padrão 3). */
export function paralelismoConfigurado(valor: string | undefined = process.env.SUPER_FACTORY_PARALELISMO): number {
  const numero = Number.parseInt(valor ?? '', 10)
  if (!Number.isFinite(numero)) return PARALELISMO_PADRAO
  return Math.min(PARALELISMO_MAXIMO, Math.max(1, numero))
}

/** Roda fn em cada item, no máximo `limite` ao mesmo tempo. O resultado mantém a ordem dos itens. */
export async function mapearEmParalelo<T, R>(itens: readonly T[], limite: number, fn: (item: T, indice: number) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(itens.length)
  let proximo = 0
  const trabalhadores = Array.from({ length: Math.max(1, Math.min(limite, itens.length)) }, async () => {
    while (proximo < itens.length) {
      const indice = proximo++
      resultados[indice] = await fn(itens[indice] as T, indice)
    }
  })
  await Promise.all(trabalhadores)
  return resultados
}

/** Fila de um só por chave: as chamadas da mesma chave rodam uma depois da outra, mesmo se chegarem juntas. */
export function criarFilaSerial(): <T>(chave: string, tarefa: () => Promise<T>) => Promise<T> {
  const caudas = new Map<string, Promise<unknown>>()
  return (chave, tarefa) => {
    const anterior = caudas.get(chave) ?? Promise.resolve()
    const atual = anterior.then(tarefa, tarefa)
    const cauda = atual.catch(() => {})
    caudas.set(chave, cauda)
    void cauda.then(() => { if (caudas.get(chave) === cauda) caudas.delete(chave) })
    return atual
  }
}
