// Menu "/" e "@" no chat dos agentes.
//   "/"  ações: workflows e skills. Escolher só PREENCHE a mensagem com um modelo; quem executa é o agente, com as
//        mesmas ferramentas e travas de sempre. Merge e deploy não existem no menu.
//   "@"  referências a coisas que já existem: cards, pull requests e o repositório usado por último.
// Nada daqui executa, aprova ou faz merge. O que vem de fora (título de card) só aparece como texto no menu e,
// ao escolher, entra na mensagem apenas o identificador (C-12), nunca o título.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { redigirSegredos } from '../factory/guards.ts'
import { lerEstado } from '../factory/store.ts'

export type ItemDeSkill = { nome: string; descricao: string }
export type ItemDeCard = { id: string; titulo: string; coluna: string; pullRequestUrl: string | null }

const aqui = path.dirname(fileURLToPath(import.meta.url))

/** A pasta skills fica na raiz do projeto; no build de produção o cwd é outro, então procura para cima. */
function pastaDeSkills(): string | null {
  const pontos = [process.cwd(), path.resolve(aqui, '../..'), aqui]
  for (const inicio of pontos) {
    let atual = inicio
    for (let i = 0; i < 6; i++) {
      const candidata = path.join(atual, 'skills')
      try {
        if (fs.statSync(candidata).isDirectory() && fs.readdirSync(candidata).some((nome) => fs.existsSync(path.join(candidata, nome, 'SKILL.md')))) return candidata
      } catch {
        // segue procurando
      }
      const pai = path.dirname(atual)
      if (pai === atual) break
      atual = pai
    }
  }
  return null
}

/** Lê name e description do início do SKILL.md. A descrição pode ser dobrada (">-") em várias linhas. */
export function lerCabecalhoDeSkill(texto: string): ItemDeSkill | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto)
  if (!m) return null
  const linhas = (m[1] ?? '').split(/\r?\n/)
  let nome = ''
  const descricao: string[] = []
  let emDescricao = false
  for (const linha of linhas) {
    const chave = /^([A-Za-z_-]+):\s*(.*)$/.exec(linha)
    if (chave) {
      emDescricao = chave[1] === 'description'
      if (chave[1] === 'name') nome = (chave[2] ?? '').trim().replace(/^["']|["']$/g, '')
      else if (emDescricao && chave[2] && !/^[>|][-+]?$/.test(chave[2].trim())) descricao.push(chave[2].trim())
    } else if (emDescricao && linha.trim()) descricao.push(linha.trim())
  }
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(nome)) return null
  return { nome, descricao: descricao.join(' ').replace(/\s+/g, ' ').slice(0, 160) }
}

export function listarSkills(): ItemDeSkill[] {
  const pasta = pastaDeSkills()
  if (!pasta) return []
  const itens: ItemDeSkill[] = []
  for (const nome of fs.readdirSync(pasta).sort()) {
    try {
      const arquivo = path.join(pasta, nome, 'SKILL.md')
      if (!fs.existsSync(arquivo)) continue
      const item = lerCabecalhoDeSkill(fs.readFileSync(arquivo, 'utf8').slice(0, 4000))
      if (item) itens.push(item)
    } catch {
      // uma skill ilegível não derruba o menu
    }
  }
  return itens
}

export function cartoesRecentes(limite = 12): ItemDeCard[] {
  const estado = lerEstado()
  const prs = new Map<string, string>()
  for (const run of Object.values(estado.runs)) {
    const url = run.entrega?.pullRequestUrl
    if (url && /^https:\/\//.test(url)) prs.set(run.card.id, url)
  }
  const numero = (id: string) => Number.parseInt(id.replace(/\D+/g, ''), 10) || 0
  return [...estado.cards]
    .sort((a, b) => numero(b.id) - numero(a.id))
    .slice(0, limite)
    .map((card) => ({ id: card.id, titulo: redigirSegredos(card.titulo).slice(0, 80), coluna: card.coluna, pullRequestUrl: prs.get(card.id) ?? null }))
}

export function tratarMenu(req: Request): Response {
  const cabecalhos = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  if (req.method !== 'GET') return new Response(JSON.stringify({ erro: 'Método não permitido.' }), { status: 405, headers: cabecalhos })
  if (req.headers.get('sec-fetch-site') === 'cross-site') return new Response(JSON.stringify({ erro: 'Recusado.' }), { status: 403, headers: cabecalhos })
  try {
    return new Response(JSON.stringify({ skills: listarSkills(), cards: cartoesRecentes() }), { status: 200, headers: cabecalhos })
  } catch {
    // O menu continua com os atalhos fixos se a leitura falhar.
    return new Response(JSON.stringify({ skills: [], cards: [] }), { status: 200, headers: cabecalhos })
  }
}

export const SCRIPT_MENU = String.raw`
(function () {
  if (window.__sfMenu) return
  window.__sfMenu = true
  try {
  var MODELOS = {
    autonomo: { texto: 'Rode o modo autônomo para este card com iniciarOnda.\nTítulo: \nDescrição: \nCritérios de aceite (um por linha): \nRepositório: {repo}\nBranch base: main', foco: 'Título: ' },
    onda: { texto: 'Dispare uma onda de cards independentes com iniciarOnda (até 5, rodando em paralelo).\nCard 1 — Título: \nDescrição: \nCritérios de aceite: \nRepositório: {repo}\nBranch base: main\n\nCard 2 — Título: \nDescrição: \nCritérios de aceite: \nRepositório: {repo}\nBranch base: main', foco: 'Card 1 — Título: ' }
  }
  var ATALHOS = [
    { nome: 'quadro', descricao: 'Mostra o quadro: backlog, ready, build, qa, review, blocked e done.', tipo: 'atalho', agentes: ['chief-of-staff'], texto: 'Mostre o status do quadro e diga o que está esperando uma pessoa.' },
    { nome: 'branches', descricao: 'Compara as branches de um repositório e propõe como organizar no board.', tipo: 'atalho', agentes: ['chief-of-staff'], texto: 'Liste as branches de {repo}, compare todas de uma vez e proponha como organizar no board.', foco: 'de ' }
  ]
  var CHAVE = 'sf-sugestoes'
  var dados = null, carregando = false, carregadoEm = 0
  var workflows = null
  var menu = null, itens = [], ativo = 0, aberto = false, dispensado = '', alvo = null, token = null

  function agenteDaUrl() {
    var m = /\/studio\/agents\/([^\/]+)/.exec(location.pathname)
    return m ? decodeURIComponent(m[1]) : null
  }
  function ehChat(el) {
    if (!el || el.tagName !== 'TEXTAREA' || el.name || !agenteDaUrl() || !el.closest('form')) return false
    var original = el.hasAttribute('data-sf-orig') ? el.getAttribute('data-sf-orig') : el.placeholder
    return /message|mensagem/i.test(original || '')
  }
  function repoUsado() {
    try { return (JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}).repositorio || '' } catch (e) { return '' }
  }
  function sem(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }

  function carregar() {
    var agora = Date.now()
    if (carregando || (dados && agora - carregadoEm < 15000)) return
    carregando = true
    fetch('/factory/menu', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { skills: [], cards: [] } })
      .then(function (j) { dados = { skills: j.skills || [], cards: j.cards || [] }; carregadoEm = Date.now() })
      .catch(function () { dados = dados || { skills: [], cards: [] }; carregadoEm = Date.now() })
      .finally(function () { carregando = false; if (aberto && alvo) atualizar(alvo) })
    if (!workflows) {
      fetch('/api/workflows', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {} }).then(function (j) {
        workflows = Object.keys(j || {}).filter(function (id) { return !/-(input|output)-processor$/.test(id) }).map(function (id) { return { id: id, descricao: String((j[id] && j[id].description) || '').slice(0, 160) } })
        if (aberto && alvo) atualizar(alvo)
      }).catch(function () { workflows = [] })
    }
  }

  function itensDeAcao(agente) {
    var lista = []
    var ORDEM = ['autonomo', 'onda', 'sdlc']
    ;(workflows || []).slice().sort(function (a, b) { var x = ORDEM.indexOf(a.id), y = ORDEM.indexOf(b.id); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) }).forEach(function (w) {
      var modelo = MODELOS[w.id]
      if (modelo && agente === 'chief-of-staff') lista.push({ nome: w.id, descricao: w.descricao, tipo: 'workflow', texto: modelo.texto, foco: modelo.foco })
      else lista.push({ nome: w.id, descricao: w.descricao + ' Abre o workflow no Studio.', tipo: 'abrir', url: '/studio/workflows/' + encodeURIComponent(w.id) + '/graph' })
    })
    ATALHOS.forEach(function (a) { if (a.agentes.indexOf(agente) >= 0) lista.push(a) })
    ;((dados && dados.skills) || []).forEach(function (s) {
      lista.push({ nome: s.nome, descricao: s.descricao, tipo: 'skill', texto: 'Use a skill ' + s.nome + ' para: ', foco: null })
    })
    return lista
  }
  function itensDeReferencia() {
    var lista = []
    ;((dados && dados.cards) || []).forEach(function (c) {
      lista.push({ nome: c.id, descricao: c.titulo + ' · ' + c.coluna, tipo: 'card', texto: c.id })
      if (c.pullRequestUrl) lista.push({ nome: 'PR de ' + c.id, descricao: c.pullRequestUrl, tipo: 'pr', texto: c.pullRequestUrl })
    })
    var repo = repoUsado()
    if (repo) lista.push({ nome: repo, descricao: 'repositório usado por último', tipo: 'repo', texto: repo })
    return lista
  }
  function filtrar(lista, consulta) {
    var q = sem(consulta)
    if (!q) return lista.slice(0, 8)
    var pontos = []
    lista.forEach(function (it) {
      var n = sem(it.nome), d = sem(it.descricao)
      var p = n.indexOf(q) === 0 ? 3 : n.indexOf(q) > 0 ? 2 : d.indexOf(q) >= 0 ? 1 : 0
      if (p) pontos.push({ it: it, p: p })
    })
    pontos.sort(function (a, b) { return b.p - a.p })
    return pontos.slice(0, 8).map(function (x) { return x.it })
  }

  // ---- onde está o "/" ou o "@"
  function acharToken(el) {
    var pos = el.selectionStart
    if (pos === null || pos === undefined || pos !== el.selectionEnd) return null
    var antes = el.value.slice(0, pos)
    var barra = /^\/([A-Za-z0-9À-ÿ_-]*)$/.exec(antes)
    if (barra) return { tipo: '/', consulta: barra[1], inicio: 0, fim: pos }
    var arroba = /(^|\s)@([A-Za-z0-9À-ÿ_.\/-]*)$/.exec(antes)
    if (arroba) return { tipo: '@', consulta: arroba[2], inicio: pos - arroba[2].length - 1, fim: pos }
    return null
  }

  function estilo() {
    if (document.getElementById('sf-menu-estilo')) return
    var s = document.createElement('style'); s.id = 'sf-menu-estilo'
    s.textContent = '#sf-menu{position:fixed;z-index:2147482600;display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:14px;border:1px solid var(--border,rgba(128,128,128,.3));background:var(--card,#141414);color:var(--foreground,#ededed);box-shadow:0 10px 36px rgba(0,0,0,.35);font:13px/1.35 ui-sans-serif,system-ui,sans-serif;max-height:320px;overflow:auto}' +
      '#sf-menu[hidden]{display:none}#sf-menu [role=option]{display:grid;grid-template-columns:auto 1fr auto;gap:2px 10px;align-items:baseline;padding:7px 10px;border-radius:9px;cursor:pointer}' +
      '#sf-menu [role=option][aria-selected=true]{background:color-mix(in srgb,var(--foreground,#fff) 10%,transparent)}' +
      '#sf-menu .nome{font:500 12.5px ui-monospace,monospace}#sf-menu .desc{color:var(--muted-foreground,#888);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#sf-menu .tipo{font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-foreground,#888)}#sf-menu .dica{padding:4px 10px 2px;color:var(--muted-foreground,#888);font-size:11px}'
    document.head.appendChild(s)
  }
  function garantirMenu() {
    if (menu && menu.isConnected) return menu
    estilo()
    menu = document.createElement('div'); menu.id = 'sf-menu'; menu.hidden = true
    menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', 'Atalhos')
    menu.addEventListener('mousedown', function (e) { e.preventDefault() })
    document.body.appendChild(menu)
    return menu
  }
  var ROTULO = { workflow: 'workflow', abrir: 'workflow', skill: 'skill', atalho: 'atalho', card: 'card', pr: 'pr', repo: 'repo' }
  function desenhar() {
    var m = garantirMenu()
    m.textContent = ''
    itens.forEach(function (it, i) {
      var o = document.createElement('div'); o.setAttribute('role', 'option'); o.id = 'sf-menu-' + i
      o.setAttribute('aria-selected', i === ativo ? 'true' : 'false')
      var n = document.createElement('span'); n.className = 'nome'; n.textContent = (token && token.tipo === '/' ? '/' : '') + it.nome
      var d = document.createElement('span'); d.className = 'desc'; d.textContent = it.descricao || ''
      var t = document.createElement('span'); t.className = 'tipo'; t.textContent = ROTULO[it.tipo] || it.tipo
      o.appendChild(n); o.appendChild(d); o.appendChild(t)
      o.addEventListener('click', function () { escolher(i) })
      o.addEventListener('mousemove', function () { if (ativo !== i) { ativo = i; marcar() } })
      m.appendChild(o)
    })
    var dica = document.createElement('div'); dica.className = 'dica'; dica.textContent = '↑↓ navegar · Enter escolhe · Esc fecha'
    m.appendChild(dica)
    posicionar()
  }
  function marcar() {
    if (!menu) return
    var opcoes = menu.querySelectorAll('[role=option]')
    for (var i = 0; i < opcoes.length; i++) opcoes[i].setAttribute('aria-selected', i === ativo ? 'true' : 'false')
    if (alvo && opcoes[ativo]) { alvo.setAttribute('aria-activedescendant', opcoes[ativo].id); try { opcoes[ativo].scrollIntoView({ block: 'nearest' }) } catch (e) {} }
  }
  function posicionar() {
    if (!menu || !alvo) return
    var r = alvo.getBoundingClientRect()
    var largura = Math.min(560, Math.max(280, r.width))
    menu.style.width = largura + 'px'
    menu.style.left = Math.max(8, Math.min(window.innerWidth - largura - 8, r.left)) + 'px'
    var altura = menu.offsetHeight
    var acima = r.top - altura - 8
    menu.style.top = (acima >= 8 ? acima : Math.min(window.innerHeight - altura - 8, r.bottom + 8)) + 'px'
  }
  function fechar() {
    aberto = false; itens = []
    if (menu) menu.hidden = true
    if (alvo) { alvo.removeAttribute('aria-expanded'); alvo.removeAttribute('aria-activedescendant'); alvo.removeAttribute('aria-controls') }
  }
  function atualizar(el) {
    if (!ehChat(el) || el.disabled || el.readOnly) return fechar()
    var t = acharToken(el)
    if (!t) { dispensado = ''; return fechar() }
    if (dispensado && dispensado === t.tipo + t.consulta + ':' + t.inicio) return fechar()
    carregar()
    var base = t.tipo === '/' ? itensDeAcao(agenteDaUrl()) : itensDeReferencia()
    var achados = filtrar(base, t.consulta)
    if (achados.length === 0) return fechar()
    alvo = el; token = t; itens = achados
    if (ativo >= itens.length) ativo = 0
    aberto = true
    var m = garantirMenu()
    m.hidden = false
    el.setAttribute('aria-expanded', 'true'); el.setAttribute('aria-controls', 'sf-menu')
    desenhar(); marcar()
  }

  // Preenche do jeito que o React entende: setter nativo e evento de input.
  function escrever(el, valor, caret) {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, valor)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    try { el.setSelectionRange(caret, caret) } catch (e) {}
  }
  function escolher(i) {
    var it = itens[i], el = alvo, t = token
    if (!it || !el || !t) return fechar()
    if (it.tipo === 'abrir') {
      fechar(); escrever(el, '', 0)
      history.pushState(null, '', it.url); window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
      return
    }
    var texto = String(it.texto || '').replace('{repo}', repoUsado() || 'owner/repo')
    var valor = t.tipo === '/' ? texto : el.value.slice(0, t.inicio) + texto + (t.tipo === '@' ? ' ' : '') + el.value.slice(t.fim)
    var base = t.tipo === '/' ? 0 : t.inicio
    var caret = valor.length
    if (it.foco) { var p = valor.indexOf(it.foco, base); if (p >= 0) caret = p + it.foco.length }
    else if (t.tipo === '@') caret = t.inicio + texto.length + 1
    fechar(); dispensado = ''
    escrever(el, valor, caret)
    el.focus()
  }

  document.addEventListener('input', function (e) { if (e.target && e.target.tagName === 'TEXTAREA') { ativo = 0; atualizar(e.target) } }, true)
  document.addEventListener('click', function (e) { if (e.target && e.target.tagName === 'TEXTAREA') atualizar(e.target) }, true)
  document.addEventListener('focusout', function () { setTimeout(function () { if (document.activeElement !== alvo) fechar() }, 120) }, true)
  window.addEventListener('resize', posicionar)
  window.addEventListener('popstate', fechar)
  document.addEventListener('keydown', function (e) {
    if (!aberto || e.target !== alvo || e.isComposing || itens.length === 0) return
    var k = e.key
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation()
      ativo = (ativo + (k === 'ArrowDown' ? 1 : itens.length - 1)) % itens.length; marcar()
    } else if ((k === 'Enter' && !e.shiftKey) || (k === 'Tab' && !e.shiftKey)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      escolher(ativo)
    } else if (k === 'Escape') {
      e.preventDefault(); e.stopPropagation()
      dispensado = token.tipo + token.consulta + ':' + token.inicio; fechar()
    }
  }, true)
  } catch (erro) { /* o menu é conveniência: se falhar, o chat segue como sempre */ }
})()
`
