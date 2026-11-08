// Tela da aba "Ferramentas (MCP)": estilo e script que a página de configurações embute.
// O script não usa crase nem interpolação, porque vive dentro de um template do TypeScript.

export const ESTILO_MCPS = String.raw`
  .abas { display: flex; gap: 6px; margin: 18px 0 4px; border-bottom: 1px solid var(--line); }
  .aba { border: 0; border-bottom: 2px solid transparent; border-radius: 0; padding: 8px 12px; margin-bottom: -1px; color: var(--muted); background: transparent; }
  .aba[aria-selected="true"] { color: var(--text); border-bottom-color: var(--text); }
  section[hidden] { display: none; }
  input[type="checkbox"] { flex: none; width: 18px; height: 18px; min-width: 0; padding: 0; accent-color: var(--text); }
  textarea { flex: 1 1 220px; min-width: 0; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--card-2); color: var(--text); font: 14px "Geist Mono", monospace; resize: vertical; }
  textarea:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  select { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--card-2); color: var(--text); font: 14px "Geist Mono", monospace; }
  .campo { display: flex; flex-direction: column; gap: 4px; margin-top: 12px; }
  .campo > span { font-size: 13px; color: var(--muted); }
  .campo input, .campo textarea, .campo select { flex: none; width: 100%; }
  .destino { margin-top: 6px; font: 400 12px "Geist Mono", monospace; color: var(--muted); word-break: break-all; }
  details { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 10px; }
  summary { cursor: pointer; font-size: 14px; color: var(--text); }
  .ferr { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .ferr:last-child { border-bottom: 0; }
  .ferr .texto { flex: 1; min-width: 0; }
  .ferr .nome { font: 500 13px "Geist Mono", monospace; word-break: break-all; }
  .ferr small { display: block; margin-top: 2px; color: var(--muted); font-size: 12.5px; line-height: 1.4; }
  .selo { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 99px; border: 1px solid var(--line-2); font: 400 11px "Geist Mono", monospace; color: var(--muted); vertical-align: 1px; }
  .selo.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
  .selo.bloq { color: var(--erro); border-color: color-mix(in srgb, var(--erro) 45%, transparent); }
  .secreto { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
  .secreto code { font: 13px "Geist Mono", monospace; }
`

export const SCRIPT_MCPS = String.raw`
(function () {
  var abaChaves = document.getElementById('aba-chaves')
  var abaMcps = document.getElementById('aba-mcps')
  var painelChaves = document.getElementById('painel-chaves')
  var painelMcps = document.getElementById('painel-mcps')
  var lista = document.getElementById('mcp-lista')
  var carregou = false
  var abertos = {}
  var estadoAtual = null

  function criar(tag, classe, texto) {
    var e = document.createElement(tag)
    if (classe) e.className = classe
    if (texto !== undefined) e.textContent = texto
    return e
  }
  function campo(rotulo, controle) {
    var c = criar('label', 'campo')
    c.appendChild(criar('span', '', rotulo))
    c.appendChild(controle)
    return c
  }
  function entrada(tipo, marca) {
    var i = criar('input')
    i.type = tipo
    i.autocomplete = 'new-password'
    i.spellcheck = false
    i.setAttribute('data-1p-ignore', '')
    if (marca) i.placeholder = marca
    return i
  }
  function chamar(corpo) {
    return fetch('/configuracoes/mcps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': '1' },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, corpo: j } }) })
  }

  // ---- abas
  function aba(qual, foco) {
    var mcps = qual === 'mcps'
    abaChaves.setAttribute('aria-selected', mcps ? 'false' : 'true')
    abaMcps.setAttribute('aria-selected', mcps ? 'true' : 'false')
    abaChaves.tabIndex = mcps ? -1 : 0
    abaMcps.tabIndex = mcps ? 0 : -1
    painelChaves.hidden = mcps
    painelMcps.hidden = !mcps
    if (foco) (mcps ? abaMcps : abaChaves).focus()
    if (mcps && !carregou) { carregou = true; carregar() }
    try { history.replaceState(null, '', mcps ? '#mcps' : location.pathname + location.search) } catch (e) {}
  }
  abaChaves.addEventListener('click', function () { aba('chaves') })
  abaMcps.addEventListener('click', function () { aba('mcps') })
  document.querySelector('.abas').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'End') { e.preventDefault(); aba('mcps', true) }
    if (e.key === 'ArrowLeft' || e.key === 'Home') { e.preventDefault(); aba('chaves', true) }
  })

  function carregar() {
    return fetch('/configuracoes/mcps', { cache: 'no-store' }).then(function (r) { return r.json() }).then(desenhar).catch(function () {
      lista.textContent = ''
      lista.appendChild(criar('div', 'aviso erro', 'Não consegui carregar as ferramentas.'))
    })
  }

  function chipDe(item) {
    var s = item.situacao
    if (s.estado === 'conectado') return criar('span', 'estado ok', 'conectado · ' + s.ferramentas.length + (s.ferramentas.length === 1 ? ' ferramenta' : ' ferramentas'))
    if (s.estado === 'erro') return criar('span', 'estado falta', 'com erro')
    if (s.estado === 'desativado') return criar('span', 'estado', 'desativado')
    return criar('span', 'estado', 'conecta no primeiro uso')
  }

  function dizer(msg, classe, texto) { msg.className = 'msg ' + classe; msg.textContent = texto }
  function ocupar(raiz, sim) { var bs = raiz.querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].disabled = sim }

  // Resposta de uma instalação: instalou, falhou o teste (com a saída "mesmo assim") ou deu erro.
  function aposInstalar(r, msg, refazer, id) {
    if (r.corpo.erro) return dizer(msg, 'erro', r.corpo.erro)
    if (r.corpo.instalado) {
      if (id) abertos['ferr-' + id] = true
      return desenhar(r.corpo.estado)
    }
    var teste = r.corpo.teste || {}
    dizer(msg, 'erro', teste.erro || 'Não consegui conectar.')
    if (teste.tipoDoErro === 'sem-resposta') {
      var b = criar('button', '', 'Instalar mesmo assim'); b.type = 'button'
      b.addEventListener('click', function () { refazer(true) })
      msg.appendChild(document.createTextNode(' ')); msg.appendChild(b)
    }
  }

  // ---- instalados
  function cartaoInstalado(item) {
    var f = criar('div', 'chave')
    f.setAttribute('data-mcp', item.id)
    var topo = criar('div', 'topo')
    topo.appendChild(criar('b', '', item.nome))
    topo.appendChild(chipDe(item))
    f.appendChild(topo)
    f.appendChild(criar('div', 'destino', item.destino))
    var quem = item.origem === 'catalogo' ? 'Do catálogo' : 'Personalizado'
    f.appendChild(criar('p', 'ajuda', quem + (item.por ? ' · instalado por ' + item.por : '')))
    var msg = criar('div', 'msg'); msg.setAttribute('role', 'status')
    if (item.situacao.estado === 'erro') dizer(msg, 'erro', item.situacao.erro || 'Não consegui conectar.')

    var linha = criar('div', 'linha')
    var testar = criar('button', '', 'Testar'); testar.type = 'button'
    var alternar = criar('button', '', item.ativo ? 'Desativar' : 'Ativar'); alternar.type = 'button'
    var remover = criar('button', '', 'Remover'); remover.type = 'button'
    linha.appendChild(testar); linha.appendChild(alternar); linha.appendChild(remover)
    f.appendChild(linha)

    testar.addEventListener('click', function () {
      ocupar(f, true); dizer(msg, 'neutra', 'Conectando e listando as ferramentas…')
      chamar({ acao: 'testar', id: item.id }).then(function (r) {
        if (r.corpo.erro) return dizer(msg, 'erro', r.corpo.erro)
        abertos['ferr-' + item.id] = true
        desenhar(r.corpo.estado)
      }).catch(function () { dizer(msg, 'erro', 'Sem conexão com a Factory.') }).finally(function () { ocupar(f, false) })
    })
    alternar.addEventListener('click', function () {
      ocupar(f, true)
      chamar({ acao: item.ativo ? 'desativar' : 'ativar', id: item.id }).then(function (r) {
        if (r.corpo.erro) return dizer(msg, 'erro', r.corpo.erro)
        desenhar(r.corpo.estado)
      }).finally(function () { ocupar(f, false) })
    })
    remover.addEventListener('click', function () {
      if (!confirm('Remover ' + item.nome + '? Os segredos guardados para ele também são apagados.')) return
      ocupar(f, true)
      chamar({ acao: 'remover', id: item.id }).then(function (r) {
        if (r.corpo.erro) return dizer(msg, 'erro', r.corpo.erro)
        desenhar(r.corpo.estado)
      }).finally(function () { ocupar(f, false) })
    })

    var ferramentas = item.situacao.ferramentas
    if (ferramentas.length > 0) {
      var d = criar('details')
      if (abertos['ferr-' + item.id]) d.open = true
      d.addEventListener('toggle', function () { abertos['ferr-' + item.id] = d.open })
      d.appendChild(criar('summary', '', 'Ferramentas (' + ferramentas.length + ')'))
      d.appendChild(criar('p', 'ajuda', 'O agente só usa as que estiverem ligadas. As que não são só de leitura pedem a sua aprovação a cada uso.'))
      ferramentas.forEach(function (ferr) {
        var rotulo = criar('label', 'ferr')
        var caixa = criar('input'); caixa.type = 'checkbox'
        caixa.checked = ferr.ligada && !ferr.bloqueada && !ferr.nomeLongo
        caixa.disabled = ferr.bloqueada || ferr.nomeLongo
        caixa.setAttribute('aria-label', ferr.nome)
        var texto = criar('span', 'texto')
        var nome = criar('span', 'nome', ferr.nome)
        if (ferr.bloqueada) nome.appendChild(criar('span', 'selo bloq', 'bloqueada: merge e deploy são de uma pessoa'))
        else if (ferr.nomeLongo) nome.appendChild(criar('span', 'selo bloq', 'nome longo demais'))
        else if (ferr.somenteLeitura) nome.appendChild(criar('span', 'selo ok', 'somente leitura'))
        else nome.appendChild(criar('span', 'selo', 'pede aprovação'))
        texto.appendChild(nome)
        if (ferr.descricao) texto.appendChild(criar('small', '', ferr.descricao))
        rotulo.appendChild(caixa); rotulo.appendChild(texto)
        caixa.addEventListener('change', function () {
          chamar({ acao: 'ferramenta', id: item.id, ferramenta: ferr.nome, ligada: caixa.checked }).then(function (r) {
            if (r.corpo.erro) { caixa.checked = !caixa.checked; return dizer(msg, 'erro', r.corpo.erro) }
            desenhar(r.corpo.estado)
          })
        })
        d.appendChild(rotulo)
      })
      f.appendChild(d)
    }

    if (item.segredos.length > 0) {
      var s = criar('details')
      if (abertos['seg-' + item.id]) s.open = true
      s.addEventListener('toggle', function () { abertos['seg-' + item.id] = s.open })
      s.appendChild(criar('summary', '', 'Segredos (' + item.segredos.length + ')'))
      item.segredos.forEach(function (seg) {
        var l = criar('div', 'secreto')
        l.appendChild(criar('code', '', seg.rotulo))
        l.appendChild(criar('span', 'estado ' + (seg.configurado ? 'ok' : 'falta'), seg.configurado ? 'guardado' : 'faltando'))
        var novo = entrada('password', 'Cole o novo valor')
        novo.setAttribute('aria-label', 'Novo valor de ' + seg.rotulo)
        var trocar = criar('button', '', 'Trocar'); trocar.type = 'button'
        function enviar(semTeste) {
          if (!novo.value.trim()) return dizer(msg, 'erro', 'Cole o valor antes de trocar.')
          ocupar(f, true); dizer(msg, 'neutra', 'Testando a conexão com o valor novo…')
          chamar({ acao: 'segredo', id: item.id, nome: seg.nome, valor: novo.value, semTeste: semTeste === true }).then(function (r) {
            if (r.corpo.erro) return dizer(msg, 'erro', r.corpo.erro)
            if (r.corpo.salvo) { desenhar(r.corpo.estado); return }
            dizer(msg, 'erro', (r.corpo.teste && r.corpo.teste.erro) || 'Não consegui conectar com o valor novo.')
            if (r.corpo.teste && r.corpo.teste.tipoDoErro === 'sem-resposta') {
              var b = criar('button', '', 'Trocar mesmo assim'); b.type = 'button'
              b.addEventListener('click', function () { enviar(true) })
              msg.appendChild(document.createTextNode(' ')); msg.appendChild(b)
            }
          }).catch(function () { dizer(msg, 'erro', 'Sem conexão com a Factory.') }).finally(function () { ocupar(f, false) })
        }
        trocar.addEventListener('click', function () { enviar(false) })
        l.appendChild(novo); l.appendChild(trocar)
        s.appendChild(l)
      })
      f.appendChild(s)
    }
    f.appendChild(msg)
    return f
  }

  // ---- catálogo
  function cartaoCatalogo(item) {
    var f = criar('form', 'chave')
    f.setAttribute('data-catalogo', item.id)
    var topo = criar('div', 'topo')
    topo.appendChild(criar('b', '', item.nome))
    topo.appendChild(criar('span', 'estado', item.tipo === 'remoto' ? 'servidor remoto' : 'roda no servidor da Factory'))
    f.appendChild(topo)
    f.appendChild(criar('p', 'ajuda', item.descricao))
    f.appendChild(criar('div', 'destino', 'Fonte: ' + item.fonte))
    var params = {}, segs = {}
    item.parametros.forEach(function (p) {
      var i = entrada(p.tipo === 'email' ? 'email' : 'text', p.ajuda); i.required = true; i.autocomplete = 'off'
      params[p.nome] = i; f.appendChild(campo(p.rotulo, i))
    })
    item.segredos.forEach(function (sg) {
      var i = entrada('password', sg.ajuda); i.required = !sg.opcional
      segs[sg.nome] = i; f.appendChild(campo(sg.rotulo + (sg.opcional ? ' (opcional)' : ''), i))
    })
    var linha = criar('div', 'linha')
    var instalar = criar('button', 'primario', 'Instalar'); instalar.type = 'submit'
    linha.appendChild(instalar)
    f.appendChild(linha)
    var msg = criar('div', 'msg'); msg.setAttribute('role', 'status')
    f.appendChild(msg)
    function enviar(semTeste) {
      var parametros = {}, segredos = {}
      Object.keys(params).forEach(function (k) { parametros[k] = params[k].value.trim() })
      Object.keys(segs).forEach(function (k) { if (segs[k].value.trim()) segredos[k] = segs[k].value.trim() })
      ocupar(f, true)
      dizer(msg, 'neutra', item.tipo === 'remoto' ? 'Conectando e listando as ferramentas…' : 'Conectando e listando as ferramentas. Na primeira vez o npx baixa o pacote e pode levar até um minuto…')
      chamar({ acao: 'instalar-catalogo', catalogoId: item.id, parametros: parametros, segredos: segredos, semTeste: semTeste === true })
        .then(function (r) { aposInstalar(r, msg, enviar, item.id) })
        .catch(function () { dizer(msg, 'erro', 'Sem conexão com a Factory.') })
        .finally(function () { ocupar(f, false) })
    }
    f.addEventListener('submit', function (e) { e.preventDefault(); enviar(false) })
    return f
  }

  // ---- servidor remoto
  function formularioRemoto() {
    var d = criar('details'); d.id = 'novo-remoto'
    if (abertos['novo-remoto']) d.open = true
    d.addEventListener('toggle', function () { abertos['novo-remoto'] = d.open })
    d.appendChild(criar('summary', '', 'Servidor remoto (URL)'))
    d.appendChild(criar('p', 'ajuda', 'Qualquer MCP publicado em https. Endereços da rede interna são recusados. O token vai criptografado, nunca na URL.'))
    var f = criar('form')
    var nome = entrada('text', 'Ex.: Documentação interna'); nome.autocomplete = 'off'; nome.required = true
    var url = entrada('text', 'https://exemplo.com/mcp'); url.autocomplete = 'off'; url.required = true
    var cab = entrada('text', 'Authorization'); cab.value = 'Authorization'; cab.autocomplete = 'off'
    var prefixo = entrada('text', 'Bearer'); prefixo.value = 'Bearer'; prefixo.autocomplete = 'off'
    var valor = entrada('password', 'Token (opcional)')
    f.appendChild(campo('Nome', nome)); f.appendChild(campo('Endereço', url))
    f.appendChild(campo('Cabeçalho de autenticação', cab)); f.appendChild(campo('Prefixo do valor', prefixo)); f.appendChild(campo('Valor do cabeçalho', valor))
    var linha = criar('div', 'linha'); var ir = criar('button', 'primario', 'Instalar'); ir.type = 'submit'; linha.appendChild(ir); f.appendChild(linha)
    var msg = criar('div', 'msg'); msg.setAttribute('role', 'status'); f.appendChild(msg)
    function enviar(semTeste) {
      var cabecalhos = valor.value.trim() ? [{ nome: cab.value.trim(), valor: valor.value.trim(), prefixo: prefixo.value.trim() }] : []
      ocupar(f, true); dizer(msg, 'neutra', 'Conectando e listando as ferramentas…')
      chamar({ acao: 'instalar-remoto', nome: nome.value, url: url.value, cabecalhos: cabecalhos, semTeste: semTeste === true })
        .then(function (r) { aposInstalar(r, msg, enviar, null) })
        .catch(function () { dizer(msg, 'erro', 'Sem conexão com a Factory.') })
        .finally(function () { ocupar(f, false) })
    }
    f.addEventListener('submit', function (e) { e.preventDefault(); enviar(false) })
    d.appendChild(f)
    return d
  }

  // ---- comando no servidor (só com a liberação do administrador)
  function formularioComando(politica) {
    var d = criar('details'); d.id = 'novo-comando'
    if (abertos['novo-comando']) d.open = true
    d.addEventListener('toggle', function () { abertos['novo-comando'] = d.open })
    d.appendChild(criar('summary', '', 'Comando no servidor (administrador)'))
    if (!politica.comandoPersonalizado) {
      d.appendChild(criar('p', 'ajuda', 'Desligado. Rodar um comando é executar código dentro da Factory, então só quem administra a VPS liga, com SUPER_FACTORY_MCP_COMANDO=1 no .env. Os MCPs do catálogo continuam disponíveis.'))
      return d
    }
    d.appendChild(criar('p', 'ajuda', 'Executa código dentro do container da Factory. Use só pacotes em que a sua equipe confia, com a versão fixa. Segredos vão no campo próprio, nunca nos argumentos.'))
    var f = criar('form')
    var nome = entrada('text', 'Ex.: Meu MCP'); nome.autocomplete = 'off'; nome.required = true
    var comando = criar('select'); ['npx', 'uvx', 'node', 'python3'].forEach(function (c) { var o = criar('option', '', c); o.value = c; comando.appendChild(o) })
    var args = criar('textarea'); args.rows = 3; args.placeholder = '-y\n@escopo/pacote@1.2.3'; args.spellcheck = false
    var ambiente = criar('textarea'); ambiente.rows = 2; ambiente.placeholder = 'NOME=valor (uma por linha, não secretas)'; ambiente.spellcheck = false
    var nomeSegredo = entrada('text', 'NOME_DA_VARIAVEL'); nomeSegredo.autocomplete = 'off'
    var valorSegredo = entrada('password', 'Valor secreto (opcional)')
    f.appendChild(campo('Nome', nome)); f.appendChild(campo('Comando', comando)); f.appendChild(campo('Argumentos (um por linha)', args))
    f.appendChild(campo('Variáveis não secretas', ambiente)); f.appendChild(campo('Variável secreta: nome', nomeSegredo)); f.appendChild(campo('Variável secreta: valor', valorSegredo))
    var linha = criar('div', 'linha'); var ir = criar('button', 'primario', 'Instalar'); ir.type = 'submit'; linha.appendChild(ir); f.appendChild(linha)
    var msg = criar('div', 'msg'); msg.setAttribute('role', 'status'); f.appendChild(msg)
    function enviar(semTeste) {
      var env = {}
      ambiente.value.split(/\r?\n/).forEach(function (l) { var i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim() })
      var segredos = {}
      if (nomeSegredo.value.trim() && valorSegredo.value.trim()) segredos[nomeSegredo.value.trim()] = valorSegredo.value.trim()
      var lista = args.value.split(/\r?\n/).map(function (a) { return a.trim() }).filter(Boolean)
      ocupar(f, true); dizer(msg, 'neutra', 'Conectando e listando as ferramentas. Na primeira vez o npx baixa o pacote e pode levar até um minuto…')
      chamar({ acao: 'instalar-comando', nome: nome.value, comando: comando.value, args: lista, ambiente: env, segredos: segredos, semTeste: semTeste === true })
        .then(function (r) { aposInstalar(r, msg, enviar, null) })
        .catch(function () { dizer(msg, 'erro', 'Sem conexão com a Factory.') })
        .finally(function () { ocupar(f, false) })
    }
    f.addEventListener('submit', function (e) { e.preventDefault(); enviar(false) })
    d.appendChild(f)
    return d
  }

  // ---- colar a configuração (formato do Cursor, do Claude Desktop e do VS Code)
  var colado = ''
  function formularioColar() {
    var painel = criar('div', 'chave'); painel.id = 'colar-painel'
    painel.appendChild(criar('p', 'ajuda', 'Cole o trecho do mcp.json do Cursor, do Claude Desktop ou do VS Code. O que está no catálogo é instalado na versão revisada da Factory; o resto passa pelas mesmas checagens de segurança. Chaves e tokens vão para o cofre criptografado.'))
    var f = criar('form'); f.id = 'colar-form'
    var texto = criar('textarea'); texto.id = 'colar-texto'; texto.rows = 9; texto.spellcheck = false; texto.autocomplete = 'off'
    texto.placeholder = '{\\n  "mcpServers": {\\n    "context7": {\\n      "command": "npx",\\n      "args": ["-y", "@upstash/context7-mcp"]\\n    }\\n  }\\n}'
    texto.style.fontFamily = 'ui-monospace, monospace'; texto.style.width = '100%'
    texto.value = colado
    texto.addEventListener('input', function () { colado = texto.value; previa.textContent = ''; msg.textContent = '' })
    f.appendChild(campo('Configuração (JSON)', texto))
    var linha = criar('div', 'linha'); var ir = criar('button', 'primario', 'Analisar'); ir.type = 'submit'; ir.id = 'colar-analisar'; linha.appendChild(ir); f.appendChild(linha)
    var msg = criar('div', 'msg'); msg.setAttribute('role', 'status'); f.appendChild(msg)
    var previa = criar('div'); previa.id = 'colar-previa'; previa.setAttribute('aria-live', 'polite'); f.appendChild(previa)

    function instalarTudo(semTeste) {
      ocupar(f, true); dizer(msg, 'neutra', 'Conectando e listando as ferramentas. Na primeira vez pode levar até um minuto…')
      chamar({ acao: 'colar', texto: texto.value, semTeste: semTeste === true }).then(function (r) {
        if (r.corpo.erro) return dizer(msg, 'erro', r.corpo.erro)
        var rs = r.corpo.resultados || []
        var falhas = rs.filter(function (x) { return !x.instalado })
        if (falhas.length === 0) { colado = ''; return desenhar(r.corpo.estado) }
        previa.textContent = ''
        rs.forEach(function (x) {
          var linhaR = criar('p', x.instalado ? 'msg ok' : 'msg erro', x.nome + ': ' + (x.instalado ? 'instalado' + (x.ferramentas && x.ferramentas.length ? ' · ' + x.ferramentas.length + ' ferramentas' : '') : x.erro))
          previa.appendChild(linhaR)
        })
        dizer(msg, 'erro', falhas.length + (falhas.length === 1 ? ' servidor não foi instalado.' : ' servidores não foram instalados.'))
        if (falhas.some(function (x) { return x.tipoDoErro === 'sem-resposta' })) {
          var b = criar('button', '', 'Instalar mesmo assim'); b.type = 'button'
          b.addEventListener('click', function () { instalarTudo(true) })
          msg.appendChild(document.createTextNode(' ')); msg.appendChild(b)
        }
        carregar()
      }).catch(function () { dizer(msg, 'erro', 'Sem conexão com a Factory.') }).finally(function () { ocupar(f, false) })
    }

    f.addEventListener('submit', function (e) {
      e.preventDefault()
      ocupar(f, true); dizer(msg, 'neutra', 'Lendo a configuração…'); previa.textContent = ''
      chamar({ acao: 'colar-analisar', texto: texto.value }).then(function (r) {
        if (r.corpo.erro) return dizer(msg, 'erro', r.corpo.erro)
        msg.textContent = ''
        var itens = r.corpo.itens || []
        itens.forEach(function (item) {
          var c = criar('div', 'chave')
          var topo = criar('div', 'topo'); topo.appendChild(criar('b', '', item.nome))
          topo.appendChild(criar('span', item.pronto ? 'estado ok' : 'estado falta', item.pronto ? (item.modo === 'catalogo' ? 'do catálogo' : item.modo === 'remoto' ? 'remoto' : 'comando') : 'não instala'))
          c.appendChild(topo)
          if (item.erro) c.appendChild(criar('p', 'msg erro', item.erro))
          else c.appendChild(criar('p', 'ajuda', item.resumo))
          if (item.segredos && item.segredos.length) c.appendChild(criar('p', 'ajuda', 'Segredos que vão para o cofre: ' + item.segredos.join(', ') + '.'))
          ;(item.avisos || []).forEach(function (a) { c.appendChild(criar('p', 'ajuda', 'Atenção: ' + a)) })
          previa.appendChild(c)
        })
        ;(r.corpo.avisos || []).forEach(function (a) { previa.appendChild(criar('p', 'ajuda', a)) })
        var prontos = itens.filter(function (i) { return i.pronto }).length
        if (prontos > 0) {
          var l2 = criar('div', 'linha'); var ok = criar('button', 'primario', prontos === 1 ? 'Instalar' : 'Instalar ' + prontos); ok.type = 'button'; ok.id = 'colar-instalar'
          ok.addEventListener('click', function () { instalarTudo(false) })
          l2.appendChild(ok); previa.appendChild(l2)
        }
      }).catch(function () { dizer(msg, 'erro', 'Sem conexão com a Factory.') }).finally(function () { ocupar(f, false) })
    })
    painel.appendChild(f)
    return painel
  }

  function desenhar(estado) {
    estadoAtual = estado
    lista.textContent = ''
    lista.appendChild(criar('h2', '', 'Instalados (' + estado.instalados.length + ')'))
    if (estado.instalados.length === 0) lista.appendChild(criar('p', 'ajuda', 'Nenhuma ferramenta instalada ainda. Escolha uma do catálogo abaixo.'))
    estado.instalados.forEach(function (item) { lista.appendChild(cartaoInstalado(item)) })
    lista.appendChild(criar('h2', '', 'Colar configuração'))
    lista.appendChild(formularioColar())
    var disponiveis = estado.catalogo.filter(function (c) { return !c.instalado })
    lista.appendChild(criar('h2', '', 'Catálogo'))
    if (disponiveis.length === 0) lista.appendChild(criar('p', 'ajuda', 'Todo o catálogo já está instalado.'))
    disponiveis.forEach(function (item) { lista.appendChild(cartaoCatalogo(item)) })
    lista.appendChild(criar('h2', '', 'Outro servidor'))
    var painel = criar('div', 'chave')
    painel.appendChild(formularioRemoto())
    painel.appendChild(formularioComando(estado.politica))
    lista.appendChild(painel)
  }

  if (location.hash === '#mcps') aba('mcps')
})()
`
