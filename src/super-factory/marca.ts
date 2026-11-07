import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { marcarSegredos } from '../factory/guards.ts'
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
  function ligar() {
    estilo()
    new MutationObserver(marcar).observe(document.documentElement, { subtree: true, childList: true, characterData: true })
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
  if (caminho === '/sf.svg' || caminho.endsWith('/sf.svg') || caminho.endsWith('/mastra-dark-tile.svg') || caminho.endsWith('/mastra-light-tile.svg')) {
    return icone()
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
