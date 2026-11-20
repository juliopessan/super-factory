// Chat do Studio no estilo do Claude Code: enquanto o agente trabalha, uma linha acima do campo de texto mostra
// um verbo da Super Factory e os segundos ("✻ Triando… (12s)"). Quando termina, a mensagem do agente ganha
// "✻ Trabalhou por 12s". O Studio só mostra um ponto pulsando nessa hora, então a linha é da Factory.

/** Verbos de cada agente, no vocabulário do projeto. Quem não está na lista usa PADRAO. */
export const VERBOS_POR_AGENTE: Record<string, string[]> = {
  'chief-of-staff': ['Triando…', 'Lendo o quadro…', 'Separando donos…', 'Montando a onda…', 'Conferindo os critérios…', 'Delegando…'],
  architect: ['Lendo o manifesto…', 'Separando donos…', 'Procurando caminhos que se sobrepõem…', 'Fatiando o card…'],
  frontend: ['Lendo a fatia de UI…', 'Conferindo os critérios…', 'Procurando o que a tela toca…'],
  backend: ['Lendo a fatia de API…', 'Conferindo os critérios…', 'Procurando o que a API toca…'],
  integrations: ['Lendo o GitHub…', 'Lendo o Project…', 'Organizando o quadro…', 'Conferindo o Azure DevOps…'],
  qa: ['Conferindo evidência…', 'Lendo a trilha do card…', 'Separando PASS de NOT_RUN…'],
  security: ['Procurando segredo…', 'Conferindo o gate do merge…', 'Lendo o diff com desconfiança…'],
  reviewer: ['Lendo o pull request…', 'Lendo o diff…', 'Conferindo os critérios…', 'Redigindo a revisão…'],
  docs: ['Lendo a trilha…', 'Redigindo o relatório…', 'Separando o observado do relatado…'],
}
export const VERBOS_PADRAO = ['Triando…', 'Especificando…', 'Conferindo evidência…', 'Lendo a trilha…', 'Esperando o gate…']

/** Ferramenta em uso → o que a Factory está fazendo. O nome vem do texto da mensagem em andamento. */
export const VERBOS_POR_FERRAMENTA: Record<string, string> = {
  statusQuadro: 'Lendo o quadro…',
  lerLedger: 'Lendo a trilha do card…',
  lintarCriterios: 'Conferindo os critérios…',
  abrirCard: 'Abrindo o card…',
  planejarOnda: 'Planejando a onda…',
  iniciarOnda: 'Disparando a onda…',
  avaliarGateMerge: 'Conferindo o gate do merge…',
  validarManifesto: 'Validando o manifesto…',
  listarGithub: 'Listando as issues…',
  importarIssuesGithub: 'Importando as issues etiquetadas…',
  criarIssueGithub: 'Abrindo a issue…',
  listarAzure: 'Lendo o Azure DevOps…',
  criarWorkItemAzure: 'Abrindo o work item…',
  lerProjetoGithub: 'Lendo o Project…',
  organizarProjetoGithub: 'Organizando o Project…',
  criarProjetoGithub: 'Criando o Project…',
  listarBranchesGithub: 'Listando as branches…',
  compararBranchesGithub: 'Comparando as branches…',
  listarArquivosGithub: 'Listando os arquivos…',
  lerArquivoGithub: 'Lendo o arquivo…',
  lerPullRequestGithub: 'Lendo o pull request…',
  comentarPullRequestGithub: 'Redigindo a revisão…',
  lerBaseProjeto: 'Lendo a base do projeto…',
  lerPoliticaProjeto: 'Lendo a política do projeto…',
  definirPoliticaProjeto: 'Gravando a política…',
  relatarMerge: 'Registrando o relato de merge…',
  conduzirInstalacao: 'Instalando a ferramenta…',
}

export const SCRIPT_TEMPO = `(function () {
  if (window.__sfTempo) return
  window.__sfTempo = true
  var POR_AGENTE = ${JSON.stringify(VERBOS_POR_AGENTE)}
  var PADRAO = ${JSON.stringify(VERBOS_PADRAO)}
  var POR_FERRAMENTA = ${JSON.stringify(VERBOS_POR_FERRAMENTA)}
  var CHAVE = 'sf-tempo'
  var MAXIMO_GUARDADO = 400

  // Duração no formato do Claude Code: 7s, 59s, 1m 05s, 12m 40s.
  function formatar(segundos) {
    var s = Math.max(0, Math.floor(segundos))
    if (s < 60) return s + 's'
    var r = s % 60
    return Math.floor(s / 60) + 'm ' + (r < 10 ? '0' : '') + r + 's'
  }
  window.sfTempoFormatar = formatar

  function rota() {
    var r = location.pathname
    return r.length > 1 && r.charAt(r.length - 1) === '/' ? r.slice(0, -1) : r
  }
  function conversa() {
    var p = rota().split('/')
    if (p.length === 6 && p[1] === 'studio' && p[2] === 'agents' && p[4] === 'threads' && p[3] && p[5]) return { agente: p[3], id: p[5] }
    return null
  }
  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {} } catch (e) { return {} }
  }
  function gravar(mapa) {
    try {
      var ids = Object.keys(mapa)
      if (ids.length > MAXIMO_GUARDADO) ids.slice(0, ids.length - MAXIMO_GUARDADO).forEach(function (id) { delete mapa[id] })
      localStorage.setItem(CHAVE, JSON.stringify(mapa))
    } catch (e) {}
  }
  function mensagensDoAgente() { return document.querySelectorAll('[data-slot="message"][data-from="assistant"]') }
  function ultimaDoAgente() { var m = mensagensDoAgente(); return m.length ? m[m.length - 1] : null }
  function idDe(m) { return m ? m.getAttribute('data-message-id') : null }
  // Em andamento: o Studio troca o botão de enviar por Cancel enquanto o agente responde.
  function rodando() { return !!document.querySelector('form button[aria-label="Cancel"]') }

  var inicio = 0
  var idAntes = null
  var linha = null
  var vez = 0
  var ultimaTroca = 0
  var verboAtual = ''

  function estilo() {
    if (document.getElementById('sf-estilo-tempo')) return
    var css = document.createElement('style')
    css.id = 'sf-estilo-tempo'
    css.textContent = '#sf-status{display:flex;align-items:baseline;gap:.5em;margin:0 auto 8px;padding:0 6px;width:100%;max-width:var(--chat-column,48rem);box-sizing:border-box;color:var(--muted-foreground,#8a8a8a);font-size:13px;line-height:1.4}' +
      '#sf-status .sf-g{display:inline-block;animation:sf-gira-t 1.6s linear infinite;color:var(--foreground,currentColor)}' +
      '#sf-status .sf-s{font-variant-numeric:tabular-nums;opacity:.85}' +
      '[data-sf-tempo]{margin:6px 0 0;color:var(--muted-foreground,#8a8a8a);font-size:12px;font-variant-numeric:tabular-nums}' +
      '.sf-so-leitor{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
      '@keyframes sf-gira-t{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){#sf-status .sf-g{animation:none}}'
    document.head.appendChild(css)
  }

  function formulario() { return document.querySelector('form') }

  function garantirLinha() {
    var form = formulario()
    if (!form || !form.parentElement) return null
    if (linha && linha.isConnected && linha.nextElementSibling === form) return linha
    if (linha) linha.remove()
    estilo()
    linha = document.createElement('div')
    linha.id = 'sf-status'
    linha.innerHTML = '<span class="sf-g" aria-hidden="true">✻</span><span class="sf-v" aria-hidden="true"></span><span class="sf-s" aria-hidden="true"></span><span class="sf-so-leitor" role="status"></span>'
    form.parentElement.insertBefore(linha, form)
    return linha
  }

  // Se a mensagem em andamento já mostra o nome de uma ferramenta, o verbo diz o que ela faz.
  function verboDaFerramenta() {
    var m = ultimaDoAgente()
    if (!m || idDe(m) === idAntes) return null
    var texto = m.textContent || ''
    var melhor = null
    var pos = -1
    Object.keys(POR_FERRAMENTA).forEach(function (nome) {
      var kebab = nome.replace(/([A-Z])/g, '-$1').toLowerCase()
      var a = Math.max(texto.lastIndexOf(nome), texto.lastIndexOf(kebab))
      if (a > pos) { pos = a; melhor = POR_FERRAMENTA[nome] }
    })
    return melhor
  }

  function atualizar(c) {
    var el = garantirLinha()
    if (!el) return
    var agora = Date.now()
    var segundos = (agora - inicio) / 1000
    var lista = POR_AGENTE[c.agente] || PADRAO
    var dica = verboDaFerramenta()
    if (dica) verboAtual = dica
    else if (!verboAtual || agora - ultimaTroca > 2600) {
      verboAtual = lista[vez++ % lista.length]
      ultimaTroca = agora
    }
    var v = el.querySelector('.sf-v')
    if (v.textContent !== verboAtual) v.textContent = verboAtual
    var s = '(' + formatar(segundos) + ')'
    var alvo = el.querySelector('.sf-s')
    if (alvo.textContent !== s) alvo.textContent = s
  }

  function comecar(c) {
    inicio = Date.now()
    idAntes = idDe(ultimaDoAgente())
    vez = Math.floor(Math.random() * 3)
    ultimaTroca = 0
    verboAtual = ''
    var el = garantirLinha()
    if (el) el.querySelector('.sf-so-leitor').textContent = 'Trabalhando'
    atualizar(c)
  }

  function marcar(m, segundos) {
    if (!m || m.querySelector('[data-sf-tempo]')) return
    var conteudo = m.querySelector('[data-slot="message-content"]')
    if (!conteudo) return
    estilo()
    var nota = document.createElement('div')
    nota.setAttribute('data-sf-tempo', '')
    nota.textContent = '✻ Trabalhou por ' + formatar(segundos)
    conteudo.insertAdjacentElement('afterend', nota)
  }

  function terminar() {
    var segundos = (Date.now() - inicio) / 1000
    var ultima = ultimaDoAgente()
    var novo = ultima && idDe(ultima) !== idAntes
    var antes = idAntes
    inicio = 0
    idAntes = null
    if (linha) { linha.remove(); linha = null }
    if (!novo) return
    var mapa = ler()
    mapa[idDe(ultima)] = Math.round(segundos * 10) / 10
    gravar(mapa)
    marcar(ultima, segundos)
    // O Studio pode trocar o id provisório pelo definitivo ao recarregar a conversa: guarda os dois.
    setTimeout(function () {
      var u = ultimaDoAgente()
      if (u && idDe(u) !== idDe(ultima) && idDe(u) !== antes) {
        var m2 = ler()
        m2[idDe(u)] = Math.round(segundos * 10) / 10
        gravar(m2)
        marcar(u, segundos)
      }
    }, 2500)
  }

  // Conversa reaberta: as mensagens que a Factory cronometrou voltam a mostrar o tempo.
  function reaplicar() {
    var mapa = ler()
    mensagensDoAgente().forEach(function (m) {
      var id = idDe(m)
      if (id && mapa[id] !== undefined) marcar(m, mapa[id])
    })
  }

  setInterval(function () {
    var c = conversa()
    if (!c) {
      if (linha) { linha.remove(); linha = null }
      inicio = 0
      return
    }
    var vai = rodando()
    if (vai && !inicio) comecar(c)
    else if (!vai && inicio) terminar()
    else if (vai && inicio) atualizar(c)
    reaplicar()
  }, 500)
})()`
