// Webhook do GitHub no lugar da varredura: o GitHub avisa, a Factory reage. Quatro regras:
//  1. Sem SUPER_FACTORY_WEBHOOK_SECRET o webhook fica desligado (503). Com ele, toda entrega precisa da assinatura
//     HMAC-SHA256 (X-Hub-Signature-256) sobre o corpo exato, comparada em tempo constante. Sem assinatura válida, nada acontece.
//  2. O texto que vem no evento é dado de terceiros: o webhook só decide QUAL ação roda (importar a issue etiquetada,
//     triar um bug, medir um PR). Nunca executa nada que esteja escrito no evento.
//  3. Responde rápido (o GitHub desiste em 10 s): o trabalho roda em segundo plano. A mesma entrega (X-GitHub-Delivery)
//     não roda duas vezes.
//  4. Reagir não é decidir: importar a issue só cria o card. Quem manda rodar, e quem faz o merge, é uma pessoa.

import { createHmac, timingSafeEqual } from 'node:crypto'

import { importarIssues, ETIQUETA_PADRAO } from './gatilhos.ts'
import type { GithubDeps } from './github.ts'
import { medirResultadosDosPrs } from './github-sinais.ts'
import { dividirRepositorio } from './guards.ts'
import { lerEstado } from './store.ts'
import type { Estado } from './schemas.ts'

export const LIMITE_DO_CORPO = 1_000_000
const ENTREGAS_LEMBRADAS = 500

/** "sha256=<hex>" do HMAC do corpo, comparado em tempo constante. Cabeçalho ausente ou malformado nunca confere. */
export function assinaturaConfere(corpo: string, cabecalho: string | null, segredo: string): boolean {
  if (!segredo || !cabecalho) return false
  const m = /^sha256=([0-9a-f]{64})$/.exec(cabecalho.trim())
  if (!m) return false
  const esperado = createHmac('sha256', segredo).update(corpo, 'utf8').digest()
  return timingSafeEqual(esperado, Buffer.from(m[1]!, 'hex'))
}

export function assinar(corpo: string, segredo: string): string {
  return `sha256=${createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex')}`
}

export type DepsDoWebhook = {
  segredo?: string
  /** owner/repo permitidos (SUPER_FACTORY_WEBHOOK_REPOS). Vazio: qualquer repositório com assinatura válida. */
  repositorios?: string[]
  etiqueta?: string
  github?: GithubDeps
  /** Triagem automática de bug (opt-in). Sem isto, a issue de bug só é importada. */
  triar?: (repositorio: string, numero: number) => Promise<unknown>
  importar?: typeof importarIssues
  medir?: typeof medirResultadosDosPrs
  runs?: () => Record<string, Estado>
  /** Onde o trabalho em segundo plano roda. Os testes guardam a promessa para esperar por ela. */
  fundo?: (trabalho: Promise<unknown>) => void
  registrar?: (linha: string) => void
}

const vistas: string[] = []
function jaVista(id: string): boolean {
  if (vistas.includes(id)) return true
  vistas.push(id)
  if (vistas.length > ENTREGAS_LEMBRADAS) vistas.shift()
  return false
}
export function esquecerEntregas(): void {
  vistas.length = 0
}

function json(corpo: unknown, status: number): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}

type Evento = {
  action?: string
  repository?: { full_name?: string }
  label?: { name?: string }
  issue?: { number?: number; labels?: Array<{ name?: string }>; pull_request?: unknown }
  pull_request?: { number?: number }
}

export function lerSegredoDoWebhook(env: Record<string, string | undefined> = process.env): string {
  return env.SUPER_FACTORY_WEBHOOK_SECRET?.trim() ?? ''
}

export function lerRepositoriosDoWebhook(env: Record<string, string | undefined> = process.env): string[] {
  return (env.SUPER_FACTORY_WEBHOOK_REPOS ?? '').split(',').map((r) => r.trim().toLowerCase()).filter(Boolean)
}

export async function tratarWebhookGithub(req: Request, deps: DepsDoWebhook = {}): Promise<Response> {
  const segredo = deps.segredo ?? lerSegredoDoWebhook()
  const registrar = deps.registrar ?? ((l: string) => console.log(`[webhook] ${l}`))
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405)
  if (!segredo) return json({ erro: 'Webhook desligado: defina SUPER_FACTORY_WEBHOOK_SECRET na Factory e o mesmo segredo no webhook do GitHub.' }, 503)
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > LIMITE_DO_CORPO) return json({ erro: 'Corpo grande demais.' }, 413)
  const corpo = await req.text()
  if (corpo.length > LIMITE_DO_CORPO) return json({ erro: 'Corpo grande demais.' }, 413)
  if (!assinaturaConfere(corpo, req.headers.get('x-hub-signature-256'), segredo)) {
    registrar('entrega recusada: assinatura inválida ou ausente')
    return json({ erro: 'Assinatura inválida.' }, 401)
  }
  const evento = req.headers.get('x-github-event') ?? ''
  const entrega = req.headers.get('x-github-delivery') ?? ''
  if (evento === 'ping') return json({ ok: true, resposta: 'pong' }, 200)
  if (entrega && jaVista(entrega)) return json({ ok: true, duplicada: true }, 200)
  let dados: Evento
  try {
    dados = JSON.parse(corpo) as Evento
  } catch {
    return json({ erro: 'JSON inválido.' }, 400)
  }
  const repositorio = dados.repository?.full_name ?? ''
  try {
    dividirRepositorio(repositorio)
  } catch {
    return json({ ok: true, ignorada: 'repositório ausente ou inválido' }, 202)
  }
  const permitidos = deps.repositorios ?? lerRepositoriosDoWebhook()
  if (permitidos.length > 0 && !permitidos.includes(repositorio.toLowerCase())) {
    registrar(`${evento} de ${repositorio} ignorado: fora de SUPER_FACTORY_WEBHOOK_REPOS`)
    return json({ ok: true, ignorada: 'repositório fora da lista' }, 202)
  }
  const fundo = deps.fundo ?? ((p: Promise<unknown>) => void p.catch((e) => registrar(`falha em segundo plano: ${e instanceof Error ? e.message : 'erro'}`)))
  const etiqueta = (deps.etiqueta ?? ETIQUETA_PADRAO).toLowerCase()
  const numero = dados.issue?.number ?? dados.pull_request?.number

  // Issue etiquetada com a etiqueta combinada: importar como card (e, se também é bug e a triagem está ligada, tentar reproduzir).
  if (evento === 'issues' && dados.action === 'labeled' && !dados.issue?.pull_request) {
    const etiquetas = (dados.issue?.labels ?? []).map((l) => (l.name ?? '').toLowerCase())
    const tem = etiquetas.includes(etiqueta)
    const gatilho = (dados.label?.name ?? '').toLowerCase()
    if (!tem || ![etiqueta, 'bug'].includes(gatilho)) return json({ ok: true, ignorada: 'etiqueta sem relação com a Factory' }, 202)
    const acoes: string[] = []
    if (gatilho === etiqueta) {
      fundo((deps.importar ?? importarIssues)(repositorio, { etiqueta: deps.etiqueta, limite: 10 }, deps.github).then((r) => registrar(r.nota)))
      acoes.push('importar')
    }
    if (deps.triar && Number.isInteger(numero) && etiquetas.includes('bug')) {
      fundo(deps.triar(repositorio, numero as number).then(() => registrar(`triagem de ${repositorio}#${numero} concluída`)))
      acoes.push('triar-bug')
    }
    return json({ ok: true, acoes }, 202)
  }

  // PR fechado: mede o que aconteceu com ele (aceito, ajustado, recusado), só dos cards que a Factory abriu.
  if (evento === 'pull_request' && dados.action === 'closed' && Number.isInteger(numero)) {
    const runs = Object.fromEntries(Object.entries((deps.runs ?? (() => lerEstado().runs))()).filter(([, r]) => r.card.repositorio.toLowerCase() === repositorio.toLowerCase() && new RegExp(`/pull/${numero}$`).test(r.entrega?.pullRequestUrl ?? '')))
    if (Object.keys(runs).length === 0) return json({ ok: true, ignorada: 'o PR não é de um card da Factory' }, 202)
    fundo((deps.medir ?? medirResultadosDosPrs)(runs, deps.github).then((r) => registrar(`PR #${numero} de ${repositorio} medido (${r.medidos})`)))
    return json({ ok: true, acoes: ['medir-resultado'] }, 202)
  }

  return json({ ok: true, ignorada: `evento ${evento || 'desconhecido'}${dados.action ? `/${dados.action}` : ''} sem ação` }, 202)
}
