// Rotas de acesso: waitlist pública, painel de quem administra, login e logout.

import { abrirBanco } from '../factory/banco.ts'
import { contagens, decidir, hashDeIp, listar, paraCsv, registrar, validarInscricao, ErroDeInscricao, type Status } from '../factory/waitlist.ts'
import { iniciarLogin, quemSou, retornoLogin, sair, type ConfigAuth, type Paginas, type Usuario } from './auth.ts'
import { paginaAdmin, paginaLogin, paginaMalConfigurada, paginaNegado, paginaWaitlist } from './acesso-ui.ts'
import { criarLimitePorChave, ipDe, origemConfere, resposta } from './protecao.ts'

export const PAGINAS: Paginas = {
  login: ({ proximo, aviso }) => paginaLogin({ proximo, aviso }),
  negado: ({ login }) => paginaNegado({ login }),
  malConfigurada: (faltando) => paginaMalConfigurada(faltando),
}

/** Caminhos que qualquer pessoa abre, mesmo com o login ligado. */
export function ehPublico(caminho: string, estaticos: Iterable<string> = []): boolean {
  if (['/', '/en', '/login', '/waitlist', '/waitlist/enviar', '/sf.svg', '/motion.js', '/robots.txt', '/favicon.ico'].includes(caminho)) return true
  if (caminho.startsWith('/auth/')) return true
  for (const e of estaticos) if (e === caminho) return true
  return false
}

const porIp = criarLimitePorChave(5, 3_600_000)
const global = criarLimitePorChave(300, 3_600_000)
const SAL = `${process.pid}-${Math.random()}`

type Deps = { db?: () => Promise<import('@libsql/client').Client> }

async function tratarEnvio(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405)
  if (!origemConfere(req) || req.headers.get('x-sf-csrf') !== '1') return resposta({ erro: 'Pedido recusado. Use o formulário da própria Factory.' }, 403)
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return resposta({ erro: 'Formato inválido.' }, 415)
  const ip = ipDe(req)
  if (!porIp(ip) || !global('todos')) return resposta({ erro: 'Muitos envios. Tente de novo mais tarde.' }, 429)
  const texto = await req.text()
  if (texto.length > 8_000) return resposta({ erro: 'Formulário grande demais.' }, 413)
  let dado: unknown
  try {
    dado = JSON.parse(texto)
  } catch {
    return resposta({ erro: 'Formulário ilegível.' }, 400)
  }
  // Isca para robô: campo escondido preenchido. Responde como sucesso e não guarda.
  if (dado && typeof dado === 'object' && typeof (dado as { website?: unknown }).website === 'string' && (dado as { website: string }).website.trim()) return resposta({ ok: true })
  try {
    const inscricao = validarInscricao(dado)
    const db = await (deps.db ?? abrirBanco)()
    await registrar(db, inscricao, hashDeIp(ip, SAL))
    // A resposta é a mesma para quem é novo e para quem já estava: não revela se um e-mail está na lista.
    return resposta({ ok: true })
  } catch (erro) {
    if (erro instanceof ErroDeInscricao) return resposta({ erro: erro.message, campo: erro.campo }, 400)
    console.warn(`[waitlist] falha ao registrar: ${erro instanceof Error ? erro.message : 'erro'}`)
    return resposta({ erro: 'Cadastro indisponível agora. Tente de novo em instantes.' }, 503)
  }
}

const limiteAdmin = criarLimitePorChave(120, 60_000)

async function tratarAdmin(req: Request, caminho: string, usuario: Usuario | null, deps: Deps): Promise<Response> {
  if (!usuario || !usuario.admin) return resposta({ erro: 'Só quem administra a Factory abre esta página.' }, 403)
  if (!limiteAdmin(usuario.login)) return resposta({ erro: 'Devagar: muitos pedidos.' }, 429)
  const url = new URL(req.url)
  try {
    const db = await (deps.db ?? abrirBanco)()
    if (caminho === '/admin/waitlist' && req.method === 'GET') return paginaAdmin({ login: usuario.login })
    if (caminho === '/admin/waitlist/dados' && req.method === 'GET') {
      const status = url.searchParams.get('status')
      const filtro = status === 'pendente' || status === 'aprovado' || status === 'recusado' ? (status as Status) : undefined
      return resposta({ itens: await listar(db, filtro), contagens: await contagens(db) })
    }
    if (caminho === '/admin/waitlist/exportar.csv' && req.method === 'GET') {
      return new Response(paraCsv(await listar(db)), {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="waitlist.csv"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      })
    }
    if (caminho === '/admin/waitlist/decidir' && req.method === 'POST') {
      if (!origemConfere(req) || req.headers.get('x-sf-csrf') !== '1') return resposta({ erro: 'Pedido recusado.' }, 403)
      const texto = await req.text()
      if (texto.length > 500) return resposta({ erro: 'Pedido grande demais.' }, 413)
      let corpo: { id?: unknown; status?: unknown }
      try {
        corpo = JSON.parse(texto) as { id?: unknown; status?: unknown }
      } catch {
        return resposta({ erro: 'Pedido ilegível.' }, 400)
      }
      const status = corpo.status
      if (!Number.isInteger(corpo.id) || (status !== 'aprovado' && status !== 'recusado' && status !== 'pendente')) return resposta({ erro: 'Pedido inválido.' }, 400)
      const feito = await decidir(db, corpo.id as number, status, usuario.login)
      console.log(`[waitlist] ${usuario.login} marcou #${String(corpo.id)} como ${status}`)
      return feito ? resposta({ ok: true }) : resposta({ erro: 'Cadastro não encontrado.' }, 404)
    }
  } catch (erro) {
    console.warn(`[waitlist] admin: ${erro instanceof Error ? erro.message : 'erro'}`)
    return resposta({ erro: 'Banco indisponível agora.' }, 503)
  }
  return resposta({ erro: 'Não encontrado.' }, 404)
}

/** Roteia as rotas de acesso. Devolve null quando o caminho não é daqui. */
export async function tratarAcesso(req: Request, cfg: ConfigAuth, usuario: Usuario | null, deps: Deps = {}): Promise<Response | null> {
  const url = new URL(req.url)
  const caminho = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname
  if (caminho === '/waitlist') return paginaWaitlist()
  if (caminho === '/waitlist/enviar') return tratarEnvio(req, deps)
  if (caminho === '/login') {
    if (cfg.modo === 'desligado') return paginaLogin({ proximo: '/studio', ligado: false })
    return paginaLogin({ proximo: url.searchParams.get('next') ?? '/studio' })
  }
  if (caminho.startsWith('/auth/')) {
    if (cfg.modo === 'desligado') return resposta({ ativo: false }, caminho === '/auth/eu' ? 200 : 404)
    if (cfg.modo === 'invalido') return PAGINAS.malConfigurada(cfg.faltando)
    if (caminho === '/auth/github') return iniciarLogin(req, cfg)
    if (caminho === '/auth/retorno') return retornoLogin(req, cfg, PAGINAS)
    if (caminho === '/auth/sair') return sair(cfg)
    if (caminho === '/auth/eu') return quemSou(req, cfg)
    return resposta({ erro: 'Não encontrado.' }, 404)
  }
  if (caminho.startsWith('/admin/')) {
    // Sem login ligado não há quem seja admin: a página nem existe (nada de PII exposta por engano).
    if (cfg.modo !== 'github') return resposta({ erro: 'Não encontrado.' }, 404)
    return tratarAdmin(req, caminho, usuario, deps)
  }
  if (caminho === '/admin') return Response.redirect(new URL('/admin/waitlist', req.url).href, 302)
  return null
}
