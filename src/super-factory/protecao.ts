// Proteções comuns das rotas de configuração (/configuracoes/chaves e /configuracoes/mcps).

const CABECALHOS_JSON = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: CABECALHOS_JSON })
}

/** Pedidos por minuto, no processo todo, por rota. Basta para frear tentativa em massa. */
export function criarLimite(maximo: number): (agora?: number) => boolean {
  const janela: number[] = []
  return (agora = Date.now()) => {
    while (janela.length > 0 && agora - (janela[0] ?? 0) > 60_000) janela.shift()
    if (janela.length >= maximo) return false
    janela.push(agora)
    return true
  }
}

/** Nome de quem entrou pelo login do proxy (Basic). Só o nome: a senha nunca é lida nem guardada. */
export function quemE(req: Request): string {
  const encontrado = /^Basic\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')
  if (!encontrado) return 'local'
  try {
    const usuario = Buffer.from(encontrado[1] ?? '', 'base64').toString('utf8').split(':')[0] ?? ''
    return usuario.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 32) || 'login'
  } catch {
    return 'login'
  }
}

/** O navegador reenvia o login sozinho: sem conferir a origem, outro site poderia mexer nas configurações. */
export function origemConfere(req: Request): boolean {
  const origem = req.headers.get('origin')
  if (!origem) return false
  const host = req.headers.get('host') ?? req.headers.get('x-forwarded-host')
  try {
    return new URL(origem).host === host
  } catch {
    return false
  }
}

/** Confere tudo que um POST de configuração precisa e devolve o texto do corpo, ou a resposta de recusa. */
export async function lerPedido(
  req: Request,
  opcoes: { limite: (agora?: number) => boolean; bytes: number },
): Promise<{ texto: string } | { recusa: Response }> {
  if (!origemConfere(req) || req.headers.get('x-sf-csrf') !== '1') {
    return { recusa: resposta({ erro: 'Pedido recusado. Use a tela da própria Factory.' }, 403) }
  }
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return { recusa: resposta({ erro: 'Formato inválido.' }, 415) }
  if (!opcoes.limite()) return { recusa: resposta({ erro: 'Muitas tentativas. Espere um minuto.' }, 429) }
  const texto = await req.text()
  if (texto.length > opcoes.bytes) return { recusa: resposta({ erro: 'Pedido grande demais.' }, 413) }
  return { texto }
}
