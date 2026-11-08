// Waitlist: quem quer usar a Factory (pessoa ou empresa) entra por formulário com qualificação.
// O acesso é liberado por uma pessoa da Factory: só quem está "aprovado" aqui (ou é admin) consegue entrar.

import crypto from 'node:crypto'

import type { Client } from '@libsql/client'

export const TIPOS = ['pessoa', 'empresa'] as const
export const EQUIPES = ['1', '2-10', '11-50', '51-200', '200+'] as const
export const USOS = ['time-de-desenvolvimento', 'plataforma-devops', 'consultoria', 'produto-proprio', 'estudo-prova-de-conceito'] as const
export const FERRAMENTAS = ['GitHub', 'Azure DevOps', 'GitLab', 'Jira', 'Docker', 'Claude', 'OpenAI', 'Gemini'] as const
export const ORIGENS = ['indicacao', 'evento', 'redes-sociais', 'busca', 'outro'] as const
export type Status = 'pendente' | 'aprovado' | 'recusado'

export type Inscricao = {
  tipo: (typeof TIPOS)[number]
  nome: string
  email: string
  empresa: string | null
  cargo: string | null
  site: string | null
  equipe: (typeof EQUIPES)[number]
  usuarios: number
  uso: (typeof USOS)[number]
  ferramentas: string[]
  casoDeUso: string
  github: string | null
  origem: string | null
}

export class ErroDeInscricao extends Error {
  campo: string
  constructor(campo: string, mensagem: string) {
    super(mensagem)
    this.campo = campo
  }
}

function texto(valor: unknown, campo: string, rotulo: string, opcoes: { min?: number; max: number; obrigatorio?: boolean }): string | null {
  if (valor === undefined || valor === null || (typeof valor === 'string' && !valor.trim())) {
    if (opcoes.obrigatorio) throw new ErroDeInscricao(campo, `Informe ${rotulo}.`)
    return null
  }
  if (typeof valor !== 'string') throw new ErroDeInscricao(campo, `${rotulo} precisa ser texto.`)
  const limpo = valor.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim()
  if (opcoes.min && limpo.length < opcoes.min) throw new ErroDeInscricao(campo, `${rotulo} está curto demais (mínimo ${opcoes.min} caracteres).`)
  if (limpo.length > opcoes.max) throw new ErroDeInscricao(campo, `${rotulo} passou de ${opcoes.max} caracteres.`)
  return limpo
}

function escolha<T extends readonly string[]>(valor: unknown, lista: T, campo: string, rotulo: string): T[number] {
  if (typeof valor !== 'string' || !(lista as readonly string[]).includes(valor)) throw new ErroDeInscricao(campo, `Escolha uma opção em ${rotulo}.`)
  return valor
}

export function normalizarEmail(bruto: string): string {
  return bruto.trim().toLowerCase()
}

const EMAIL = /^[^\s@<>"',;:()[\]\\]{1,64}@[^\s@<>"',;:()[\]\\]{1,190}\.[A-Za-z]{2,24}$/

/** Valida e normaliza. Lança ErroDeInscricao com o campo e uma mensagem que a pessoa entende. */
export function validarInscricao(bruto: unknown): Inscricao {
  const dado = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : null
  if (!dado) throw new ErroDeInscricao('geral', 'Formulário ilegível.')
  const tipo = escolha(dado.tipo, TIPOS, 'tipo', 'Você é')
  const nome = texto(dado.nome, 'nome', 'seu nome', { min: 2, max: 80, obrigatorio: true }) as string
  const email = normalizarEmail(texto(dado.email, 'email', 'seu e-mail', { max: 120, obrigatorio: true }) as string)
  if (!EMAIL.test(email)) throw new ErroDeInscricao('email', 'O e-mail não parece válido.')
  const empresa = texto(dado.empresa, 'empresa', 'a empresa', { max: 80, obrigatorio: tipo === 'empresa' })
  const cargo = texto(dado.cargo, 'cargo', 'seu cargo', { max: 60 })
  let site = texto(dado.site, 'site', 'o site', { max: 100 })
  if (site) {
    try {
      const url = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error('x')
      site = url.origin
    } catch {
      throw new ErroDeInscricao('site', 'O site não parece um endereço válido.')
    }
  }
  const equipe = escolha(dado.equipe, EQUIPES, 'equipe', 'Tamanho da equipe')
  const usuariosBruto = typeof dado.usuarios === 'string' ? Number(dado.usuarios) : dado.usuarios
  if (typeof usuariosBruto !== 'number' || !Number.isInteger(usuariosBruto) || usuariosBruto < 1 || usuariosBruto > 5000) {
    throw new ErroDeInscricao('usuarios', 'Informe quantas pessoas usariam (de 1 a 5000).')
  }
  const uso = escolha(dado.uso, USOS, 'uso', 'Uso principal')
  const lista = Array.isArray(dado.ferramentas) ? dado.ferramentas : []
  if (lista.length > FERRAMENTAS.length) throw new ErroDeInscricao('ferramentas', 'Ferramentas demais.')
  const ferramentas = [...new Set(lista.map((item) => escolha(item, FERRAMENTAS, 'ferramentas', 'Ferramentas')))]
  if (ferramentas.length === 0) throw new ErroDeInscricao('ferramentas', 'Marque ao menos uma ferramenta que vocês usam.')
  const casoDeUso = texto(dado.casoDeUso, 'casoDeUso', 'o que você quer automatizar', { min: 20, max: 600, obrigatorio: true }) as string
  let github = texto(dado.github, 'github', 'o usuário do GitHub', { max: 60 })
  if (github) {
    github = github.replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '')
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(github)) throw new ErroDeInscricao('github', 'O usuário do GitHub não parece válido (letras, números e hífen).')
    github = github.toLowerCase()
  }
  const origemBruta = texto(dado.origem, 'origem', 'como conheceu', { max: 30 })
  const origem = origemBruta && (ORIGENS as readonly string[]).includes(origemBruta) ? origemBruta : null
  if (dado.consentimento !== true) throw new ErroDeInscricao('consentimento', 'Para entrar na lista, aceite o uso dos dados para contato sobre o acesso.')
  return { tipo, nome, email, empresa, cargo, site, equipe, usuarios: usuariosBruto, uso, ferramentas, casoDeUso, github, origem }
}

/** Hash do IP com sal: serve para ver abuso (muitos cadastros do mesmo lugar), não para identificar a pessoa. */
export function hashDeIp(ip: string, sal: string): string {
  return crypto.createHmac('sha256', sal).update(ip).digest('hex').slice(0, 16)
}

export async function registrar(db: Client, inscricao: Inscricao, ipHash: string | null, agora = new Date()): Promise<'novo' | 'atualizado'> {
  const iso = agora.toISOString()
  const existente = await db.execute({ sql: 'SELECT id, status FROM waitlist WHERE email = ?', args: [inscricao.email] })
  const campos = [inscricao.tipo, inscricao.nome, inscricao.empresa, inscricao.cargo, inscricao.site, inscricao.equipe, inscricao.usuarios, inscricao.uso, JSON.stringify(inscricao.ferramentas), inscricao.casoDeUso, inscricao.github, inscricao.origem]
  if (existente.rows.length > 0) {
    // Quem manda de novo atualiza as respostas, mas nunca muda o status: aprovar e recusar é decisão nossa.
    await db.execute({
      sql: 'UPDATE waitlist SET tipo=?, nome=?, empresa=?, cargo=?, site=?, equipe=?, usuarios=?, uso=?, ferramentas=?, caso_de_uso=?, github=?, origem=?, atualizado_em=?, ip_hash=? WHERE email=?',
      args: [...campos, iso, ipHash, inscricao.email],
    })
    return 'atualizado'
  }
  await db.execute({
    sql: 'INSERT INTO waitlist (tipo, nome, empresa, cargo, site, equipe, usuarios, uso, ferramentas, caso_de_uso, github, origem, criado_em, atualizado_em, consentimento_em, ip_hash, email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: [...campos, iso, iso, iso, ipHash, inscricao.email],
  })
  return 'novo'
}

export type Linha = {
  id: number
  criadoEm: string
  tipo: string
  nome: string
  email: string
  empresa: string | null
  cargo: string | null
  site: string | null
  equipe: string
  usuarios: number
  uso: string
  ferramentas: string[]
  casoDeUso: string
  github: string | null
  origem: string | null
  status: Status
  decididoPor: string | null
  decididoEm: string | null
}

function linhaDe(r: Record<string, unknown>): Linha {
  let ferramentas: string[] = []
  try {
    ferramentas = JSON.parse(String(r.ferramentas ?? '[]')) as string[]
  } catch {
    ferramentas = []
  }
  return {
    id: Number(r.id),
    criadoEm: String(r.criado_em),
    tipo: String(r.tipo),
    nome: String(r.nome),
    email: String(r.email),
    empresa: (r.empresa as string | null) ?? null,
    cargo: (r.cargo as string | null) ?? null,
    site: (r.site as string | null) ?? null,
    equipe: String(r.equipe),
    usuarios: Number(r.usuarios),
    uso: String(r.uso),
    ferramentas,
    casoDeUso: String(r.caso_de_uso),
    github: (r.github as string | null) ?? null,
    origem: (r.origem as string | null) ?? null,
    status: String(r.status) as Status,
    decididoPor: (r.decidido_por as string | null) ?? null,
    decididoEm: (r.decidido_em as string | null) ?? null,
  }
}

export async function listar(db: Client, status?: Status): Promise<Linha[]> {
  const r = status
    ? await db.execute({ sql: 'SELECT * FROM waitlist WHERE status = ? ORDER BY criado_em DESC LIMIT 500', args: [status] })
    : await db.execute('SELECT * FROM waitlist ORDER BY criado_em DESC LIMIT 500')
  return r.rows.map((linha) => linhaDe(linha as unknown as Record<string, unknown>))
}

export async function decidir(db: Client, id: number, status: 'aprovado' | 'recusado' | 'pendente', por: string, agora = new Date()): Promise<boolean> {
  const r = await db.execute({
    sql: 'UPDATE waitlist SET status = ?, decidido_por = ?, decidido_em = ?, atualizado_em = ? WHERE id = ?',
    args: [status, por, agora.toISOString(), agora.toISOString(), id],
  })
  return r.rowsAffected > 0
}

/** Aprovado por usuário do GitHub ou por qualquer e-mail verificado dele. */
export async function estaAprovado(db: Client, github: string, emails: string[]): Promise<boolean> {
  const login = github.trim().toLowerCase()
  const lista = [...new Set(emails.map(normalizarEmail).filter(Boolean))]
  const marcas = lista.map(() => '?').join(',')
  const r = await db.execute({
    sql: `SELECT 1 FROM waitlist WHERE status = 'aprovado' AND (github = ?${lista.length ? ` OR email IN (${marcas})` : ''}) LIMIT 1`,
    args: [login, ...lista],
  })
  return r.rows.length > 0
}

export async function contagens(db: Client): Promise<Record<Status, number>> {
  const r = await db.execute('SELECT status, COUNT(*) AS n FROM waitlist GROUP BY status')
  const saida: Record<Status, number> = { pendente: 0, aprovado: 0, recusado: 0 }
  for (const linha of r.rows) saida[String(linha.status) as Status] = Number(linha.n)
  return saida
}

/** Célula de CSV segura: aspas dobradas e prefixo contra fórmula do Excel/Planilhas (= + - @). */
export function celulaCsv(valor: unknown): string {
  let t = valor === null || valor === undefined ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return `"${t.replace(/"/g, '""')}"`
}

export function paraCsv(linhas: Linha[]): string {
  const cab = ['id', 'criado_em', 'status', 'tipo', 'nome', 'email', 'empresa', 'cargo', 'site', 'equipe', 'usuarios', 'uso', 'ferramentas', 'caso_de_uso', 'github', 'origem', 'decidido_por', 'decidido_em']
  const corpo = linhas.map((l) => [l.id, l.criadoEm, l.status, l.tipo, l.nome, l.email, l.empresa, l.cargo, l.site, l.equipe, l.usuarios, l.uso, l.ferramentas.join('; '), l.casoDeUso, l.github, l.origem, l.decididoPor, l.decididoEm].map(celulaCsv).join(','))
  return [cab.map(celulaCsv).join(','), ...corpo].join('\r\n') + '\r\n'
}
