// Time de agentes animado: ocupa o espaço vazio abaixo dos cards em /studio/agents.
// SVG com o desenho em hierarquia (Chief no topo, o time numa fileira, o merge humano embaixo) e um pulso que
// percorre o ciclo. Tudo é função só do tempo (sem estado), então pausa quando não está à vista e respeita
// prefers-reduced-motion. As cores vêm das variáveis do próprio Studio e acompanham o tema.

export const TEMPO_DO_CICLO = 12

export const SCRIPT_TIME = String.raw`
(function () {
  if (window.__sfTime) return
  window.__sfTime = true
  var NS = 'http://www.w3.org/2000/svg'
  var W = 152, H = 40, CICLO = 12
  // t: quando o agente acende. O pulso de cada linha dura 0,9 s e termina quando o filho acende.
  var NOS = [
    { id: 'chief-of-staff', agente: true, nome: 'Chief of Staff', papel: 'abre o card e delega', x: 650, y: 8, t: 0.2, dica: 'Único papel que abre card e dispara o ciclo. Executa o que não muda código e organiza o quadro.' },
    { id: 'architect', agente: true, nome: 'Architect', papel: 'divide em fatias', x: 75, y: 100, t: 1.4, dica: 'Lê o manifesto, a onda e os critérios. Se duas fatias cobrem o mesmo caminho, o card para.' },
    { id: 'frontend', agente: true, nome: 'Frontend', papel: 'lê e opina: UI', x: 239, y: 100, t: 2.4, dica: 'Só lê e opina sobre a fatia de UI: arquivos, riscos e critérios.' },
    { id: 'backend', agente: true, nome: 'Backend', papel: 'lê e opina: API', x: 403, y: 100, t: 2.6, dica: 'Só lê e opina sobre a fatia de API: arquivos, riscos e critérios.' },
    { id: 'construtor', nome: 'Construtor', papel: 'escreve e testa', x: 567, y: 100, t: 3.0, dica: 'O agente do modo autônomo: escreve o código e roda os testes num container isolado, um por card.' },
    { id: 'qa', agente: true, nome: 'QA', papel: 'evidência dos testes', x: 731, y: 100, t: 4.8, dica: 'Lê a evidência. PASS só existe com resultado observado; NOT_RUN e BLOCKED são válidos.' },
    { id: 'security', agente: true, nome: 'Security', papel: 'somente leitura', x: 895, y: 100, t: 5.0, dica: 'Procura segredo, push protegido e aprovação de merge ausente. Não altera nada.' },
    { id: 'docs', agente: true, nome: 'Docs', papel: 'relatório do ciclo', x: 1059, y: 100, t: 5.2, dica: 'Escreve o relatório: o que foi observado e o que ficou de fora.' },
    { id: 'integrations', agente: true, nome: 'Integrations', papel: 'GitHub, Azure, Project', x: 1223, y: 100, t: 1.6, dica: 'Lê o repositório, organiza o GitHub Project e abre issue ou work item. Não faz merge.' },
    { id: 'merge', nome: 'Merge', papel: 'uma pessoa decide', x: 895, y: 192, t: 7.0, humano: true, dica: 'A única decisão humana. A Factory abre o pull request e para: merge e deploy são de uma pessoa.' }
  ]
  var ARESTAS = [
    ['chief-of-staff', 'architect'], ['chief-of-staff', 'frontend'], ['chief-of-staff', 'backend'], ['chief-of-staff', 'construtor'],
    ['chief-of-staff', 'qa'], ['chief-of-staff', 'security'], ['chief-of-staff', 'docs'], ['chief-of-staff', 'integrations'],
    ['qa', 'merge'], ['security', 'merge'], ['docs', 'merge']
  ]
  var porId = {}
  NOS.forEach(function (n) { porId[n.id] = n })

  var CSS = '#sf-time{position:relative;width:min(1180px,100%);margin:20px auto 8px;color:var(--foreground,currentColor)}' +
    '#sf-time header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 4px 4px}' +
    '#sf-time h2{margin:0;font-size:13px;font-weight:500}#sf-time .sub{color:var(--muted-foreground,#888);font-size:12px}' +
    '#sf-time svg{width:100%;height:auto;display:block;overflow:visible}' +
    '#sf-time{--sf-linha:color-mix(in srgb,var(--foreground,#888) 16%,transparent);--sf-luz:color-mix(in srgb,var(--foreground,#fff) 78%,transparent);--sf-ok:#3ecf6e;--sf-humano:#f5a25d}' +
    'html:not(.dark) #sf-time{--sf-ok:#137a3d;--sf-humano:#b85f12}' +
    '#sf-time .base{fill:none;stroke:var(--sf-linha);stroke-width:1.4}#sf-time .luz{fill:none;stroke:var(--sf-luz);stroke-width:1.6;stroke-linecap:round}' +
    '#sf-time .cabeca{fill:var(--foreground,#fff)}' +
    '#sf-time .no .caixa{fill:var(--card,#141414);stroke:var(--sf-linha);stroke-width:1;transition:stroke .15s}' +
    '#sf-time .no[data-agente="1"]{cursor:pointer}#sf-time .no:hover .caixa,#sf-time .no:focus-visible .caixa{stroke:var(--sf-luz)}#sf-time .no:focus-visible{outline:none}' +
    '#sf-time .no .nome{fill:var(--foreground,#fff);font:500 12.5px ui-sans-serif,system-ui,sans-serif}' +
    '#sf-time .no .papel{fill:var(--muted-foreground,#888);font:400 10.5px ui-sans-serif,system-ui,sans-serif}' +
    '#sf-time .no .ponto{fill:var(--muted-foreground,#888)}#sf-time .no.humano .caixa{stroke-dasharray:4 3}' +
    '#sf-time .dica{position:absolute;pointer-events:none;z-index:2;max-width:260px;padding:8px 11px;border-radius:10px;border:1px solid var(--sf-linha);background:var(--card,#141414);color:var(--foreground,#fff);font-size:12px;line-height:1.4;box-shadow:0 8px 28px rgba(0,0,0,.25);opacity:0;transition:opacity .12s}' +
    '#sf-time .dica b{display:block;font-weight:500;margin-bottom:2px}#sf-time .dica span{color:var(--muted-foreground,#888)}#sf-time .dica[data-ver="1"]{opacity:1}' +
    '#sf-time .legenda{display:flex;gap:16px;flex-wrap:wrap;margin:2px 6px 0;color:var(--muted-foreground,#888);font-size:11.5px}' +
    '#sf-time .legenda i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}'

  var secao = null, arestas = [], svg = null, dica = null
  var inicio = performance.now(), visivel = true, quadro = 0
  var parado = false
  try { parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) {}

  function el(tag, attrs, pai) {
    var e = document.createElementNS(NS, tag)
    for (var k in attrs) e.setAttribute(k, attrs[k])
    if (pai) pai.appendChild(e)
    return e
  }
  function html(tag, classe, texto) {
    var e = document.createElement(tag)
    if (classe) e.className = classe
    if (texto !== undefined) e.textContent = texto
    return e
  }
  function rota() {
    var r = location.pathname
    return r.length > 1 && r.charAt(r.length - 1) === '/' ? r.slice(0, -1) : r
  }
  function irPara(url) {
    history.pushState(null, '', url)
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
  }

  function construir() {
    if (!document.getElementById('sf-time-estilo')) {
      var estilo = document.createElement('style'); estilo.id = 'sf-time-estilo'; estilo.textContent = CSS; document.head.appendChild(estilo)
    }
    secao = html('section'); secao.id = 'sf-time'; secao.setAttribute('aria-labelledby', 'sf-time-t')
    var cab = html('header'); var h = html('h2', '', 'Como o time trabalha'); h.id = 'sf-time-t'
    cab.appendChild(h); cab.appendChild(html('span', 'sub', 'Do pedido ao pull request. A única decisão humana é o merge.'))
    secao.appendChild(cab)
    svg = el('svg', { viewBox: '0 0 1300 236', role: 'group', 'aria-label': 'Hierarquia do time de agentes: o Chief of Staff delega para o time; o merge é de uma pessoa.' })
    secao.appendChild(svg)
    var leg = html('div', 'legenda')
    var a = html('span'); var ia = html('i'); ia.style.background = 'var(--sf-ok)'; a.appendChild(ia); a.appendChild(document.createTextNode('trabalhando')); leg.appendChild(a)
    var b = html('span'); var ib = html('i'); ib.style.background = 'var(--sf-humano)'; b.appendChild(ib); b.appendChild(document.createTextNode('espera uma pessoa')); leg.appendChild(b)
    leg.appendChild(html('span', '', 'clique em um agente para abrir o chat'))
    secao.appendChild(leg)
    dica = html('div', 'dica'); dica.setAttribute('role', 'tooltip'); secao.appendChild(dica)

    var defs = el('defs', {}, svg)
    var filtro = el('filter', { id: 'sf-time-brilho', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs)
    el('feGaussianBlur', { stdDeviation: '3.2' }, filtro)
    var camadaA = el('g', {}, svg), camadaN = el('g', {}, svg)
    arestas = ARESTAS.map(function (par) {
      var a1 = porId[par[0]], b1 = porId[par[1]]
      var x1 = a1.x, y1 = a1.y + H, x2 = b1.x, y2 = b1.y, meio = (y1 + y2) / 2
      var d = 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + meio + ' ' + x2 + ' ' + meio + ' ' + x2 + ' ' + y2
      el('path', { d: d, 'class': 'base' }, camadaA)
      var luz = el('path', { d: d, 'class': 'luz' }, camadaA)
      var comp = 1
      try { comp = luz.getTotalLength() } catch (e) {}
      luz.setAttribute('stroke-dasharray', comp + ' ' + comp); luz.setAttribute('stroke-dashoffset', comp)
      var halo = el('circle', { r: 5, 'class': 'cabeca', filter: 'url(#sf-time-brilho)', opacity: 0 }, camadaA)
      var cabeca = el('circle', { r: 2.4, 'class': 'cabeca', opacity: 0 }, camadaA)
      return { a: a1, b: b1, luz: luz, comp: comp, halo: halo, cabeca: cabeca }
    })
    NOS.forEach(function (n) {
      var g = el('g', { 'class': 'no' + (n.humano ? ' humano' : ''), tabindex: n.agente ? 0 : -1, role: n.agente ? 'link' : 'img', 'aria-label': n.nome + ': ' + n.papel, 'data-agente': n.agente ? '1' : '0' }, camadaN)
      n.halo = el('rect', { x: n.x - W / 2 - 3, y: n.y - 3, width: W + 6, height: H + 6, rx: 13, filter: 'url(#sf-time-brilho)', opacity: 0, style: 'fill:' + (n.humano ? 'var(--sf-humano)' : 'var(--sf-ok)') }, g)
      el('rect', { x: n.x - W / 2, y: n.y, width: W, height: H, rx: 10, 'class': 'caixa' }, g)
      n.ponto = el('circle', { cx: n.x - W / 2 + 14, cy: n.y + H / 2, r: 3.6, 'class': 'ponto' }, g)
      var nome = el('text', { x: n.x - W / 2 + 26, y: n.y + 17, 'class': 'nome' }, g); nome.textContent = n.nome
      var papel = el('text', { x: n.x - W / 2 + 26, y: n.y + 31, 'class': 'papel' }, g); papel.textContent = n.papel
      g.addEventListener('mouseenter', function () { mostrar(n) })
      g.addEventListener('focus', function () { mostrar(n) })
      g.addEventListener('mouseleave', esconder)
      g.addEventListener('blur', esconder)
      if (n.agente) {
        g.addEventListener('click', function () { irPara('/studio/agents/' + n.id + '/threads/new') })
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irPara('/studio/agents/' + n.id + '/threads/new') } })
      }
    })
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visivel = e[0].isIntersecting }).observe(secao)
  }

  function mostrar(n) {
    dica.textContent = ''
    var b = html('b', '', n.nome), s = html('span', '', n.dica)
    dica.appendChild(b); dica.appendChild(s)
    var r = svg.getBoundingClientRect(), c = secao.getBoundingClientRect(), escala = r.width / 1300
    dica.style.left = Math.max(0, Math.min(c.width - 270, (n.x + W / 2 + 8) * escala + (r.left - c.left))) + 'px'
    dica.style.top = (n.y * escala + (r.top - c.top) + H * escala + 6) + 'px'
    dica.setAttribute('data-ver', '1')
  }
  function esconder() { if (dica) dica.removeAttribute('data-ver') }

  function suave(x) { return x * x * (3 - 2 * x) }
  function limitar(x) { return x < 0 ? 0 : x > 1 ? 1 : x }
  function renderizar(t) {
    var viva = 1 - suave(limitar((t - 10.2) / 1.4))
    arestas.forEach(function (ar) {
      var dur = 0.9, p = limitar((t - (ar.b.t - dur)) / dur)
      ar.luz.setAttribute('stroke-dashoffset', String(ar.comp * (1 - suave(p))))
      ar.luz.setAttribute('opacity', String(0.55 * viva))
      var voando = p > 0 && p < 1 ? viva : 0
      if (voando) {
        var pt = ar.luz.getPointAtLength(ar.comp * suave(p))
        ar.cabeca.setAttribute('cx', pt.x); ar.cabeca.setAttribute('cy', pt.y)
        ar.halo.setAttribute('cx', pt.x); ar.halo.setAttribute('cy', pt.y)
      }
      ar.cabeca.setAttribute('opacity', String(voando))
      ar.halo.setAttribute('opacity', String(voando * 0.9))
    })
    NOS.forEach(function (n) {
      var forca = suave(limitar((t - n.t) / 0.35)) * viva
      var pulso = n.humano ? 0.55 + 0.45 * Math.sin((t - n.t) * 3.2) : 1
      n.halo.setAttribute('opacity', String(forca * (n.humano ? 0.35 * pulso : 0.16)))
      n.ponto.style.fill = forca > 0.05 ? (n.humano ? 'var(--sf-humano)' : 'var(--sf-ok)') : ''
      n.ponto.setAttribute('opacity', String(0.35 + 0.65 * forca))
    })
  }
  function laco(agora) {
    quadro = 0
    if (!secao || !secao.isConnected) return
    if (visivel && !document.hidden) renderizar(((agora - inicio) / 1000) % CICLO)
    quadro = requestAnimationFrame(laco)
  }

  function ancora() {
    // Os links dos cards (ou das linhas) levam ao chat do agente. A barra lateral também tem listas: fica de fora.
    var links = document.querySelectorAll('a[href*="/studio/agents/"][href$="/threads/new"]')
    var primeiro = null
    for (var i = 0; i < links.length; i++) if (!links[i].closest('nav, aside')) { primeiro = links[i]; break }
    if (!primeiro) return null
    // Visão em cards: depois da grade. Visão em lista: depois da área de rolagem da tabela.
    return primeiro.closest('ul') || primeiro.closest('[class*="group/scroll-area"]')
  }
  function ajustar() {
    var aqui = rota() === '/studio/agents'
    if (!aqui) { if (secao && secao.isConnected) secao.remove(); return }
    var ref = ancora()
    if (!ref || !ref.parentElement) return
    if (secao && secao.isConnected && secao.previousElementSibling === ref) return
    if (!secao) construir()
    ref.insertAdjacentElement('afterend', secao)
    if (parado) renderizar(8.5)
    else if (!quadro) quadro = requestAnimationFrame(laco)
  }

  var agendado = false
  new MutationObserver(function () {
    if (agendado) return
    agendado = true
    requestAnimationFrame(function () { agendado = false; ajustar() })
  }).observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('popstate', ajustar)
  window.sfTimeSeek = function (t) { if (quadro) cancelAnimationFrame(quadro); quadro = 0; visivel = false; if (secao) renderizar(t) }
  ajustar()
})()
`
