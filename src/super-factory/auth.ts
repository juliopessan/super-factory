// Login da Super Factory: GitHub OAuth (PKCE), liberado só para quem a waitlist aprovou ou é admin.
//
//   SUPER_FACTORY_AUTH=github   liga o login. Sem isso, nada muda (modo local e instalações antigas).
//   Ligado com configuração incompleta: FECHA tudo que não é público (503). Nunca abre por engano.
//
// Sessão: cookie assinado (HMAC-SHA256), HttpOnly, SameSite=Lax, Secure em https. Sem estado no servidor; a cada
// pedido a aprovação é conferida de novo (cache de 30 s), então recusar alguém na waitlist tira o acesso logo.

import crypto from 'node:crypto'

import type { Client } from '@libsql/client'

import { abrirBanco } from '../factory/banco.ts'
import { estaAprovado } from '../factory/waitlist.ts'
import { registrarUsuario } from './identidade.ts'
import { criarLimitePorChave, ipDe } from './protecao.ts'

export type ConfigAuth =
  | { modo: 'desligado' }
  | { modo: 'invalido'; faltando: string[] }
  | {
      modo: 'github'
      clientId: string
      clientSecret: string
      urlPublica: string
      admins: string[]
      segredo: Buffer
      tokenDeServico: string | null
      seguro: boolean
      horas: number
      urls: { autorizar: string; token: string; api: string }
    }

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/

export function lerConfig(env: NodeJS.ProcessEnv = process.env): ConfigAuth {
  if ((env.SUPER_FACTORY_AUTH ?? '').trim().toLowerCase() !== 'github') return { modo: 'desligado' }
  const faltando: string[] = []
  const clientId = (env.GITHUB_OAUTH_CLIENT_ID ?? '').trim()
  const clientSecret = (env.GITHUB_OAUTH_CLIENT_SECRET ?? '').trim()
  if (!clientId) faltando.push('GITHUB_OAUTH_CLIENT_ID')
  if (!clientSecret) faltando.push('GITHUB_OAUTH_CLIENT_SECRET')
  let urlPublica = ''
  try {
    const url = new URL((env.SUPER_FACTORY_PUBLIC_URL ?? '').trim())
    if (url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL.test(url.hostname))) urlPublica = url.origin
  } catch {
    // cai no aviso abaixo
  }
  if (!urlPublica) faltando.push('SUPER_FACTORY_PUBLIC_URL (https://seu-dominio)')
  const admins = (env.SUPER_FACTORY_ADMINS ?? '').split(',').map((a) => a.trim().toLowerCase()).filter((a) => /^[a-z0-9][a-z0-9-]{0,38}$/.test(a))
  if (admins.length === 0) faltando.push('SUPER_FACTORY_ADMINS (usuário do GitHub de quem administra)')
  const direto = (env.SUPER_FACTORY_SESSION_SECRET ?? '').trim()
  const mestra = (env.SUPER_FACTORY_MASTER_KEY ?? '').trim()
  let segredo: Buffer | null = null
  if (direto.length >= 32) segredo = Buffer.from(direto)
  else if (mestra.length >= 16) segredo = crypto.createHmac('sha256', mestra).update('super-factory/sessao').digest()
  if (!segredo) faltando.push('SUPER_FACTORY_SESSION_SECRET (32+ caracteres) ou SUPER_FACTORY_MASTER_KEY')
  if (faltando.length > 0 || !segredo) return { modo: 'invalido', faltando }
  const teste = env.SUPER_FACTORY_OAUTH_TESTE === '1'
  const horas = Math.min(72, Math.max(1, Number.parseInt(env.SUPER_FACTORY_SESSAO_HORAS ?? '8', 10) || 8))
  const token = (env.SUPER_FACTORY_API_TOKEN ?? '').trim()
  return {
    modo: 'github',
    clientId,
    clientSecret,
    urlPublica,
    admins,
    segredo,
    tokenDeServico: token.length >= 32 ? token : null,
    seguro: urlPublica.startsWith('https:'),
    horas,
    urls: {
      autorizar: teste && env.SUPER_FACTORY_OAUTH_GITHUB_URL ? `${env.SUPER_FACTORY_OAUTH_GITHUB_URL}/login/oauth/authorize` : 'https://github.com/login/oauth/authorize',
      token: teste && env.SUPER_FACTORY_OAUTH_GITHUB_URL ? `${env.SUPER_FACTORY_OAUTH_GITHUB_URL}/login/oauth/access_token` : 'https://github.com/login/oauth/access_token',
      api: teste && env.SUPER_FACTORY_OAUTH_API_URL ? env.SUPER_FACTORY_OAUTH_API_URL : 'https://api.github.com',
    },
  }
}

// ---------- cookies e assinatura ----------

const b64 = (dados: Buffer | string) => Buffer.from(dados).toString('base64url')

export function assinar(carga: Record<string, unknown>, segredo: Buffer): string {
  const corpo = b64(JSON.stringify(carga))
  return `${corpo}.${b64(crypto.createHmac('sha256', segredo).update(corpo).digest())}`
}

export function verificar(valor: string | null | undefined, segredo: Buffer, agora = Date.now()): Record<string, unknown> | null {
  if (!valor) return null
  const partes = valor.split('.')
  if (partes.length !== 2) return null
  const [corpo, marca] = partes as [string, string]
  const esperado = crypto.createHmac('sha256', segredo).update(corpo).digest()
  let recebido: Buffer
  try {
    recebido = Buffer.from(marca, 'base64url')
  } catch {
    return null
  }
  if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) return null
  try {
    const carga = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Record<string, unknown>
    if (typeof carga.exp !== 'number' || carga.exp * 1000 < agora) return null
    return carga
  } catch {
    return null
  }
}

function nomeDoCookie(base: string, cfg: { seguro: boolean }): string {
  return cfg.seguro ? `__Host-${base}` : base
}

function lerCookie(req: Request, nome: string): string | null {
  for (const parte of (req.headers.get('cookie') ?? '').split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim()
  }
  return null
}

function cookie(nome: string, valor: string, opcoes: { seguro: boolean; maxAge: number }): string {
  return `${nome}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${opcoes.maxAge}${opcoes.seguro ? '; Secure' : ''}`
}

/** Só caminhos da própria Factory: nada de //outro-site, \ ou quebra de linha. */
export function proximoSeguro(bruto: string | null | undefined): string {
  const padrao = '/studio'
  if (!bruto || bruto.length > 300 || !bruto.startsWith('/') || bruto.startsWith('//') || /[\\\r\n\u0000]/.test(bruto)) return padrao
  if (/^\/(auth|login)(\/|\?|$)/.test(bruto)) return padrao
  return bruto
}

// ---------- quem pode entrar ----------

type Dependencias = { fetch?: typeof fetch; db?: () => Promise<Client>; agora?: () => number }
const cacheDeAprovacao = new Map<string, { ok: boolean; ate: number }>()

export function limparCache(): void {
  cacheDeAprovacao.clear()
}

async function permitido(cfg: Extract<ConfigAuth, { modo: 'github' }>, login: string, email: string, deps: Dependencias): Promise<boolean> {
  if (cfg.admins.includes(login.toLowerCase())) return true
  const agora = (deps.agora ?? Date.now)()
  const chave = `${login.toLowerCase()}|${email.toLowerCase()}`
  const guardado = cacheDeAprovacao.get(chave)
  if (guardado && guardado.ate > agora) return guardado.ok
  let ok = false
  try {
    ok = await estaAprovado(await (deps.db ?? abrirBanco)(), login, email ? [email] : [])
  } catch (erro) {
    // Sem banco, quem não é admin fica de fora: falha fechada.
    console.warn(`[auth] não consegui conferir a waitlist: ${erro instanceof Error ? erro.message : 'erro'}`)
  }
  cacheDeAprovacao.set(chave, { ok, ate: agora + 30_000 })
  return ok
}

export type Usuario = { login: string; admin: boolean; servico?: boolean }

// ---------- páginas (injetadas pelo marca.ts para evitar import circular) ----------

export type Paginas = {
  login: (opcoes: { proximo: string; aviso?: string }) => Response
  negado: (opcoes: { login: string }) => Response
  malConfigurada: (faltando: string[]) => Response
}

const limiteDeLogin = criarLimitePorChave(30, 60_000)

function json(corpo: unknown, status: number): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}

function paraOLogin(url: URL): Response {
  const alvo = proximoSeguro(`${url.pathname}${url.search}`)
  return new Response(null, { status: 302, headers: { Location: `/login?next=${encodeURIComponent(alvo)}`, 'Cache-Control': 'no-store' } })
}

function bearerConfere(req: Request, esperado: string): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')
  if (!m) return false
  const a = crypto.createHash('sha256').update(m[1] ?? '').digest()
  const b = crypto.createHash('sha256').update(esperado).digest()
  return crypto.timingSafeEqual(a, b)
}

export function usuarioDaSessao(req: Request, cfg: Extract<ConfigAuth, { modo: 'github' }>, agora = Date.now()): { login: string; email: string } | null {
  const carga = verificar(lerCookie(req, nomeDoCookie('sf_sessao', cfg)), cfg.segredo, agora)
  if (!carga || typeof carga.u !== 'string') return null
  return { login: carga.u, email: typeof carga.e === 'string' ? carga.e : '' }
}

export type Decisao = { tipo: 'liberado'; usuario: Usuario | null } | { tipo: 'resposta'; resposta: Response }

/** Decide se o pedido passa. Em modo desligado, tudo passa; ligado, só o público e quem tem sessão válida. */
export async function porteiro(req: Request, cfg: ConfigAuth, publico: (caminho: string) => boolean, paginas: Paginas, deps: Dependencias = {}): Promise<Decisao> {
  if (cfg.modo === 'desligado') return { tipo: 'liberado', usuario: null }
  const url = new URL(req.url)
  const caminho = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname
  if (publico(caminho)) return { tipo: 'liberado', usuario: null }
  if (cfg.modo === 'invalido') {
    const quer = (req.headers.get('accept') ?? '').includes('text/html')
    return { tipo: 'resposta', resposta: quer ? paginas.malConfigurada(cfg.faltando) : json({ erro: 'Login mal configurado. Fechado por segurança.' }, 503) }
  }
  if (caminho.startsWith('/api/') && cfg.tokenDeServico && bearerConfere(req, cfg.tokenDeServico)) {
    return { tipo: 'liberado', usuario: { login: 'servico', admin: false, servico: true } }
  }
  const sessao = usuarioDaSessao(req, cfg, (deps.agora ?? Date.now)())
  if (sessao && (await permitido(cfg, sessao.login, sessao.email, deps))) {
    const admin = cfg.admins.includes(sessao.login.toLowerCase())
    registrarUsuario(req, sessao.login)
    return { tipo: 'liberado', usuario: { login: sessao.login, admin } }
  }
  const querHtml = req.method === 'GET' && (req.headers.get('accept') ?? '').includes('text/html')
  return { tipo: 'resposta', resposta: querHtml ? paraOLogin(url) : json({ erro: 'Entre pela página de login da Factory.' }, 401) }
}

// ---------- OAuth ----------

function aleatorio(bytes: number): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function iniciarLogin(req: Request, cfg: Extract<ConfigAuth, { modo: 'github' }>): Response {
  if (!limiteDeLogin(ipDe(req))) return json({ erro: 'Muitas tentativas. Espere um minuto.' }, 429)
  const url = new URL(req.url)
  const estado = aleatorio(16)
  const verificador = aleatorio(32)
  const desafio = crypto.createHash('sha256').update(verificador).digest('base64url')
  const proximo = proximoSeguro(url.searchParams.get('next'))
  const carga = assinar({ s: estado, v: verificador, n: proximo, exp: Math.floor(Date.now() / 1000) + 600 }, cfg.segredo)
  const destino = new URL(cfg.urls.autorizar)
  destino.searchParams.set('client_id', cfg.clientId)
  destino.searchParams.set('redirect_uri', `${cfg.urlPublica}/auth/retorno`)
  destino.searchParams.set('scope', 'read:user user:email')
  destino.searchParams.set('state', estado)
  destino.searchParams.set('code_challenge', desafio)
  destino.searchParams.set('code_challenge_method', 'S256')
  destino.searchParams.set('allow_signup', 'false')
  const headers = new Headers({ Location: destino.href, 'Cache-Control': 'no-store' })
  headers.append('Set-Cookie', cookie(nomeDoCookie('sf_oauth', cfg), carga, { seguro: cfg.seguro, maxAge: 600 }))
  return new Response(null, { status: 302, headers })
}

async function pedirJson(url: string, init: RequestInit, buscar: typeof fetch): Promise<{ status: number; corpo: unknown }> {
  const r = await buscar(url, { ...init, signal: AbortSignal.timeout(10_000) })
  let corpo: unknown = null
  try {
    corpo = await r.json()
  } catch {
    corpo = null
  }
  return { status: r.status, corpo }
}

export async function retornoLogin(req: Request, cfg: Extract<ConfigAuth, { modo: 'github' }>, paginas: Paginas, deps: Dependencias = {}): Promise<Response> {
  if (!limiteDeLogin(ipDe(req))) return json({ erro: 'Muitas tentativas. Espere um minuto.' }, 429)
  const url = new URL(req.url)
  const nomeOauth = nomeDoCookie('sf_oauth', cfg)
  const limpar = cookie(nomeOauth, '', { seguro: cfg.seguro, maxAge: 0 })
  const falhou = (aviso: string) => {
    const r = paginas.login({ proximo: '/studio', aviso })
    r.headers.append('Set-Cookie', limpar)
    return r
  }
  const carga = verificar(lerCookie(req, nomeOauth), cfg.segredo, (deps.agora ?? Date.now)())
  const estado = url.searchParams.get('state') ?? ''
  const codigo = url.searchParams.get('code') ?? ''
  if (url.searchParams.get('error')) return falhou('O GitHub não concluiu o login. Tente de novo.')
  if (!carga || typeof carga.s !== 'string' || typeof carga.v !== 'string' || !codigo || codigo.length > 200) return falhou('O login expirou. Tente de novo.')
  const a = Buffer.from(estado)
  const b = Buffer.from(carga.s)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return falhou('O login expirou. Tente de novo.')
  const buscar = deps.fetch ?? fetch
  try {
    const troca = await pedirJson(
      cfg.urls.token,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'super-factory' },
        body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code: codigo, redirect_uri: `${cfg.urlPublica}/auth/retorno`, code_verifier: carga.v }),
      },
      buscar,
    )
    const token = (troca.corpo as { access_token?: unknown } | null)?.access_token
    if (typeof token !== 'string' || !token) return falhou('O GitHub recusou o login. Tente de novo.')
    const cab = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'super-factory', 'X-GitHub-Api-Version': '2022-11-28' }
    const eu = await pedirJson(`${cfg.urls.api}/user`, { headers: cab }, buscar)
    const login = (eu.corpo as { login?: unknown } | null)?.login
    if (eu.status !== 200 || typeof login !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(login)) return falhou('Não consegui ler o seu usuário no GitHub.')
    let emails: string[] = []
    let principal = ''
    const lista = await pedirJson(`${cfg.urls.api}/user/emails`, { headers: cab }, buscar)
    if (lista.status === 200 && Array.isArray(lista.corpo)) {
      const verificados = (lista.corpo as Array<{ email?: unknown; verified?: unknown; primary?: unknown }>).filter((e) => e.verified === true && typeof e.email === 'string')
      emails = verificados.map((e) => String(e.email).toLowerCase())
      principal = String(verificados.find((e) => e.primary === true)?.email ?? verificados[0]?.email ?? '').toLowerCase()
    }
    // Aprovação por e-mail só vale com e-mail verificado: confere qual deles está na waitlist.
    let emailAprovado = ''
    if (!cfg.admins.includes(login.toLowerCase())) {
      const db = await (deps.db ?? abrirBanco)()
      for (const email of emails.length ? emails : ['']) {
        if (await estaAprovado(db, login, email ? [email] : [])) {
          emailAprovado = email
          break
        }
      }
      if (!emailAprovado && !(await estaAprovado(db, login, []))) {
        limparCache()
        const r = paginas.negado({ login })
        r.headers.append('Set-Cookie', limpar)
        return r
      }
    }
    const exp = Math.floor((deps.agora ?? Date.now)() / 1000) + cfg.horas * 3600
    const sessao = assinar({ u: login, e: emailAprovado || principal, exp }, cfg.segredo)
    const headers = new Headers({ Location: proximoSeguro(typeof carga.n === 'string' ? carga.n : null), 'Cache-Control': 'no-store' })
    headers.append('Set-Cookie', cookie(nomeDoCookie('sf_sessao', cfg), sessao, { seguro: cfg.seguro, maxAge: cfg.horas * 3600 }))
    headers.append('Set-Cookie', limpar)
    console.log(`[auth] ${login} entrou`)
    return new Response(null, { status: 302, headers })
  } catch {
    return falhou('Não consegui falar com o GitHub agora. Tente de novo.')
  }
}

export function sair(cfg: Extract<ConfigAuth, { modo: 'github' }>): Response {
  const headers = new Headers({ Location: '/login', 'Cache-Control': 'no-store' })
  headers.append('Set-Cookie', cookie(nomeDoCookie('sf_sessao', cfg), '', { seguro: cfg.seguro, maxAge: 0 }))
  return new Response(null, { status: 302, headers })
}

export function quemSou(req: Request, cfg: ConfigAuth): Response {
  if (cfg.modo !== 'github') return json({ ativo: false }, 200)
  const s = usuarioDaSessao(req, cfg)
  if (!s) return json({ erro: 'Sem sessão.' }, 401)
  return json({ ativo: true, login: s.login, admin: cfg.admins.includes(s.login.toLowerCase()) }, 200)
}
