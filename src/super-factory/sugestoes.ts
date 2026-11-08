// Sugestões com Tab, no estilo do Claude Code: o campo vazio mostra uma sugestão em cinza e Tab preenche.
// Pensado para quem não é técnico e não sabe o que escrever. Roda no Studio (injetado por marca.ts).
//
// Regras de projeto:
// - Os exemplos precisam passar na triagem da Factory. Um teste garante isso.
// - Repositório, branch e aprovador só sugerem o que a própria pessoa já usou. Nada inventado.
// - A nota de aprovação nunca é sugerida: uma frase pronta incentivaria carimbar o gate sem ler.

export type Amostra = { titulo: string; descricao: string; criterios: string }

export const AMOSTRAS: Amostra[] = [
  {
    titulo: 'Filtro de datas com hora',
    descricao: 'O filtro da API de pedidos quebra quando a data vem só com o dia. Precisa aceitar intervalo com hora e recusar fim anterior ao início.',
    criterios: 'O endpoint devolve 400 quando o fim do intervalo é anterior ao início.\nO filtro devolve os pedidos tanto para datas só com o dia quanto para datas com hora.',
  },
  {
    titulo: 'Exportar pedidos em CSV',
    descricao: 'Hoje não há como baixar a lista de pedidos. Precisa de um botão que gera um arquivo CSV com os pedidos que estão filtrados na tela.',
    criterios:
      'O arquivo traz uma linha por pedido e devolve id, cliente, valor e data em colunas separadas.\nCampos com vírgula não quebram as colunas.\nO botão mostra um aviso quando não há pedidos para exportar.',
  },
  {
    titulo: 'Mensagem de erro clara no login',
    descricao: 'Quando a senha está errada, a tela só mostra a palavra erro. Precisa dizer o que aconteceu e o que a pessoa deve fazer em seguida.',
    criterios: 'A tela mostra "Senha incorreta" quando a senha está errada.\nA mensagem some quando a pessoa volta a digitar.\nO campo de senha mantém o foco e não perde o que foi digitado depois do erro.',
  },
]

/** O que sugerir no chat de cada agente. A cada mensagem enviada, a sugestão passa para a próxima. */
export const CONVERSAS: Record<string, string[]> = {
  'chief-of-staff': ['Como está o quadro agora?', 'Planeje a próxima onda de cards', 'Valide estes critérios: o endpoint devolve 400 quando o fim do intervalo é anterior ao início'],
  architect: ['Quais fatias seguras dividem o card C-1 sem conflito?', 'Que riscos você vê neste pedido antes de implementar?', 'Explique o modo autônomo em poucas linhas'],
  frontend: ['O que muda na tela para o card C-1?', 'Liste os estados da tela: carregando, vazio e erro', 'Que cuidados de acessibilidade valem para este pedido?'],
  backend: ['Quais endpoints o card C-1 afeta?', 'Que casos de borda precisam de teste?', 'Como o filtro de datas deve tratar o fuso horário?'],
  integrations: ['Liste as issues abertas do GitHub', 'Liste os work items do Azure DevOps', 'O que falta para o modo autônomo abrir pull requests?'],
  qa: ['Quais checks ainda estão sem evidência?', 'O que está em NOT_RUN e por quê?', 'Revise os critérios do card C-1'],
  security: ['Algum segredo apareceu nos últimos cards?', 'Revise o diff do card C-1 sem alterar nada', 'Que permissões o token do GitHub precisa, no mínimo?'],
  docs: ['Escreva o resumo do card C-1 para o time', 'O que o README ainda não explica?', 'Resuma o que foi entregue nesta semana'],
  '*': ['Como está o quadro agora?', 'O que posso fazer a seguir?'],
}

/** Só o branch base tem valor padrão. Repositório e aprovador vêm do histórico de quem usa. */
export const PADROES: Record<string, string> = { branchBase: 'main' }

const DADOS = JSON.stringify({ amostras: AMOSTRAS, chat: CONVERSAS, padrao: PADROES }).replace(/</g, '\\u003c')

const CORPO = String.raw`
  var CHAVE = 'sf-sugestoes'
  var CAMPOS_DE_HISTORICO = ['repositorio', 'branchBase', 'branchHead', 'aprovador']
  var mem = {}
  try { mem = JSON.parse(localStorage.getItem(CHAVE) || '{}') || {} } catch (e) { mem = {} }
  function gravar() { try { localStorage.setItem(CHAVE, JSON.stringify(mem)) } catch (e) {} }

  function agenteDaUrl() {
    var m = /\/studio\/agents\/([^\/]+)/.exec(location.pathname)
    return m ? decodeURIComponent(m[1]) : null
  }
  function ehTexto(el) { return el && el.tagName && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) }
  function ehChat(el) {
    if (!agenteDaUrl() || el.tagName !== 'TEXTAREA' || el.name || !el.closest('form')) return false
    var original = el.hasAttribute('data-sf-orig') ? el.getAttribute('data-sf-orig') : el.placeholder
    return /message|mensagem/i.test(original || '')
  }

  function sugestaoDe(el) {
    if (!ehTexto(el) || el.disabled || el.readOnly || el.getAttribute('data-sf-off') === '1') return ''
    var nome = el.name
    if (nome === 'titulo' || nome === 'descricao' || nome === 'criterios') {
      return DADOS.amostras[(mem.amostra || 0) % DADOS.amostras.length][nome]
    }
    if (CAMPOS_DE_HISTORICO.indexOf(nome) >= 0) return mem[nome] || DADOS.padrao[nome] || ''
    if (ehChat(el)) {
      var agente = agenteDaUrl()
      var lista = DADOS.chat[agente] || DADOS.chat['*']
      return lista[((mem.chat && mem.chat[agente]) || 0) % lista.length]
    }
    return ''
  }

  // A sugestão aparece como placeholder (cinza, como no Claude Code) enquanto o campo está vazio.
  function aplicar(el) {
    if (!ehTexto(el)) return
    var s = el.value === '' ? sugestaoDe(el) : ''
    if (s) {
      if (!el.hasAttribute('data-sf-orig')) el.setAttribute('data-sf-orig', el.placeholder || '')
      if (el.placeholder !== s) el.placeholder = s
      el.setAttribute('data-sf-sug', '1')
      el.setAttribute('aria-description', 'Sugestão: ' + s.replace(/\n/g, ' ') + '. Pressione Tab para preencher.')
    } else if (el.hasAttribute('data-sf-sug')) {
      el.placeholder = el.getAttribute('data-sf-orig') || ''
      el.removeAttribute('data-sf-sug')
      el.removeAttribute('aria-description')
    }
  }
  function varrer() { document.querySelectorAll('textarea, input[type="text"]').forEach(aplicar) }

  // Preenche do jeito que o React entende: pelo setter nativo e com o evento de input.
  function aceitar(el) {
    var s = sugestaoDe(el)
    if (!s) return
    var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, s)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    try { el.setSelectionRange(s.length, s.length) } catch (e) {}
    aplicar(el)
    esconder()
  }

  // ---- dica "Tab preenche", flutuando no canto do campo
  var chip = null
  var alvo = null
  function criarChip() {
    var estilo = document.createElement('style')
    estilo.id = 'sf-sug-estilo'
    estilo.textContent = '#sf-sug-chip{position:fixed;z-index:2147482500;display:flex;gap:7px;align-items:center;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:#141414;color:#ededed;font:500 12px ui-sans-serif,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35);transition:opacity .12s}#sf-sug-chip[hidden]{display:none}html:not(.dark) #sf-sug-chip{background:#fff;color:#111;border-color:rgba(0,0,0,.18);box-shadow:0 6px 20px rgba(0,0,0,.12)}#sf-sug-chip .par{display:inline-flex;gap:6px;align-items:center}#sf-sug-chip kbd{font:600 11px ui-monospace,monospace;padding:1px 6px;border-radius:6px;border:1px solid currentColor;opacity:.85}[data-sf-sug="1"]::placeholder{opacity:.72}@media (prefers-reduced-motion: reduce){#sf-sug-chip{transition:none}}'
    document.head.appendChild(estilo)
    chip = document.createElement('button')
    chip.id = 'sf-sug-chip'
    chip.type = 'button'
    chip.hidden = true
    chip.setAttribute('aria-hidden', 'true')
    chip.tabIndex = -1
    function tecla(rotulo) { var k = document.createElement('kbd'); k.textContent = rotulo; return k }
    function texto(t) { var e = document.createElement('span'); e.textContent = t; return e }
    var par1 = document.createElement('span'); par1.className = 'par'; par1.appendChild(tecla('Tab')); par1.appendChild(texto('preenche'))
    var par2 = document.createElement('span'); par2.className = 'par'; par2.appendChild(tecla('Esc')); par2.appendChild(texto('ignora'))
    chip.appendChild(par1)
    chip.appendChild(texto('·'))
    chip.appendChild(par2)
    // O toque não pode tirar o foco do campo antes de preencher.
    chip.addEventListener('mousedown', function (e) { e.preventDefault() })
    chip.addEventListener('click', function () { if (alvo) aceitar(alvo) })
    document.body.appendChild(chip)
  }
  function posicionar() {
    if (!chip || !alvo || chip.hidden) return
    var r = alvo.getBoundingClientRect()
    var l = chip.offsetWidth
    // Logo acima do campo, no canto direito: nunca cobre o texto da sugestão. Sem espaço em cima, vai para baixo.
    var altura = chip.offsetHeight || 28
    chip.style.left = Math.max(8, Math.min(window.innerWidth - l - 8, r.right - l)) + 'px'
    chip.style.top = (r.top - altura - 8 >= 8 ? r.top - altura - 8 : Math.min(window.innerHeight - altura - 8, r.bottom + 8)) + 'px'
  }
  function mostrar(el) {
    if (!el || el.getAttribute('data-sf-sug') !== '1' || el.value !== '') return esconder()
    if (!chip) criarChip()
    alvo = el
    chip.hidden = false
    posicionar()
  }
  function esconder() { if (chip) chip.hidden = true }

  document.addEventListener('focusin', function (e) { aplicar(e.target); mostrar(e.target) })
  document.addEventListener('focusout', function () { esconder() })
  document.addEventListener('input', function (e) { aplicar(e.target); if (e.target === alvo) mostrar(e.target) }, true)
  window.addEventListener('scroll', posicionar, true)
  window.addEventListener('resize', posicionar)

  document.addEventListener('keydown', function (e) {
    var el = e.target
    if (!el || !el.getAttribute) return
    if (el.getAttribute('data-sf-sug') === '1' && el.value === '' && !e.isComposing) {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); aceitar(el); return }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); el.setAttribute('data-sf-off', '1'); aplicar(el); esconder(); return }
    }
    // Enter no chat envia a mensagem: a próxima sugestão entra no lugar.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && ehChat(el) && el.value.trim()) registrarChat()
  }, true)

  // ---- memória: o que a pessoa já usou vira a próxima sugestão
  var ultimoChat = 0
  function registrarChat() {
    var agora = Date.now()
    if (agora - ultimoChat < 600) return
    ultimoChat = agora
    var agente = agenteDaUrl()
    if (!agente) return
    mem.chat = mem.chat || {}
    mem.chat[agente] = (mem.chat[agente] || 0) + 1
    gravar()
    setTimeout(varrer, 350)
  }
  document.addEventListener('submit', function (e) {
    var f = e.target
    if (!f || !f.querySelector) return
    var mudou = false
    CAMPOS_DE_HISTORICO.forEach(function (nome) {
      var c = f.querySelector('[name="' + nome + '"]')
      if (c && c.value && c.value.trim()) { mem[nome] = c.value.trim().slice(0, 200); mudou = true }
    })
    if (f.querySelector('[name="titulo"]')) { mem.amostra = (mem.amostra || 0) + 1; mudou = true }
    if (mudou) { gravar(); setTimeout(varrer, 350) }
    var campo = f.querySelector('textarea')
    if (campo && ehChat(campo)) registrarChat()
  }, true)

  // O Studio redesenha a tela sozinho: reaplica as sugestões a cada mudança, sem pesar.
  var agendado = false
  new MutationObserver(function () {
    if (agendado) return
    agendado = true
    requestAnimationFrame(function () { agendado = false; varrer() })
  }).observe(document.documentElement, { subtree: true, childList: true })
  varrer()
`

export const SCRIPT_SUGESTOES = `(function () {\n  var DADOS = ${DADOS}\n${CORPO}\n})()`
