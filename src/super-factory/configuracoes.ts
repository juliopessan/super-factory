// Painel de chaves e acessos: /configuracoes (tela) e /configuracoes/chaves (JSON).
// Abre como popup dentro do Studio (botão injetado por marca.ts) ou como página própria.

import crypto from 'node:crypto'

import { definicao, estadoDasChaves, removerChave, salvarChave, testarChave, validarValor } from '../factory/chaves.ts'

const CABECALHOS_JSON = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: CABECALHOS_JSON })
}

// Pedidos por minuto, no processo todo. Basta para frear tentativa em massa.
const janela: number[] = []
function dentroDoLimite(agora = Date.now()): boolean {
  while (janela.length > 0 && agora - (janela[0] ?? 0) > 60_000) janela.shift()
  if (janela.length >= 40) return false
  janela.push(agora)
  return true
}

/** Nome de quem entrou pelo login do proxy (Basic). Só o nome: a senha nunca é lida nem guardada. */
export function quemE(req: Request): string {
  const encontrado = /^Basic\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')
  if (!encontrado) return 'local'
  try {
    const usuario = Buffer.from(encontrado[1] ?? '', 'base64').toString('utf8').split(':')[0] ?? ''
    return usuario.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 32) || 'login'
  } catch {
    return 'login'
  }
}

/** O navegador reenvia o login sozinho: sem conferir a origem, outro site poderia trocar as chaves. */
export function origemConfere(req: Request): boolean {
  const origem = req.headers.get('origin')
  if (!origem) return false
  const host = req.headers.get('host') ?? req.headers.get('x-forwarded-host')
  try {
    return new URL(origem).host === host
  } catch {
    return false
  }
}

export async function tratarChaves(req: Request, deps: { fetch?: typeof fetch } = {}): Promise<Response> {
  if (req.method === 'GET') return resposta(estadoDasChaves())
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405)
  if (!origemConfere(req) || req.headers.get('x-sf-csrf') !== '1') {
    return resposta({ erro: 'Pedido recusado. Use a tela de chaves da própria Factory.' }, 403)
  }
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return resposta({ erro: 'Formato inválido.' }, 415)
  if (!dentroDoLimite()) return resposta({ erro: 'Muitas tentativas. Espere um minuto.' }, 429)
  const texto = await req.text()
  if (texto.length > 2000) return resposta({ erro: 'Pedido grande demais.' }, 413)
  let corpo: { acao?: unknown; nome?: unknown; valor?: unknown; semTeste?: unknown }
  try {
    corpo = JSON.parse(texto) as typeof corpo
  } catch {
    return resposta({ erro: 'Pedido ilegível.' }, 400)
  }
  const nome = typeof corpo.nome === 'string' ? corpo.nome : ''
  if (!definicao(nome)) return resposta({ erro: 'Esta chave não existe no painel.' }, 400)
  const por = quemE(req)
  try {
    if (corpo.acao === 'remover') {
      removerChave(nome)
      console.log(`[chaves] ${nome} removida por ${por}`)
      return resposta({ estado: estadoDasChaves() })
    }
    if (corpo.acao === 'testar') {
      const valor = typeof corpo.valor === 'string' && corpo.valor.trim() ? validarValor(nome, corpo.valor) : process.env[nome]?.trim()
      if (!valor) return resposta({ teste: { ok: false, estado: 'incompleta', mensagem: 'Cole um valor para testar, ou salve a chave antes.' } })
      return resposta({ teste: await testarChave(nome, valor, deps) })
    }
    if (corpo.acao === 'salvar') {
      const valor = validarValor(nome, corpo.valor)
      const teste = await testarChave(nome, valor, deps)
      const salvarSemTeste = corpo.semTeste === true && teste.estado === 'sem-resposta'
      if (!teste.ok && !salvarSemTeste) return resposta({ salvo: false, teste })
      salvarChave(nome, valor, por)
      console.log(`[chaves] ${nome} salva por ${por}${salvarSemTeste ? ' (sem teste)' : ''}`)
      return resposta({ salvo: true, teste, estado: estadoDasChaves() })
    }
    return resposta({ erro: 'Ação desconhecida.' }, 400)
  } catch (erro) {
    return resposta({ erro: erro instanceof Error ? erro.message : 'Não consegui concluir.' }, 400)
  }
}

export function paginaConfiguracoes(opcoes: { embed: boolean; tema: 'dark' | 'light' | null }): Response {
  const nonce = crypto.randomBytes(16).toString('base64')
  const tema = opcoes.tema ? ` data-tema="${opcoes.tema}"` : ''
  const html = `<!doctype html>
<html lang="pt-BR"${tema}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Chaves e acessos · Super Factory</title>
<link rel="icon" href="/sf.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style nonce="${nonce}">
  :root { --bg:#050505; --card:#141414; --card-2:#1b1b1b; --line:#ffffff14; --line-2:#ffffff29; --text:#ededed; --muted:#9a9a9a; --accent:#f5a25d; --ok:#5ee08a; --erro:#ff8a7a; --botao:#e8e8e8; --botao-texto:#0b0b0b; color-scheme: dark; }
  @media (prefers-color-scheme: light) { :root:not([data-tema="dark"]) { --bg:#f4f4f2; --card:#ffffff; --card-2:#f1f1ee; --line:#0000001a; --line-2:#0000002e; --text:#111111; --muted:#555555; --accent:#b85f12; --ok:#137a3d; --erro:#b3261e; --botao:#111111; --botao-texto:#f4f4f2; color-scheme: light; } }
  :root[data-tema="light"] { --bg:#f4f4f2; --card:#ffffff; --card-2:#f1f1ee; --line:#0000001a; --line-2:#0000002e; --text:#111111; --muted:#555555; --accent:#b85f12; --ok:#137a3d; --erro:#b3261e; --botao:#111111; --botao-texto:#f4f4f2; color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 "Geist", ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  main { max-width: 640px; margin: 0 auto; padding: 28px 20px 40px; }
  h1 { margin: 0 0 6px; font-size: 24px; font-weight: 500; letter-spacing: -.03em; display: flex; align-items: center; gap: 10px; }
  h1 .marca { width: 26px; height: 26px; border-radius: 8px; background: #ff8c00; color: #1a1a1a; display: grid; place-items: center; font: 500 11px "Geist Mono", monospace; }
  h2 { margin: 28px 0 10px; font: 500 12px "Geist Mono", monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  p { margin: 0; color: var(--muted); }
  .aviso { margin-top: 16px; padding: 12px 14px; border: 1px solid var(--line-2); border-radius: 14px; background: var(--card); font-size: 14px; }
  .aviso.erro { border-color: var(--erro); color: var(--erro); }
  .chave { margin-top: 10px; padding: 16px; border: 1px solid var(--line); border-radius: 20px; background: var(--card); }
  .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .topo b { font-weight: 500; }
  .estado { font: 400 12px "Geist Mono", monospace; letter-spacing: .04em; padding: 3px 9px; border-radius: 99px; border: 1px solid var(--line-2); color: var(--muted); }
  .estado.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
  .estado.falta { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); }
  .ajuda { margin-top: 6px; font-size: 13px; }
  .linha { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  input { flex: 1 1 220px; min-width: 0; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--card-2); color: var(--text); font: 14px "Geist Mono", monospace; }
  input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  button { padding: 10px 16px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text); font: 500 14px "Geist", sans-serif; cursor: pointer; }
  button.primario { background: var(--botao); color: var(--botao-texto); border-color: transparent; }
  button:disabled { opacity: .5; cursor: wait; }
  .msg { margin-top: 10px; font-size: 13px; min-height: 1.2em; }
  .msg.ok { color: var(--ok); } .msg.erro { color: var(--erro); } .msg.neutra { color: var(--muted); }
  .rodape { margin-top: 28px; display: flex; gap: 12px; align-items: center; justify-content: space-between; font-size: 13px; }
  a { color: var(--text); }
</style>
</head>
<body>
<main>
  <h1><span class="marca" aria-hidden="true">SF</span> Chaves e acessos</h1>
  <p>Cole aqui as chaves do modo autônomo. Elas ficam criptografadas, não aparecem de novo e valem na hora, sem reiniciar.</p>
  <div class="aviso">Quem entra na Factory com o login pode trocar estas chaves. Use contas e tokens com o mínimo de permissão, num repositório de teste primeiro.</div>
  <div id="avisos"></div>
  <div id="lista" aria-live="polite"><p class="aviso">Carregando…</p></div>
  <div class="rodape">
    <span>Nunca cole chave no chat da Factory. É por isso que esta tela existe.</span>
    ${opcoes.embed ? '<button type="button" id="fechar">Fechar</button>' : '<a href="/studio">Voltar ao Studio</a>'}
  </div>
</main>
<script nonce="${nonce}">
(function () {
  var lista = document.getElementById('lista')
  var avisos = document.getElementById('avisos')
  var fechar = document.getElementById('fechar')
  if (fechar) {
    fechar.addEventListener('click', function () { parent.postMessage({ sf: 'fechar-chaves' }, location.origin) })
    // Com o foco dentro do popup, o Esc chega aqui e não no Studio.
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') parent.postMessage({ sf: 'fechar-chaves' }, location.origin) })
  }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag)
    if (classe) e.className = classe
    if (texto !== undefined) e.textContent = texto
    return e
  }
  function quando(iso) {
    try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch (e) { return '' }
  }
  function chamar(corpo) {
    return fetch('/configuracoes/chaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': '1' },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, corpo: j } }) })
  }
  function carregar() {
    return fetch('/configuracoes/chaves', { cache: 'no-store' }).then(function (r) { return r.json() }).then(desenhar)
  }

  function chip(item) {
    if (!item.configurada) return criar('span', 'estado' + (item.autonomo ? ' falta' : ''), item.autonomo ? 'faltando' : 'não configurada')
    var texto = item.origem === 'painel' ? 'configurada pelo painel' + (item.em ? ' · ' + quando(item.em) + (item.por ? ' · ' + item.por : '') : '') : 'configurada no .env'
    return criar('span', 'estado ok', texto)
  }

  function cartao(item) {
    var f = criar('form', 'chave')
    f.setAttribute('data-nome', item.nome)
    var topo = criar('div', 'topo')
    topo.appendChild(criar('b', '', item.rotulo))
    topo.appendChild(chip(item))
    f.appendChild(topo)
    f.appendChild(criar('p', 'ajuda', item.ajuda))
    var linha = criar('div', 'linha')
    var entrada = criar('input')
    entrada.id = 'campo-' + item.nome
    entrada.type = item.secreto ? 'password' : 'text'
    entrada.autocomplete = 'new-password'
    entrada.spellcheck = false
    entrada.setAttribute('data-1p-ignore', '')
    entrada.setAttribute('aria-label', item.rotulo)
    entrada.placeholder = item.secreto ? (item.configurada ? '•••••••• (cole outro valor para trocar)' : 'Cole a chave aqui') : 'nome da organização'
    if (!item.secreto && item.valor) entrada.value = item.valor
    linha.appendChild(entrada)
    var testar = criar('button', '', 'Testar'); testar.type = 'button'
    var salvar = criar('button', 'primario', 'Salvar'); salvar.type = 'submit'
    linha.appendChild(testar); linha.appendChild(salvar)
    var remover = null
    if (item.origem === 'painel') { remover = criar('button', '', 'Remover'); remover.type = 'button'; linha.appendChild(remover) }
    f.appendChild(linha)
    var msg = criar('div', 'msg'); msg.setAttribute('role', 'status')
    f.appendChild(msg)

    function ocupado(sim) { var bs = f.querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].disabled = sim }
    function dizer(classe, texto) { msg.className = 'msg ' + classe; msg.textContent = texto }
    function teste(t) { dizer(t.ok ? 'ok' : 'erro', t.mensagem) }
    function semTeste(valor) {
      var b = criar('button', '', 'Salvar mesmo assim'); b.type = 'button'
      b.addEventListener('click', function () {
        ocupado(true)
        chamar({ acao: 'salvar', nome: item.nome, valor: valor, semTeste: true }).then(function (r) { terminou(r) }).finally(function () { ocupado(false) })
      })
      msg.appendChild(document.createTextNode(' ')); msg.appendChild(b)
    }
    function terminou(r) {
      if (r.corpo.erro) return dizer('erro', r.corpo.erro)
      if (r.corpo.salvo) { desenhar(r.corpo.estado); return }
      teste(r.corpo.teste)
    }

    testar.addEventListener('click', function () {
      ocupado(true); dizer('neutra', 'Testando…')
      chamar({ acao: 'testar', nome: item.nome, valor: entrada.value }).then(function (r) { r.corpo.erro ? dizer('erro', r.corpo.erro) : teste(r.corpo.teste) }).catch(function () { dizer('erro', 'Sem conexão com a Factory.') }).finally(function () { ocupado(false) })
    })
    f.addEventListener('submit', function (e) {
      e.preventDefault()
      var valor = entrada.value.trim()
      if (!valor) return dizer('erro', 'Cole o valor antes de salvar.')
      ocupado(true); dizer('neutra', 'Testando e salvando…')
      chamar({ acao: 'salvar', nome: item.nome, valor: valor }).then(function (r) {
        terminou(r)
        if (r.corpo.teste && !r.corpo.salvo && r.corpo.teste.estado === 'sem-resposta') semTeste(valor)
      }).catch(function () { dizer('erro', 'Sem conexão com a Factory.') }).finally(function () { ocupado(false) })
    })
    if (remover) remover.addEventListener('click', function () {
      if (!confirm('Remover ' + item.rotulo + ' do painel? Se existir no .env, ele volta a valer.')) return
      ocupado(true)
      chamar({ acao: 'remover', nome: item.nome }).then(function (r) { r.corpo.erro ? dizer('erro', r.corpo.erro) : desenhar(r.corpo.estado) }).finally(function () { ocupado(false) })
    })
    return f
  }

  function desenhar(estado) {
    avisos.textContent = ''
    if (estado.cofre.corrompido) avisos.appendChild(criar('div', 'aviso erro', 'O arquivo de chaves não abriu com a chave mestra atual. Nada será gravado até isso ser resolvido, para não perder o que existe.'))
    else if (estado.cofre.chaveDe === 'arquivo') avisos.appendChild(criar('div', 'aviso', 'A chave mestra está no mesmo disco do cofre. Em produção, defina SUPER_FACTORY_MASTER_KEY no .env.'))
    lista.textContent = ''
    var grupos = [['modelo', 'Modelos'], ['repositorio', 'Repositórios']]
    grupos.forEach(function (g) {
      lista.appendChild(criar('h2', '', g[1]))
      estado.itens.filter(function (i) { return i.grupo === g[0] }).forEach(function (item) { lista.appendChild(cartao(item)) })
    })
  }

  carregar().catch(function () { lista.textContent = ''; lista.appendChild(criar('div', 'aviso erro', 'Não consegui carregar as chaves.')) })
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
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`,
    },
  })
}
