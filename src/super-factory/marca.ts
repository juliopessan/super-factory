import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { FASES_AUTONOMO } from '../factory/autonomo.ts'
import { marcarSegredos } from '../factory/guards.ts'
import { paginaConfiguracoes, tratarChaves } from './configuracoes.ts'
import { tratarMcps } from './configuracoes-mcps.ts'
import { paginaInicial } from './landing.ts'
import { SCRIPT_SUGESTOES } from './sugestoes.ts'
import { tratarAcesso, ehPublico, PAGINAS } from './acesso.ts'
import { lerConfig, porteiro } from './auth.ts'
import { SCRIPT_MENU, tratarMenu } from './menu.ts'
import { SCRIPT_TIME } from './time-animado.ts'

// Marca: tile claro (text-main-white) com a sigla no preto da página (surface-bg), em Greed.
const MARCA_FUNDO = '#f0f0f0'
const MARCA_TINTA = '#080808'
const MARCA_FONTE = 'Greed, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'
const MARCA_SVG_INTERNO = `<rect width="32" height="32" rx="8" fill="${MARCA_FUNDO}"></rect><text x="16" y="21.5" text-anchor="middle" font-family="${MARCA_FONTE}" font-size="13" font-weight="600" letter-spacing="0.3" fill="${MARCA_TINTA}" style="font-feature-settings:normal;font-variant:normal">SF</text>`
const ICONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">${MARCA_SVG_INTERNO}</svg>`

// As fases do modo autônomo, com os verbos que giram enquanto cada uma roda.
const FASES_NO_STUDIO = JSON.stringify(FASES_AUTONOMO.map((fase) => ({ id: fase.id, titulo: fase.titulo, verbos: fase.verbos })))

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
      svg.innerHTML = ${JSON.stringify(MARCA_SVG_INTERNO)}
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
    css.textContent = 'html:not(.dark) svg[data-sf="1"] rect{stroke:#d4d4d4;stroke-width:1.5px}[data-sf-verbo]::before{content:"✻";display:inline-block;margin-right:.45em;color:currentColor;animation:sf-gira 1.6s linear infinite}@keyframes sf-gira{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){[data-sf-verbo]::before{animation:none}}'
    document.head.appendChild(css)
  }

  // Modo autônomo: painel de fases sobre o canvas e verbo girando no nó que está rodando.
  var FASES = ${FASES_NO_STUDIO}
  var giroDaFase = {}
  var assinatura = ''
  function verboDa(fase) {
    var i = giroDaFase[fase.id] || 0
    return fase.verbos[i % fase.verbos.length]
  }
  function estiloDasFases() {
    if (document.getElementById('sf-estilo-fases')) return
    var css = document.createElement('style')
    css.id = 'sf-estilo-fases'
    css.textContent = [
      '#sf-fases{--sf-fundo:#0f0f0f;--sf-borda:#242424;--sf-tinta:#f0f0f0;--sf-cinza:#939393;--sf-trilho:#262626;--sf-ok:#7aff78;--sf-erro:#ff4758;position:fixed;z-index:30;box-sizing:border-box;padding:14px 18px 16px;border-radius:20px;background:var(--sf-fundo);border:1px solid var(--sf-borda);color:var(--sf-tinta);font:400 14.5px/1.36 Greed,ui-sans-serif,system-ui,sans-serif;letter-spacing:.255px;pointer-events:none}',
      'html:not(.dark) #sf-fases{--sf-fundo:#ffffff;--sf-borda:#e2e2e2;--sf-tinta:#111111;--sf-cinza:#5c5c5c;--sf-trilho:#ececec;--sf-ok:#14873a;--sf-erro:#c8102e}',
      '#sf-fases .sf-topo{display:flex;align-items:center;gap:10px;margin-bottom:12px;min-height:20px}',
      '#sf-fases .sf-giro{display:inline-block;width:1em;text-align:center}',
      '#sf-fases[data-fase=rodando] .sf-giro{animation:sf-gira 1.6s linear infinite}',
      '#sf-fases .sf-verbo{font-weight:520}',
      '#sf-fases[data-fase=feito] .sf-giro,#sf-fases[data-fase=feito] .sf-verbo{color:var(--sf-ok)}',
      '#sf-fases[data-fase=parou] .sf-giro,#sf-fases[data-fase=parou] .sf-verbo{color:var(--sf-erro)}',
      '#sf-fases .sf-conta{margin-left:auto;color:var(--sf-cinza);font:400 12px/1 "Commit Mono",ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}',
      '#sf-fases ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}',
      '#sf-fases li{display:flex;flex-direction:column;gap:7px;min-width:0}',
      '#sf-fases .sf-barra{height:4px;border-radius:57px;background:var(--sf-trilho);position:relative;overflow:hidden;transition:background-color .3s cubic-bezier(.4,0,.2,1)}',
      '#sf-fases li[data-estado=feito] .sf-barra{background:var(--sf-ok)}',
      '#sf-fases li[data-estado=parou] .sf-barra{background:var(--sf-erro)}',
      '#sf-fases li[data-estado=rodando] .sf-barra::after{content:"";position:absolute;inset:0;width:45%;border-radius:inherit;background:var(--sf-tinta);animation:sf-corre 1.1s cubic-bezier(.4,0,.2,1) infinite}',
      '#sf-fases .sf-nome{font-size:12px;line-height:16px;color:var(--sf-cinza);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#sf-fases li[data-estado=rodando] .sf-nome{color:var(--sf-tinta);font-weight:500}',
      '#sf-fases li[data-estado=feito] .sf-nome{color:var(--sf-tinta)}',
      '#sf-fases li[data-estado=parou] .sf-nome{color:var(--sf-erro);font-weight:500}',
      '@media (max-width:700px){#sf-fases .sf-nome{display:none}#sf-fases li[data-estado=rodando] .sf-nome,#sf-fases li[data-estado=parou] .sf-nome{display:block;overflow:visible}}',
      '[data-sf-rodando]{outline:1.5px solid currentColor;outline-offset:4px;border-radius:12px;animation:sf-pulsa 2s cubic-bezier(.4,0,.2,1) infinite}',
      '[data-sf-rodando]::before{content:"✻ " attr(data-sf-verbo-fase);position:absolute;left:0;top:-34px;z-index:2;padding:5px 12px;border-radius:57px;background:#f0f0f0;color:#080808;font:500 13px/1.2 Greed,ui-sans-serif,system-ui,sans-serif;letter-spacing:.255px;white-space:nowrap}',
      'html:not(.dark) [data-sf-rodando]::before{background:#111111;color:#ffffff}',
      '@keyframes sf-corre{from{transform:translateX(-100%)}to{transform:translateX(230%)}}',
      '@keyframes sf-pulsa{0%,100%{outline-color:rgba(240,240,240,.9)}50%{outline-color:rgba(240,240,240,.25)}}',
      '@media (prefers-reduced-motion: reduce){#sf-fases .sf-giro,#sf-fases li .sf-barra::after,[data-sf-rodando]{animation:none!important}#sf-fases li[data-estado=rodando] .sf-barra::after{width:100%;opacity:.5}}',
    ].join('')
    document.head.appendChild(css)
  }
  // Fica na área visível do canvas: à direita do painel do run, abaixo da linha do zoom.
  function posicionar(hud, flow) {
    if (!hud) return
    var area = flow.getBoundingClientRect()
    var esquerda = area.left
    var gatilho = Array.prototype.find.call(document.querySelectorAll('button'), function (b) { return b.textContent.trim() === 'Workflow run' })
    var painel = gatilho
    while (painel && painel.parentElement && painel.getBoundingClientRect().height < 120) painel = painel.parentElement
    if (painel && painel !== document.body) {
      var r = painel.getBoundingClientRect()
      if (r.right > esquerda && r.right < area.right - 280) esquerda = r.right
    }
    var zoom = document.querySelector('input[type=range]')
    var topo = area.top + 16
    if (zoom) {
      var z = zoom.closest('div') ? zoom.getBoundingClientRect() : null
      if (z && z.bottom > topo) topo = z.bottom + 18
    }
    var largura = Math.max(260, Math.min(760, area.right - esquerda - 32))
    var x = esquerda + (area.right - esquerda - largura) / 2
    var estilo = 'left:' + Math.round(x) + 'px;top:' + Math.round(topo) + 'px;width:' + Math.round(largura) + 'px'
    if (hud.getAttribute('style') !== estilo) hud.setAttribute('style', estilo)
  }
  window.addEventListener('resize', function () { assinatura = ''; painelDeFases() })
  function painelDeFases() {
    var nos = {}
    document.querySelectorAll('[data-workflow-step-key]').forEach(function (no) { nos[no.getAttribute('data-workflow-step-key')] = no })
    var hud = document.getElementById('sf-fases')
    var doAutonomo = FASES.every(function (fase) { return nos[fase.id] })
    var flow = document.querySelector('.react-flow')
    if (!doAutonomo || !flow || !flow.parentElement) { if (hud) hud.remove(); assinatura = ''; return }
    estiloDasFases()
    var estados = FASES.map(function (fase) {
      var status = nos[fase.id].getAttribute('data-workflow-step-status') || ''
      return status === 'success' ? 'feito' : status === 'running' || status === 'waiting' ? 'rodando' : status === 'failed' || status === 'bailed' || status === 'canceled' ? 'parou' : status === 'suspended' ? 'rodando' : 'espera'
    })
    var recebido = nos['receber-pedido'] ? nos['receber-pedido'].getAttribute('data-workflow-step-status') : ''
    var atual = estados.indexOf('rodando')
    var parou = estados.indexOf('parou')
    var feitas = estados.filter(function (e) { return e === 'feito' }).length
    var geral = parou >= 0 || recebido === 'failed' ? 'parou' : atual >= 0 ? 'rodando' : feitas === FASES.length ? 'feito' : feitas > 0 ? 'rodando' : 'espera'
    var foco = parou >= 0 ? parou : atual >= 0 ? atual : Math.min(feitas, FASES.length - 1)
    var verbo = geral === 'parou'
      ? (parou >= 0 ? 'Parou em ' + FASES[parou].titulo.toLowerCase() : 'Parou ao receber o pedido') + '. O motivo está no nó e no painel do run.'
      : geral === 'feito'
        ? 'Pull request aberto. Aguardando revisão humana para o merge.'
        : geral === 'espera'
          ? 'Modo autônomo em ' + FASES.length + ' fases. Rode para ver cada uma acender.'
          : verboDa(FASES[foco])
    var conta = geral === 'parou' && parou < 0 ? 'antes da fase 1' : geral === 'espera' ? FASES.length + ' fases' : geral === 'feito' ? FASES.length + ' de ' + FASES.length : 'Fase ' + (foco + 1) + ' de ' + FASES.length
    var nova = estados.join(',') + '|' + recebido + '|' + verbo + '|' + (hud && hud.parentElement === flow.parentElement ? '1' : '0')
    // Nó rodando: contorno e verbo da fase. Atributos não disparam o observer.
    FASES.forEach(function (fase, i) {
      var no = nos[fase.id]
      if (estados[i] === 'rodando') {
        no.setAttribute('data-sf-rodando', '')
        if (no.getAttribute('data-sf-verbo-fase') !== verboDa(fase)) no.setAttribute('data-sf-verbo-fase', verboDa(fase))
      } else if (no.hasAttribute('data-sf-rodando')) {
        no.removeAttribute('data-sf-rodando')
        no.removeAttribute('data-sf-verbo-fase')
      }
    })
    posicionar(hud, flow)
    if (nova === assinatura) return
    assinatura = nova
    if (!hud || hud.parentElement !== flow.parentElement) {
      if (hud) hud.remove()
      hud = document.createElement('div')
      hud.id = 'sf-fases'
      hud.innerHTML = '<div class="sf-topo"><span class="sf-giro" aria-hidden="true">✻</span><span class="sf-verbo" aria-hidden="true"></span><span class="sf-conta" role="status"></span></div><ol></ol>'
      var lista = hud.querySelector('ol')
      FASES.forEach(function (fase) {
        var li = document.createElement('li')
        li.setAttribute('data-fase-id', fase.id)
        li.innerHTML = '<span class="sf-barra"></span><span class="sf-nome"></span>'
        li.querySelector('.sf-nome').textContent = fase.titulo
        lista.appendChild(li)
      })
      flow.parentElement.appendChild(hud)
    }
    hud.setAttribute('data-fase', geral)
    hud.querySelector('.sf-giro').textContent = geral === 'feito' ? '✓' : geral === 'parou' ? '✕' : '✻'
    hud.querySelector('.sf-verbo').textContent = verbo
    var rotulo = geral === 'rodando' ? conta + ': ' + FASES[foco].titulo : conta
    if (hud.querySelector('.sf-conta').textContent !== conta) hud.querySelector('.sf-conta').textContent = conta
    hud.querySelector('.sf-conta').setAttribute('aria-label', rotulo)
    hud.querySelectorAll('li').forEach(function (li, i) {
      if (li.getAttribute('data-estado') !== estados[i]) li.setAttribute('data-estado', estados[i])
    })
  }
  setInterval(function () {
    FASES.forEach(function (fase) { giroDaFase[fase.id] = (giroDaFase[fase.id] || 0) + 1 })
    painelDeFases()
  }, 1700)

  // Lista de agentes: abre nos cartões (Compact view), que leem melhor que a tabela. O Studio não guarda a escolha,
  // então quem prefere a tabela clica em List view e a Factory lembra disso neste navegador.
  var visaoAplicada = ''
  function visaoDosAgentes() {
    var rota = location.pathname
    if (rota.length > 1 && rota.charAt(rota.length - 1) === '/') rota = rota.slice(0, -1)
    if (rota !== '/studio/agents') { visaoAplicada = ''; return }
    if (visaoAplicada === rota) return
    var compacta = document.querySelector('button[aria-label="Compact view"]')
    if (!compacta || !document.querySelector('button[aria-label="List view"]')) return
    visaoAplicada = rota
    var escolha = null
    try { escolha = localStorage.getItem('sf-visao-agentes') } catch (e) {}
    if (escolha !== 'lista' && compacta.getAttribute('aria-pressed') === 'false') compacta.click()
  }
  // Só o clique de uma pessoa vale como escolha: o clique automático acima não passa de isTrusted.
  document.addEventListener('click', function (e) {
    if (!e.isTrusted || !e.target || !e.target.closest) return
    var botao = e.target.closest('button[aria-label]')
    var rotulo = botao ? botao.getAttribute('aria-label') : ''
    try {
      if (rotulo === 'List view') localStorage.setItem('sf-visao-agentes', 'lista')
      else if (rotulo === 'Compact view') localStorage.removeItem('sf-visao-agentes')
    } catch (x) {}
  }, true)

  // Popup de configuração dentro do Studio: abre /configuracoes (aba Chaves ou Ferramentas MCP).
  function popupDeChaves(aba) {
    if (document.getElementById('sf-chaves-fundo')) return
    var tema = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    var titulo = aba === 'mcps' ? 'Ferramentas (MCP)' : 'Chaves e acessos'
    var fundo = document.createElement('div')
    fundo.id = 'sf-chaves-fundo'
    fundo.setAttribute('role', 'dialog')
    fundo.setAttribute('aria-modal', 'true')
    fundo.setAttribute('aria-label', titulo)
    fundo.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);display:grid;place-items:center;padding:16px'
    var caixa = document.createElement('iframe')
    caixa.src = '/configuracoes?embed=1&tema=' + tema + (aba === 'mcps' ? '#mcps' : '')
    caixa.title = titulo
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
  function rotaDoStudio() {
    var rota = location.pathname
    return rota.length > 1 && rota.charAt(rota.length - 1) === '/' ? rota.slice(0, -1) : rota
  }
  function temaDoStudio() { return document.documentElement.classList.contains('dark') ? 'dark' : 'light' }

  // Conversa com o agente: o Studio abre uma conversa nova toda vez que a pessoa volta para o agente, e o que ela
  // começou fica escondido na lista de threads. A Factory lembra a última conversa de cada agente e a reabre.
  // O trabalho do agente segue no servidor enquanto a pessoa está em outra tela; a conversa só precisa ser reaberta.
  var conversaNovaPedida = ''
  var conversaReaberta = ''
  function partesDaConversa() {
    var p = rotaDoStudio().split('/')
    if (p.length === 6 && p[1] === 'studio' && p[2] === 'agents' && p[4] === 'threads' && p[3] && p[5]) return { agente: p[3], id: p[5] }
    return null
  }
  function conversaDoAgente() {
    var c = partesDaConversa()
    if (!c || c.id !== 'new') conversaReaberta = ''
    if (!c) return
    var chave = 'sf-conversa-' + c.agente
    if (c.id !== 'new') {
      try { localStorage.setItem(chave, c.id) } catch (e) {}
      if (conversaNovaPedida === c.agente) conversaNovaPedida = ''
      return
    }
    if (conversaNovaPedida === c.agente) return
    var guardada = null
    try { guardada = localStorage.getItem(chave) } catch (e) {}
    if (!guardada || conversaReaberta === c.agente + '/' + guardada) return
    conversaReaberta = c.agente + '/' + guardada
    // Só reabre se a conversa ainda existe (a pessoa pode ter apagado).
    fetch('/api/memory/threads/' + encodeURIComponent(guardada) + '?agentId=' + encodeURIComponent(c.agente)).then(function (r) {
      if (!r.ok) { try { localStorage.removeItem(chave) } catch (e) {} ; return }
      var agora = partesDaConversa()
      if (!agora || agora.id !== 'new' || agora.agente !== c.agente || conversaNovaPedida === c.agente) return
      history.replaceState(history.state, '', '/studio/agents/' + c.agente + '/threads/' + guardada)
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
    }).catch(function () {})
  }
  // "New Thread" clicado por uma pessoa é um pedido de conversa nova: a Factory não reabre a anterior.
  document.addEventListener('click', function (e) {
    if (!e.isTrusted || !e.target || !e.target.closest) return
    var novo = e.target.closest('a[href$="/threads/new"]')
    if (!novo) return
    var m = (novo.getAttribute('href') || '').split('/')
    // O card do agente na lista também aponta para /threads/new: só vale como pedido quem já está num chat do mesmo agente.
    var aqui = partesDaConversa()
    if (aqui && m.length >= 5 && m[3] === aqui.agente) conversaNovaPedida = m[3]
  }, true)

  // Tools e MCP Servers: botão "+" ao lado do filtro abre a instalação de ferramentas (MCP).
  function botaoMais() {
    var rota = rotaDoStudio()
    var certo = rota === '/studio/tools' || rota === '/studio/mcps'
    var atual = document.getElementById('sf-mais-mcp')
    if (!certo) { if (atual) atual.remove(); return }
    var filtro = document.querySelector('input[placeholder="Filter by name"]')
    var linha = filtro && filtro.closest('.flex-wrap')
    if (!linha) return
    var rotulo = rota === '/studio/tools' ? 'Adicionar ferramentas (MCP)' : 'Adicionar servidor MCP'
    if (atual && atual.parentElement === linha) { if (atual.getAttribute('aria-label') !== rotulo) { atual.setAttribute('aria-label', rotulo); atual.title = rotulo } return }
    if (atual) atual.remove()
    var b = document.createElement('button')
    b.id = 'sf-mais-mcp'
    b.type = 'button'
    b.setAttribute('aria-label', rotulo)
    b.setAttribute('aria-haspopup', 'dialog')
    b.title = rotulo
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>'
    b.style.cssText = 'display:inline-grid;place-items:center;width:32px;height:32px;flex:none;border-radius:999px;border:1px solid var(--border,rgba(128,128,128,.3));background:var(--card,transparent);color:var(--foreground,currentColor);cursor:pointer'
    b.addEventListener('click', function () { popupDeChaves('mcps') })
    linha.appendChild(b)
  }

  // Settings: "Chaves e acessos" vira uma seção da própria página, no mesmo formato das outras.
  function secaoDeChaves() {
    var atual = document.getElementById('sf-chaves-secao')
    if (rotaDoStudio() !== '/studio/settings') { if (atual) atual.remove(); return }
    var conteudo = document.querySelector('[data-slot="settings-layout-content"] .flex-col.gap-8')
    if (!conteudo) return
    if (atual && atual.parentElement === conteudo) { aplicarTemaNaSecao(); return }
    if (atual) atual.remove()
    var secao = document.createElement('section')
    secao.id = 'sf-chaves-secao'
    secao.setAttribute('aria-labelledby', 'sf-chaves-titulo')
    secao.className = 'flex min-w-0 scroll-mt-4 flex-col gap-2'
    secao.innerHTML = '<header class="flex flex-col gap-1"><h2 id="sf-chaves-titulo" class="text-subheading text-foreground">Chaves e acessos</h2><p class="text-caption text-muted-foreground">Criptografadas no servidor. Nunca aparecem de novo e valem na hora, sem reiniciar.</p></header>'
    var quadro = document.createElement('iframe')
    quadro.title = 'Chaves e acessos'
    quadro.src = '/configuracoes?embed=secao&tema=' + temaDoStudio()
    quadro.style.cssText = 'width:100%;height:640px;border:0;background:transparent;color-scheme:normal'
    quadro.setAttribute('allowtransparency', 'true')
    secao.appendChild(quadro)
    conteudo.appendChild(secao)
    // Com o login da Factory ligado: quem está conectado, o painel da waitlist (admin) e o botão de sair.
    fetch('/auth/eu', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null }).then(function (j) {
      if (!j || !j.ativo) return
      var cab = secao.querySelector('header')
      if (!cab) return
      var p = document.createElement('p'); p.className = 'text-caption text-muted-foreground'; p.id = 'sf-sessao'
      p.appendChild(document.createTextNode('Conectado como @' + j.login + (j.admin ? ' (admin) · ' : ' · ')))
      if (j.admin) { var w = document.createElement('a'); w.href = '/admin/waitlist'; w.textContent = 'Waitlist'; w.style.textDecoration = 'underline'; p.appendChild(w); p.appendChild(document.createTextNode(' · ')) }
      var a = document.createElement('a'); a.href = '/auth/sair'; a.textContent = 'Sair'; a.style.textDecoration = 'underline'; p.appendChild(a)
      cab.appendChild(p)
    }).catch(function () {})
  }
  function aplicarTemaNaSecao() {
    var quadro = document.querySelector('#sf-chaves-secao iframe')
    try { if (quadro && quadro.contentDocument) quadro.contentDocument.documentElement.setAttribute('data-tema', temaDoStudio()) } catch (e) {}
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.sf !== 'altura') return
    var quadro = document.querySelector('#sf-chaves-secao iframe')
    var h = Number(e.data.h)
    if (quadro && h > 0 && h < 6000) quadro.style.height = Math.ceil(h) + 'px'
  })
  function enfeites() { botaoMais(); secaoDeChaves(); conversaDoAgente() }
  function ligar() {
    estilo()
    enfeites()
    visaoDosAgentes()
    new MutationObserver(function () { marcar(); enfeites(); painelDeFases(); visaoDosAgentes(); aplicarTemaNaSecao() }).observe(document.documentElement, { subtree: true, childList: true, characterData: true })
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

// Vídeo e pôster da apresentação: arquivo estático, com Range para o Safari conseguir tocar.
const ARQUIVOS_PUBLICOS: Record<string, string> = {
  '/motion/super-factory-hero.mp4': 'video/mp4',
  '/motion/super-factory-hero.jpg': 'image/jpeg',
}

function arquivoPublico(caminho: string, cabecalhoRange: string | null): Response {
  const tipo = ARQUIVOS_PUBLICOS[caminho]!
  // O módulo roda empacotado e o cwd muda conforme o modo (dev, build, imagem). Sobe a partir
  // do cwd testando as duas formas: public/<arquivo> e src/super-factory/public/<arquivo>.
  const nome = path.basename(caminho)
  const candidatos: string[] = []
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    candidatos.push(path.join(dir, 'public', nome), path.join(dir, 'src', 'super-factory', 'public', nome))
    if (path.dirname(dir) === dir) break
  }
  const arquivo = candidatos.find((candidato) => existsSync(candidato)) ?? ''
  let tamanho: number
  try {
    if (!arquivo) throw new Error('sem arquivo')
    tamanho = statSync(arquivo).size
  } catch {
    return new Response('', { status: 404 })
  }
  const base = { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' }
  const faixa = cabecalhoRange?.match(/^bytes=(\d*)-(\d*)$/)
  if (faixa && (faixa[1] || faixa[2])) {
    const inicio = faixa[1] ? Number(faixa[1]) : Math.max(0, tamanho - Number(faixa[2]))
    const fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), tamanho - 1) : tamanho - 1
    if (inicio > fim || inicio >= tamanho) {
      return new Response('', { status: 416, headers: { ...base, 'Content-Range': `bytes */${tamanho}` } })
    }
    const corpo = readFileSync(arquivo).subarray(inicio, fim + 1)
    return new Response(corpo, { status: 206, headers: { ...base, 'Content-Length': String(corpo.length), 'Content-Range': `bytes ${inicio}-${fim}/${tamanho}` } })
  }
  return new Response(readFileSync(arquivo), { status: 200, headers: { ...base, 'Content-Length': String(tamanho) } })
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

/** SUPER_FACTORY_MENU=0 desliga o menu / e @ sem mexer no resto. */
function menuLigado(): boolean {
  return process.env.SUPER_FACTORY_MENU?.trim() !== '0'
}

// Aviso no início: login ligado com configuração incompleta fecha tudo que não é público.
{
  const inicial = lerConfig()
  if (inicial.modo === 'github') console.log(`[auth] login com GitHub ligado (${inicial.admins.length} admin). Público: landing, /login e /waitlist.`)
  else if (inicial.modo === 'invalido') console.warn(`[auth] SUPER_FACTORY_AUTH=github, mas falta: ${inicial.faltando.join(', ')}. Tudo fora das páginas públicas fica fechado.`)
}

export async function marcaSuperFactory(c: { req: Pedido; res: Response }, next: () => Promise<void>) {
  const caminho = c.req.path
  // O porteiro vem antes de qualquer leitura de corpo: quem não entrou não gasta nada do servidor.
  const cfg = lerConfig()
  const decisao = await porteiro(c.req.raw, cfg, (p) => ehPublico(p, Object.keys(ARQUIVOS_PUBLICOS)), PAGINAS)
  if (decisao.tipo === 'resposta') return decisao.resposta
  const acesso = await tratarAcesso(c.req.raw, cfg, decisao.usuario)
  if (acesso) return acesso
  await limparEntrada(c.req)
  if (caminho === '/motion.js') return motionJs()
  if (caminho in ARQUIVOS_PUBLICOS) return arquivoPublico(caminho, c.req.raw.headers.get('range'))
  if (caminho === '/configuracoes' || caminho === '/configuracoes/') {
    const consulta = new URL(c.req.raw.url).searchParams
    const tema = consulta.get('tema')
    return paginaConfiguracoes({ embed: consulta.get('embed') === '1', secao: consulta.get('embed') === 'secao', tema: tema === 'dark' || tema === 'light' ? tema : null })
  }
  if (caminho === '/configuracoes/chaves') return tratarChaves(c.req.raw)
  if (caminho === '/configuracoes/mcps') return tratarMcps(c.req.raw)
  if (caminho === '/factory/menu') return tratarMenu(c.req.raw)
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
    .replace('</body>', `<script>${SCRIPT}</script><script>${SCRIPT_SUGESTOES}</script><script>${SCRIPT_TIME}</script>${menuLigado() ? `<script>${SCRIPT_MENU}</script>` : ''}</body>`)
  const headers = new Headers(c.res.headers)
  headers.delete('content-length')
  c.res = new Response(marcado, { status: c.res.status, headers })
}
