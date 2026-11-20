// Quadro da Factory: /quadro (tela) e /factory/quadro (JSON, somente leitura).
// Aparece como uma seção da página Agents do Studio (iframe) ou como página própria.

import crypto from 'node:crypto'

import { lerEstado } from '../factory/store.ts'
import type { Card, Estado } from '../factory/schemas.ts'
import { resposta } from './protecao.ts'

export const COLUNAS = ['backlog', 'ready', 'build', 'qa', 'review', 'blocked', 'done'] as const

const TITULOS: Record<(typeof COLUNAS)[number], string> = {
  backlog: 'Backlog',
  ready: 'Pronto',
  build: 'Construindo',
  qa: 'QA',
  review: 'Revisão',
  blocked: 'Bloqueado',
  done: 'Concluído',
}

export type CartaoDoQuadro = {
  id: string
  titulo: string
  rota: string
  grau: string
  repositorio: string
  onda: number | null
  branch: string | null
  /** Id do card de que este depende (PR em pilha): o card cuja branch é a base deste. */
  empilhadoSobre: string | null
  desfecho: string | null
  pullRequest: string | null
  atualizadoEm: string | null
}

export type QuadroCompleto = {
  colunas: Array<{ coluna: (typeof COLUNAS)[number]; titulo: string; cards: CartaoDoQuadro[] }>
  total: number
  resumo: string
}

function enderecoSeguro(url: string | null | undefined): string | null {
  return typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null
}

/** A execução mais recente de cada card: é dela que vêm o desfecho e o endereço do pull request. */
function ultimaExecucaoPorCard(runs: Record<string, Estado>): Map<string, Estado> {
  const mapa = new Map<string, Estado>()
  for (const run of Object.values(runs)) {
    const atual = mapa.get(run.card.id)
    if (!atual || run.atualizadoEm > atual.atualizadoEm) mapa.set(run.card.id, run)
  }
  return mapa
}

export function montarQuadro(cards: Card[], runs: Record<string, Estado> = {}): QuadroCompleto {
  const execucoes = ultimaExecucaoPorCard(runs)
  const dono = new Map<string, string>()
  for (const card of cards) if (card.branchHead) dono.set(card.branchHead, card.id)
  const colunas = COLUNAS.map((coluna) => ({
    coluna,
    titulo: TITULOS[coluna],
    cards: cards
      .filter((card) => card.coluna === coluna)
      .map((card): CartaoDoQuadro => {
        const run = execucoes.get(card.id)
        const pai = dono.get(card.branchBase) ?? null
        return {
          id: card.id,
          titulo: card.titulo,
          rota: card.rota,
          grau: card.grau,
          repositorio: card.repositorio,
          onda: card.onda,
          branch: card.branchHead,
          empilhadoSobre: pai && pai !== card.id ? pai : null,
          desfecho: run?.desfecho ?? null,
          pullRequest: enderecoSeguro(run?.entrega?.pullRequestUrl),
          atualizadoEm: run?.atualizadoEm ?? null,
        }
      }),
  }))
  const total = cards.length
  const andamento = colunas.filter((c) => c.coluna === 'build' || c.coluna === 'qa').reduce((n, c) => n + c.cards.length, 0)
  const feitos = colunas.find((c) => c.coluna === 'done')?.cards.length ?? 0
  const bloqueados = colunas.find((c) => c.coluna === 'blocked')?.cards.length ?? 0
  return {
    colunas,
    total,
    resumo: `${total} card(s): ${andamento} em andamento, ${feitos} concluído(s), ${bloqueados} bloqueado(s).`,
  }
}

export function tratarQuadro(req: Request): Response {
  if (req.method !== 'GET') return resposta({ erro: 'Método não permitido.' }, 405)
  try {
    const estado = lerEstado()
    return resposta(montarQuadro(estado.cards, estado.runs))
  } catch {
    return resposta({ erro: 'Não consegui ler o quadro.' }, 500)
  }
}

export function paginaQuadro(opcoes: { embed: boolean; tema: 'dark' | 'light' | null }): Response {
  const nonce = crypto.randomBytes(16).toString('base64')
  const tema = opcoes.tema ? ` data-tema="${opcoes.tema}"` : ''
  const html = `<!doctype html>
<html lang="pt-BR"${tema}${opcoes.embed ? ' data-embed="1"' : ''}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Quadro · Super Factory</title>
<link rel="icon" href="/sf.svg" type="image/svg+xml" />
<style nonce="${nonce}">
  :root { --bg:#050505; --card:#141414; --line:#ffffff14; --line-2:#ffffff29; --text:#ededed; --muted:#9a9a9a; --accent:#f5a25d; --ok:#5ee08a; --erro:#ff8a7a; color-scheme: dark; }
  @media (prefers-color-scheme: light) { :root:not([data-tema="dark"]) { --bg:#f4f4f2; --card:#ffffff; --line:#0000001a; --line-2:#0000002e; --text:#111111; --muted:#555555; --accent:#b85f12; --ok:#137a3d; --erro:#b3261e; color-scheme: light; } }
  :root[data-tema="light"] { --bg:#f4f4f2; --card:#ffffff; --line:#0000001a; --line-2:#0000002e; --text:#111111; --muted:#555555; --accent:#b85f12; --ok:#137a3d; --erro:#b3261e; color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  main { padding: 20px; }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  h1 { margin: 0; font-size: 20px; font-weight: 500; letter-spacing: -.02em; }
  .resumo { color: var(--muted); font-size: 13px; }
  .grade { display: grid; grid-template-columns: repeat(7, minmax(150px, 1fr)); gap: 10px; overflow-x: auto; padding-bottom: 6px; }
  .coluna { min-width: 0; border: 1px solid var(--line); border-radius: 14px; padding: 8px; background: color-mix(in srgb, var(--card) 55%, transparent); }
  .coluna h2 { margin: 2px 4px 8px; font-size: 12px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); display: flex; justify-content: space-between; }
  .coluna[data-coluna="blocked"] h2 { color: var(--erro); }
  .coluna[data-coluna="done"] h2 { color: var(--ok); }
  .cartao { border: 1px solid var(--line-2); border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; background: var(--card); overflow-wrap: anywhere; }
  .cartao b { font-weight: 500; display: block; margin-bottom: 4px; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px; font-size: 11.5px; color: var(--muted); }
  .meta span { border: 1px solid var(--line); border-radius: 99px; padding: 1px 7px; }
  .meta .pilha { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
  .cartao a { display: inline-block; margin-top: 6px; font-size: 12px; color: var(--text); }
  a:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  .vazio { color: var(--muted); font-size: 12px; margin: 4px; }
  .erro { color: var(--erro); }
  html[data-embed] body { background: transparent; }
  html[data-embed] main { padding: 0 0 4px; }
  html[data-embed] header { display: none; }
  @media (max-width: 720px) { .grade { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
  <header><h1>Quadro</h1><span class="resumo" id="resumo" aria-live="polite">Carregando…</span></header>
  <div class="grade" id="grade" role="list" aria-label="Colunas do quadro"></div>
</main>
<script nonce="${nonce}">
(function () {
  var grade = document.getElementById('grade')
  var resumo = document.getElementById('resumo')
  var ultimaAltura = 0
  function tag(nome, classe, texto) {
    var e = document.createElement(nome)
    if (classe) e.className = classe
    if (texto !== undefined) e.textContent = texto
    return e
  }
  function cartao(c) {
    var d = tag('div', 'cartao')
    d.setAttribute('role', 'listitem')
    d.appendChild(tag('b', '', c.id + ' · ' + c.titulo))
    var m = tag('div', 'meta')
    m.appendChild(tag('span', '', c.rota))
    m.appendChild(tag('span', '', c.grau))
    if (c.onda) m.appendChild(tag('span', '', 'onda ' + c.onda))
    if (c.empilhadoSobre) m.appendChild(tag('span', 'pilha', 'sobre ' + c.empilhadoSobre))
    if (c.desfecho && c.desfecho !== 'em-andamento') m.appendChild(tag('span', '', c.desfecho))
    d.appendChild(m)
    if (c.pullRequest) {
      var a = tag('a', '', 'Abrir pull request')
      a.href = c.pullRequest
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      d.appendChild(a)
    }
    return d
  }
  function desenhar(q) {
    resumo.textContent = q.resumo
    grade.textContent = ''
    q.colunas.forEach(function (col) {
      var s = tag('section', 'coluna')
      s.setAttribute('data-coluna', col.coluna)
      var h = tag('h2')
      h.appendChild(tag('span', '', col.titulo))
      h.appendChild(tag('span', '', String(col.cards.length)))
      s.appendChild(h)
      if (!col.cards.length) s.appendChild(tag('p', 'vazio', 'Nenhum card.'))
      col.cards.forEach(function (c) { s.appendChild(cartao(c)) })
      grade.appendChild(s)
    })
    avisarAltura()
  }
  function avisarAltura() {
    if (!document.documentElement.hasAttribute('data-embed')) return
    var h = document.body.scrollHeight
    if (h !== ultimaAltura) { ultimaAltura = h; parent.postMessage({ sf: 'altura-quadro', h: h + 8 }, location.origin) }
  }
  function carregar() {
    if (document.hidden) return
    fetch('/factory/quadro', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('falhou'); return r.json() })
      .then(desenhar)
      .catch(function () { resumo.textContent = 'Não consegui ler o quadro agora.'; resumo.className = 'resumo erro' })
  }
  carregar()
  setInterval(carregar, 8000)
  document.addEventListener('visibilitychange', carregar)
  new ResizeObserver(avisarAltura).observe(document.body)
})()
</script>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`,
    },
  })
}

/** Seção do Quadro dentro da página Agents do Studio: um iframe logo abaixo do desenho do time. */
export const SCRIPT_QUADRO = String.raw`
(function () {
  if (window.__sfQuadro) return
  window.__sfQuadro = true
  var secao = null
  function rota() {
    var r = location.pathname
    return r.length > 1 && r.charAt(r.length - 1) === '/' ? r.slice(0, -1) : r
  }
  function tema() { return document.documentElement.classList.contains('dark') ? 'dark' : 'light' }
  function construir() {
    secao = document.createElement('section')
    secao.id = 'sf-quadro'
    secao.setAttribute('aria-labelledby', 'sf-quadro-titulo')
    secao.style.cssText = 'width:min(1180px,100%);margin:12px auto 24px;color:var(--foreground,currentColor)'
    var cab = document.createElement('header')
    cab.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 4px 6px'
    var h = document.createElement('h2')
    h.id = 'sf-quadro-titulo'
    h.textContent = 'Quadro'
    h.style.cssText = 'margin:0;font-size:13px;font-weight:500'
    var a = document.createElement('a')
    a.href = '/quadro'
    a.textContent = 'Abrir em tela cheia'
    a.style.cssText = 'font-size:12px;text-decoration:underline;color:var(--muted-foreground,#888)'
    cab.appendChild(h)
    cab.appendChild(a)
    var f = document.createElement('iframe')
    f.title = 'Quadro da Factory'
    f.src = '/quadro?embed=1&tema=' + tema()
    f.style.cssText = 'width:100%;height:320px;border:0;background:transparent;color-scheme:normal'
    f.setAttribute('allowtransparency', 'true')
    secao.appendChild(cab)
    secao.appendChild(f)
  }
  function ajustar() {
    if (rota() !== '/studio/agents') { if (secao && secao.isConnected) secao.remove(); return }
    var time = document.getElementById('sf-time')
    if (!time || !time.parentElement) return
    if (secao && secao.isConnected && secao.previousElementSibling === time) return
    if (!secao) construir()
    time.insertAdjacentElement('afterend', secao)
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.sf !== 'altura-quadro') return
    var f = secao && secao.querySelector('iframe')
    var h = Number(e.data.h)
    if (f && h > 0 && h < 6000) f.style.height = Math.ceil(h) + 'px'
  })
  var agendado = false
  new MutationObserver(function () {
    if (agendado) return
    agendado = true
    requestAnimationFrame(function () { agendado = false; ajustar() })
  }).observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('popstate', ajustar)
  ajustar()
})()
`
