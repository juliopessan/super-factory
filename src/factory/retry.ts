// Retry para falhas transitórias dos provedores (GitHub, Azure DevOps).
// Só leituras repetem: uma escrita repetida pode abrir a mesma issue duas vezes.

export type Esperar = (ms: number) => Promise<void>

export const esperarDeVerdade: Esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const TRANSITORIOS = new Set([408, 425, 429, 500, 502, 503, 504])
const TETO_MS = 5000

export function podeRepetir(metodo: string | undefined): boolean {
  const m = (metodo ?? 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

export function statusTransitorio(status: number): boolean {
  return TRANSITORIOS.has(status)
}

/** Espera antes da tentativa seguinte: Retry-After, se vier, senão 300 ms, 900 ms, 2,7 s. Nunca passa de 5 s. */
export function espera(tentativa: number, retryAfter: string | null): number {
  const segundos = retryAfter ? Number(retryAfter) : Number.NaN
  if (Number.isFinite(segundos) && segundos >= 0) return Math.min(segundos * 1000, TETO_MS)
  return Math.min(300 * 3 ** (tentativa - 1), TETO_MS)
}

/**
 * Faz a chamada e repete leituras em erro de rede ou status transitório.
 * Devolve a última resposta recebida, ou lança o último erro de rede.
 */
export async function buscarComRetry(
  fazer: () => Promise<Response>,
  metodo: string | undefined,
  opcoes: { tentativas?: number; esperar?: Esperar } = {},
): Promise<Response> {
  const tentativas = podeRepetir(metodo) ? Math.max(1, opcoes.tentativas ?? 3) : 1
  const esperar = opcoes.esperar ?? esperarDeVerdade
  let ultimoErro: unknown
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    let resposta: Response
    try {
      resposta = await fazer()
    } catch (erro) {
      ultimoErro = erro
      if (tentativa < tentativas) await esperar(espera(tentativa, null))
      continue
    }
    if (tentativa < tentativas && statusTransitorio(resposta.status)) {
      await resposta.body?.cancel().catch(() => {})
      await esperar(espera(tentativa, resposta.headers.get('retry-after')))
      continue
    }
    return resposta
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Falha de rede.')
}
