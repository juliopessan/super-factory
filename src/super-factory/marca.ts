import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { marcarSegredos } from '../factory/guards.ts'
import { paginaConfiguracoes, tratarChaves } from './configuracoes.ts'
import { paginaInicial } from './landing.ts'

const ICONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#ff8c00"/>
  <text x="16" y="21" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" font-weight="600" fill="#1a1a1a">SF</text>
</svg>`

const SCRIPT = `(function () {
  var nome = 'Super Factory'
  function marcar() {
    if (/mastra/i.test(document.title)) document.title = document.title.replace(/Mastra Studio|Mastra/g, nome)
    document.querySelectorAll('svg[viewBox="0 0 34 21"]').forEach(function (svg) {
      if (svg.dataset.sf === '1') return
      svg.dataset.sf = '1'
      svg.setAttribute('viewBox', '0 0 32 32')
      svg.setAttribute('role', 'img')
      svg.setAttribute('aria-label', nome)
      svg.style.width = '1.25rem'
      svg.style.height = '1.25rem'
      svg.innerHTML = '<rect width="32" height="32" rx="8" fill="#ff8c00"></rect><text x="16" y="21" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" font-weight="600" fill="#1a1a1a">SF</text>'
    })
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    var node
    while ((node = walker.nextNode())) {
      if (node.nodeValue && ESPERAS.test(node.nodeValue.trim()) && !vivos.has(node)) girar(node)
      // Título do primeiro grupo do menu do Studio.
      if (node.nodeValue && node.nodeValue.trim() === 'Primitives') node.nodeValue = node.nodeValue.replace('Primitives', 'Factory')
      if (node.nodeValue && /mastra/i.test(node.nodeValue)) {
        var novo = node.nodeValue.replaceAll('@mastra/', '').replaceAll('Mastra Studio', nome).replaceAll('Mastra', nome)
        if (novo !== node.nodeValue) node.nodeValue = novo
      }
    }
  }
  // Textos de espera do Studio viram verbos da Factory, com um ícone girando.
  var ESPERAS = /^(Thinking|Running|Running step|Generating|Working)(…|\\.\\.\\.)$/
  var VERBOS = ['Triando…', 'Especificando…', 'Separando donos…', 'Conferindo evidência…', 'Procurando segredo…', 'Lendo a trilha…', 'Redigindo o relatório…', 'Esperando o gate…']
  var vivos = new Map()
  var vez = 0
  function girar(node) {
    var texto = VERBOS[vez++ % VERBOS.length]
    node.nodeValue = texto
    vivos.set(node, texto)
    if (node.parentElement) node.parentElement.setAttribute('data-sf-verbo', '')
  }
  setInterval(function () {
    vivos.forEach(function (ultimo, node) {
      // O Studio trocou o texto ou tirou o elemento: o verbo para de girar.
      if (!node.isConnected || node.nodeValue !== ultimo) {
        vivos.delete(node)
        if (node.parentElement && node.nodeValue !== ultimo) node.parentElement.removeAttribute('data-sf-verbo')
        return
      }
      var texto = VERBOS[vez++ % VERBOS.length]
      node.nodeValue = texto
      vivos.set(node, texto)
    })
  }, 1800)
  function estilo() {
    if (document.getElementById('sf-estilo')) return
    var css = document.createElement('style')
    css.id = 'sf-estilo'
    css.textContent = '[data-sf-verbo]::before{content:"✻";display:inline-block;margin-right:.45em;color:#ff8c00;animation:sf-gira 1.6s linear infinite}@keyframes sf-gira{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){[data-sf-verbo]::before{animation:none}}'
    document.head.appendChild(css)
  }

  // Botão "Chaves e acessos": abre /configuracoes num popup dentro do Studio.
  function popupDeChaves() {
    if (document.getElementById('sf-chaves-fundo')) return
    var tema = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    var fundo = document.createElement('div')
    fundo.id = 'sf-chaves-fundo'
    fundo.setAttribute('role', 'dialog')
    fundo.setAttribute('aria-modal', 'true')
    fundo.setAttribute('aria-label', 'Chaves e acessos')
    fundo.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);display:grid;place-items:center;padding:16px'
    var caixa = document.createElement('iframe')
    caixa.src = '/configuracoes?embed=1&tema=' + tema
    caixa.title = 'Chaves e acessos'
    caixa.style.cssText = 'width:min(680px,100%);height:min(780px,100%);border:1px solid rgba(255,255,255,.18);border-radius:20px;background:' + (tema === 'dark' ? '#050505' : '#f4f4f2')
    fundo.appendChild(caixa)
    var anterior = document.activeElement
    function fechar() {
      window.removeEventListener('keydown', tecla, true)
      window.removeEventListener('message', mensagem)
      fundo.remove()
      if (anterior && anterior.focus) anterior.focus()
    }
    function tecla(e) { if (e.key === 'Escape') { e.stopPropagation(); fechar() } }
    function mensagem(e) { if (e.origin === location.origin && e.data && e.data.sf === 'fechar-chaves') fechar() }
    fundo.addEventListener('mousedown', function (e) { if (e.target === fundo) fechar() })
    window.addEventListener('keydown', tecla, true)
    window.addEventListener('message', mensagem)
    document.body.appendChild(fundo)
    caixa.addEventListener('load', function () { caixa.focus() })
  }
  function botaoDeChaves() {
    var noStudio = location.pathname === '/studio' || location.pathname.indexOf('/studio/') === 0
    if (document.getElementById('sf-chaves-botao') || !noStudio) return
    var b = document.createElement('button')
    b.id = 'sf-chaves-botao'
    b.type = 'button'
    b.textContent = '✻ Chaves e acessos'
    b.setAttribute('aria-haspopup', 'dialog')
    b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147482000;padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:#141414;color:#ededed;font:500 13px ui-sans-serif,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.35)'
    b.addEventListener('click', popupDeChaves)
    document.body.appendChild(b)
  }
  function ligar() {
    estilo()
    botaoDeChaves()
    new MutationObserver(function () { marcar(); botaoDeChaves() }).observe(document.documentElement, { subtree: true, childList: true, characterData: true })
    marcar()
  }
  if (document.body) ligar()
  else document.addEventListener('DOMContentLoaded', ligar)
})()`

const require = createRequire(import.meta.url)
let motion: string | null | undefined

// A Motion (motion.dev) é servida daqui, sem CDN: a landing funciona offline.
function motionJs(): Response {
  if (motion === undefined) {
    try {
      motion = readFileSync(path.join(path.dirname(require.resolve('motion')), '..', 'motion.js'), 'utf8')
    } catch {
      motion = null
    }
  }
  if (!motion) return new Response('', { status: 404 })
  return new Response(motion, {
    status: 200,
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  })
}

function icone(): Response {
  return new Response(ICONE, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

type Pedido = { path: string; method: string; raw: Request; bodyCache?: Record<string, unknown> }

function marcarValores(valor: unknown): unknown {
  if (typeof valor === 'string') return marcarSegredos(valor)
  if (Array.isArray(valor)) return valor.map(marcarValores)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [chave, marcarValores(item)]))
  }
  return valor
}

// Todo corpo JSON que entra na API passa por aqui antes de chegar ao Mastra.
// Assim o segredo não entra no snapshot do workflow, na memória nem nos spans:
// no lugar dele fica [segredo:rotulo], que a triagem ainda reconhece e bloqueia.
async function limparEntrada(req: Pedido): Promise<void> {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return
  if (!req.path.startsWith('/api/')) return
  if (!(req.raw.headers.get('content-type') ?? '').includes('application/json')) return
  const texto = await req.raw.clone().text()
  let dados: unknown
  try {
    dados = JSON.parse(texto)
  } catch {
    return
  }
  const limpo = JSON.stringify(marcarValores(dados))
  if (limpo === JSON.stringify(dados)) return
  const headers = new Headers(req.raw.headers)
  headers.delete('content-length')
  req.raw = new Request(req.raw.url, { method: req.raw.method, headers, body: limpo, signal: req.raw.signal })
  req.bodyCache = { text: Promise.resolve(limpo) }
}

export async function marcaSuperFactory(c: { req: Pedido; res: Response }, next: () => Promise<void>) {
  const caminho = c.req.path
  await limparEntrada(c.req)
  if (caminho === '/motion.js') return motionJs()
  if (caminho === '/configuracoes' || caminho === '/configuracoes/') {
    const consulta = new URL(c.req.raw.url).searchParams
    const tema = consulta.get('tema')
    return paginaConfiguracoes({ embed: consulta.get('embed') === '1', tema: tema === 'dark' || tema === 'light' ? tema : null })
  }
  if (caminho === '/configuracoes/chaves') return tratarChaves(c.req.raw)
  if (caminho === '/sf.svg' || caminho.endsWith('/sf.svg') || caminho.endsWith('/mastra-dark-tile.svg') || caminho.endsWith('/mastra-light-tile.svg')) {
    return icone()
  }
  if (caminho === '/en' || caminho === '/en/') {
    return new Response(paginaInicial('en'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Language': 'en-US' },
    })
  }
  if (caminho === '/' || caminho === '') {
    return new Response(paginaInicial(), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  }
  await next()
  const tipo = c.res.headers.get('content-type') ?? ''
  if (!tipo.includes('text/html')) return
  const html = await c.res.text()
  const marcado = html
    .replaceAll('<title>Mastra Studio</title>', '<title>Super Factory</title>')
    .replaceAll('href="./mastra-dark-tile.svg"', 'href="./sf.svg"')
    .replace('</body>', `<script>${SCRIPT}</script></body>`)
  const headers = new Headers(c.res.headers)
  headers.delete('content-length')
  c.res = new Response(marcado, { status: c.res.status, headers })
}
