import { marcarSegredos } from '../factory/guards.ts'
import { paginaInicial } from './landing.ts'

const ICONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.14"/>
  <text x="16" y="21.5" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="700" fill="currentColor">SF</text>
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
      svg.innerHTML = '<rect width="32" height="32" rx="8" fill="currentColor" opacity="0.14"></rect><text x="16" y="21.5" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="700" fill="currentColor">SF</text>'
    })
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    var node
    while ((node = walker.nextNode())) {
      if (node.nodeValue && /mastra/i.test(node.nodeValue)) {
        var novo = node.nodeValue.replaceAll('@mastra/', '').replaceAll('Mastra Studio', nome).replaceAll('Mastra', nome)
        if (novo !== node.nodeValue) node.nodeValue = novo
      }
    }
  }
  function ligar() {
    new MutationObserver(marcar).observe(document.documentElement, { subtree: true, childList: true, characterData: true })
    marcar()
  }
  if (document.body) ligar()
  else document.addEventListener('DOMContentLoaded', ligar)
})()`

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
