// Páginas públicas de acesso: waitlist, login, "ainda não liberado" e o painel de quem administra.
// Mesmo visual da marca (tile SF branco, Geist, cores do design system). Nenhum innerHTML: tudo textContent.

import crypto from 'node:crypto'

import { EQUIPES, FERRAMENTAS, ORIGENS, USOS } from '../factory/waitlist.ts'

const ROTULO_EQUIPE: Record<string, string> = { '1': 'Só eu', '2-10': '2 a 10 pessoas', '11-50': '11 a 50', '51-200': '51 a 200', '200+': 'Mais de 200' }
const ROTULO_USO: Record<string, string> = {
  'time-de-desenvolvimento': 'Time de desenvolvimento de produto',
  'plataforma-devops': 'Plataforma / DevOps',
  consultoria: 'Consultoria ou fábrica de software',
  'produto-proprio': 'Produto próprio',
  'estudo-prova-de-conceito': 'Estudo ou prova de conceito',
}
const ROTULO_ORIGEM: Record<string, string> = { indicacao: 'Indicação', evento: 'Evento', 'redes-sociais': 'Redes sociais', busca: 'Busca na internet', outro: 'Outro' }

function esc(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

const CSS = `
  :root { --bg:#050505; --card:#101010; --card-2:#171717; --line:#ffffff17; --line-2:#ffffff2e; --text:#ededed; --muted:#9a9a9a; --accent:#f5a25d; --ok:#5ee08a; --erro:#ff8a7a; --botao:#ececec; --botao-texto:#0a0a0a; color-scheme: dark; }
  @media (prefers-color-scheme: light) { :root { --bg:#f4f4f2; --card:#ffffff; --card-2:#f1f1ee; --line:#0000001a; --line-2:#0000002e; --text:#111111; --muted:#555555; --accent:#b85f12; --ok:#137a3d; --erro:#b3261e; --botao:#111111; --botao-texto:#f4f4f2; color-scheme: light; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 "Geist", ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; min-height: 100vh; }
  main { max-width: 680px; margin: 0 auto; padding: 36px 20px 56px; }
  .marca { display: inline-flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; font-weight: 500; letter-spacing: -.01em; }
  .marca b { width: 26px; height: 26px; border-radius: 8px; background: #f0f0f0; color: #080808; display: grid; place-items: center; font: 600 11.5px "Geist", ui-sans-serif, system-ui, sans-serif; }
  h1 { margin: 28px 0 8px; font-size: clamp(26px, 5vw, 36px); line-height: 1.1; font-weight: 500; letter-spacing: -.035em; }
  h2 { margin: 28px 0 10px; font: 500 12px "Geist Mono", ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  p { margin: 0 0 12px; color: var(--muted); }
  a { color: var(--text); }
  .cartao { padding: 20px; border: 1px solid var(--line); border-radius: 20px; background: var(--card); margin-top: 18px; }
  label, .rotulo { display: block; font-size: 13.5px; margin: 14px 0 6px; color: var(--text); }
  .ajuda { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }
  input[type=text], input[type=email], input[type=number], select, textarea { width: 100%; padding: 11px 13px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--card-2); color: var(--text); font: 14.5px "Geist", ui-sans-serif, system-ui, sans-serif; }
  textarea { min-height: 110px; resize: vertical; }
  input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  .linha { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .linha { grid-template-columns: 1fr; } }
  .opcoes { display: flex; flex-wrap: wrap; gap: 8px; }
  .opcoes label { margin: 0; display: inline-flex; align-items: center; gap: 8px; padding: 8px 13px; border: 1px solid var(--line-2); border-radius: 999px; cursor: pointer; font-size: 13.5px; user-select: none; }
  .opcoes input { position: absolute; opacity: 0; pointer-events: none; }
  .opcoes label:has(input:checked) { background: var(--botao); color: var(--botao-texto); border-color: transparent; }
  .opcoes label:has(input:focus-visible) { outline: 2px solid var(--text); outline-offset: 2px; }
  .consent { display: flex; gap: 10px; align-items: flex-start; margin-top: 18px; font-size: 13px; color: var(--muted); }
  .consent input { margin-top: 3px; }
  button, .botao { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border-radius: 999px; border: 1px solid transparent; background: var(--botao); color: var(--botao-texto); font: 500 14.5px "Geist", ui-sans-serif, system-ui, sans-serif; cursor: pointer; text-decoration: none; }
  button.sec, .botao.sec { background: transparent; color: var(--text); border-color: var(--line-2); }
  button:disabled { opacity: .55; cursor: wait; }
  .msg { margin-top: 14px; font-size: 14px; min-height: 1.3em; }
  .msg.erro { color: var(--erro); } .msg.ok { color: var(--ok); }
  .campo-erro { border-color: var(--erro) !important; }
  .aviso { padding: 12px 14px; border: 1px solid var(--line-2); border-radius: 14px; background: var(--card); font-size: 14px; margin-top: 16px; }
  .aviso.erro { border-color: var(--erro); color: var(--erro); }
  .oculto { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font: 500 11.5px "Geist Mono", ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .estado { font: 400 11.5px "Geist Mono", ui-monospace, monospace; padding: 2px 9px; border-radius: 99px; border: 1px solid var(--line-2); color: var(--muted); }
  .estado.aprovado { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
  .estado.recusado { color: var(--erro); border-color: color-mix(in srgb, var(--erro) 45%, transparent); }
  .estado.pendente { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); }
  .mini { padding: 6px 12px; font-size: 12.5px; }
  .filtros { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
  .detalhe { color: var(--muted); font-size: 12.5px; margin-top: 4px; white-space: pre-wrap; }
`

type Pagina = { titulo: string; corpo: string; script?: string; largura?: string; status?: number }

function montar({ titulo, corpo, script, largura, status }: Pagina): Response {
  const nonce = crypto.randomBytes(16).toString('base64')
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${esc(titulo)} · Super Factory</title>
<link rel="icon" href="/sf.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style nonce="${nonce}">${CSS}${largura ? ` main { max-width: ${largura}; }` : ''}</style>
</head>
<body>
<main>
<a class="marca" href="/"><b aria-hidden="true">SF</b> Super Factory</a>
${corpo}
</main>
${script ? `<script nonce="${nonce}">${script}</script>` : ''}
</body>
</html>`
  return new Response(html, {
    status: status ?? 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    },
  })
}

export function paginaLogin({ proximo, aviso, ligado = true }: { proximo: string; aviso?: string; ligado?: boolean }): Response {
  const corpo = `
<h1>Entrar na Factory</h1>
<p>O acesso é liberado por uma pessoa da Factory. Entre com o GitHub usando o mesmo usuário (ou e-mail) que você informou na lista de espera.</p>
${aviso ? `<div class="aviso erro" role="alert">${esc(aviso)}</div>` : ''}
<div class="cartao">
  ${ligado ? `<a class="botao" id="entrar" href="/auth/github?next=${encodeURIComponent(proximo)}">Entrar com GitHub</a>` : '<p>O login não está ligado neste servidor.</p>'}
  <p style="margin-top:16px">Ainda não tem acesso? <a href="/waitlist">Entre na lista de espera</a>.</p>
</div>`
  return montar({ titulo: 'Entrar', corpo, status: aviso ? 401 : 200 })
}

export function paginaNegado({ login }: { login: string }): Response {
  const corpo = `
<h1>Seu acesso ainda não foi liberado</h1>
<p>Você entrou no GitHub como <b>${esc(login)}</b>, mas esse usuário não está aprovado na lista de espera.</p>
<div class="cartao">
  <p>Se você já está na lista, aguarde: liberamos aos poucos. Se informou outro usuário do GitHub ou outro e-mail, entre com a conta certa, ou atualize o cadastro.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="botao" href="/waitlist">Ir para a lista de espera</a><a class="botao sec" href="/login">Tentar com outra conta</a></div>
</div>`
  return montar({ titulo: 'Acesso não liberado', corpo, status: 403 })
}

export function paginaMalConfigurada(faltando: string[]): Response {
  const corpo = `
<h1>Login fechado por segurança</h1>
<p>O login da Factory foi ligado, mas a configuração está incompleta. Enquanto isso, nada fora das páginas públicas abre.</p>
<div class="cartao"><p>Quem administra o servidor precisa definir no <code>.env</code>:</p><ul>${faltando.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
<p>Para voltar ao modo sem login (só em rede confiável): <code>SUPER_FACTORY_AUTH=off</code>.</p></div>`
  return montar({ titulo: 'Login fechado', corpo, status: 503 })
}

export function paginaWaitlist(): Response {
  const radio = (nome: string, valor: string, texto: string, marcado = false) =>
    `<label><input type="radio" name="${nome}" value="${esc(valor)}"${marcado ? ' checked' : ''} required /> ${esc(texto)}</label>`
  const corpo = `
<h1>Lista de espera</h1>
<p>A Super Factory está em beta fechado. Conte um pouco sobre você ou sua empresa e o que quer automatizar: usamos isso para liberar o acesso aos poucos, começando por quem mais se beneficia.</p>
<form class="cartao" id="form" novalidate>
  <span class="rotulo">Você é</span>
  <div class="opcoes" role="radiogroup" aria-label="Você é">
    ${radio('tipo', 'pessoa', 'Pessoa', true)}${radio('tipo', 'empresa', 'Empresa')}
  </div>
  <div class="linha">
    <div><label for="nome">Nome</label><input type="text" id="nome" name="nome" maxlength="80" autocomplete="name" required /></div>
    <div><label for="email">E-mail de trabalho</label><input type="email" id="email" name="email" maxlength="120" autocomplete="email" required /></div>
  </div>
  <div class="linha">
    <div><label for="empresa">Empresa <span id="empresa-obrig" style="color:var(--muted)">(se for empresa)</span></label><input type="text" id="empresa" name="empresa" maxlength="80" autocomplete="organization" /></div>
    <div><label for="cargo">Cargo</label><input type="text" id="cargo" name="cargo" maxlength="60" autocomplete="organization-title" /></div>
  </div>
  <label for="site">Site (opcional)</label><input type="text" id="site" name="site" maxlength="100" placeholder="empresa.com.br" autocomplete="url" />
  <div class="linha">
    <div><label for="equipe">Tamanho da equipe de tecnologia</label><select id="equipe" name="equipe" required><option value="">Escolha</option>${EQUIPES.map((e) => `<option value="${e}">${esc(ROTULO_EQUIPE[e] ?? e)}</option>`).join('')}</select></div>
    <div><label for="usuarios">Quantas pessoas usariam?</label><input type="number" id="usuarios" name="usuarios" min="1" max="5000" inputmode="numeric" required /></div>
  </div>
  <label for="uso">Uso principal</label><select id="uso" name="uso" required><option value="">Escolha</option>${USOS.map((u) => `<option value="${u}">${esc(ROTULO_USO[u] ?? u)}</option>`).join('')}</select>
  <span class="rotulo">Ferramentas que vocês usam</span>
  <div class="opcoes" role="group" aria-label="Ferramentas">${FERRAMENTAS.map((f) => `<label><input type="checkbox" name="ferramentas" value="${esc(f)}" /> ${esc(f)}</label>`).join('')}</div>
  <label for="casoDeUso">O que você quer automatizar?</label>
  <textarea id="casoDeUso" name="casoDeUso" maxlength="600" required placeholder="Ex.: transformar backlog em pull requests com testes, organizar o board, revisar PRs..."></textarea>
  <p class="ajuda">Entre 20 e 600 caracteres. Não cole senhas, tokens nem dados de clientes.</p>
  <label for="github">Usuário do GitHub (recomendado)</label><input type="text" id="github" name="github" maxlength="60" placeholder="seu-usuario" autocomplete="off" />
  <p class="ajuda">O acesso é por login com GitHub. Com o usuário aqui, liberamos mais rápido.</p>
  <label for="origem">Como conheceu a Factory? (opcional)</label><select id="origem" name="origem"><option value="">Escolha</option>${ORIGENS.map((o) => `<option value="${o}">${esc(ROTULO_ORIGEM[o] ?? o)}</option>`).join('')}</select>
  <div class="oculto" aria-hidden="true"><label for="website">Não preencha este campo</label><input type="text" id="website" name="website" tabindex="-1" autocomplete="off" /></div>
  <label class="consent"><input type="checkbox" id="consentimento" name="consentimento" required /> <span>Aceito que a Super Factory guarde estes dados para entrar em contato e decidir a liberação do acesso. Posso pedir a remoção a qualquer momento.</span></label>
  <div style="margin-top:20px"><button type="submit" id="enviar">Entrar na lista</button></div>
  <div class="msg" id="msg" role="status" aria-live="polite"></div>
</form>
<p style="margin-top:18px">Já foi aprovado? <a href="/login">Entre aqui</a>.</p>`
  const script = String.raw`
(function () {
  var f = document.getElementById('form'), msg = document.getElementById('msg'), enviar = document.getElementById('enviar')
  function dizer(t, c) { msg.className = 'msg ' + c; msg.textContent = t }
  function limpar() { f.querySelectorAll('.campo-erro').forEach(function (e) { e.classList.remove('campo-erro') }) }
  function valor(n) { var e = f.elements[n]; return e ? e.value : '' }
  f.addEventListener('submit', function (ev) {
    ev.preventDefault(); limpar()
    var ferramentas = Array.prototype.map.call(f.querySelectorAll('input[name=ferramentas]:checked'), function (e) { return e.value })
    var dados = {
      tipo: (f.querySelector('input[name=tipo]:checked') || {}).value || '', nome: valor('nome'), email: valor('email'), empresa: valor('empresa'), cargo: valor('cargo'),
      site: valor('site'), equipe: valor('equipe'), usuarios: valor('usuarios'), uso: valor('uso'), ferramentas: ferramentas, casoDeUso: valor('casoDeUso'),
      github: valor('github'), origem: valor('origem'), website: valor('website'), consentimento: document.getElementById('consentimento').checked
    }
    enviar.disabled = true; dizer('Enviando…', '')
    fetch('/waitlist/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': '1' }, body: JSON.stringify(dados) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, corpo: j } }) })
      .then(function (r) {
        if (r.corpo && r.corpo.ok) {
          f.style.display = 'none'
          var ok = document.createElement('div'); ok.className = 'cartao'; ok.id = 'sucesso'
          var t = document.createElement('h2'); t.textContent = 'Recebemos o seu cadastro'
          var p = document.createElement('p'); p.textContent = 'Obrigado! Avisaremos por e-mail quando o seu acesso for liberado. Se informou o seu usuário do GitHub, é com ele que você vai entrar.'
          ok.appendChild(t); ok.appendChild(p); f.parentNode.insertBefore(ok, f.nextSibling)
          return
        }
        var campo = r.corpo && r.corpo.campo, el = campo && f.elements[campo]
        if (el && el.classList) { el.classList.add('campo-erro'); try { el.focus() } catch (e) {} }
        dizer((r.corpo && r.corpo.erro) || 'Não consegui enviar. Tente de novo.', 'erro')
      })
      .catch(function () { dizer('Sem conexão. Tente de novo.', 'erro') })
      .finally(function () { enviar.disabled = false })
  })
})()
`
  return montar({ titulo: 'Lista de espera', corpo, script })
}

export function paginaAdmin({ login }: { login: string }): Response {
  const corpo = `
<h1>Waitlist</h1>
<p>Quem pediu acesso. Aprovar libera o login com GitHub (pelo usuário informado ou por e-mail verificado). Logado como <b>${esc(login)}</b> · <a href="/auth/sair">Sair</a></p>
<div class="filtros" id="filtros" role="group" aria-label="Filtro por estado">
  <button class="sec mini" data-f="pendente" type="button">Pendentes</button><button class="sec mini" data-f="aprovado" type="button">Aprovados</button><button class="sec mini" data-f="recusado" type="button">Recusados</button><button class="sec mini" data-f="" type="button">Todos</button>
  <a class="botao sec mini" href="/admin/waitlist/exportar.csv" style="margin-left:auto">Exportar CSV</a>
</div>
<div class="msg" id="msg" role="status" aria-live="polite"></div>
<div id="lista" style="overflow-x:auto"></div>`
  const script = String.raw`
(function () {
  var lista = document.getElementById('lista'), msg = document.getElementById('msg'), filtro = 'pendente'
  function el(tag, classe, texto) { var e = document.createElement(tag); if (classe) e.className = classe; if (texto !== undefined) e.textContent = texto; return e }
  function dizer(t, c) { msg.className = 'msg ' + c; msg.textContent = t }
  function carregar() {
    fetch('/admin/waitlist/dados' + (filtro ? '?status=' + filtro : ''), { cache: 'no-store' }).then(function (r) { return r.json() }).then(function (j) {
      lista.textContent = ''
      var c = j.contagens || {}
      dizer((c.pendente || 0) + ' pendentes · ' + (c.aprovado || 0) + ' aprovados · ' + (c.recusado || 0) + ' recusados', '')
      if (!j.itens || j.itens.length === 0) { lista.appendChild(el('p', '', 'Nada por aqui.')); return }
      var t = el('table'), cab = el('tr')
      ;['Quem', 'Perfil', 'Caso de uso', 'Estado', ''].forEach(function (h) { cab.appendChild(el('th', '', h)) })
      t.appendChild(cab)
      j.itens.forEach(function (i) {
        var tr = el('tr'), q = el('td')
        q.appendChild(el('div', '', i.nome)); q.appendChild(el('div', 'detalhe', i.email + (i.github ? ' · @' + i.github : '')))
        q.appendChild(el('div', 'detalhe', new Date(i.criadoEm).toLocaleString('pt-BR')))
        var p = el('td')
        p.appendChild(el('div', '', (i.tipo === 'empresa' ? 'Empresa' : 'Pessoa') + (i.empresa ? ' · ' + i.empresa : '') + (i.cargo ? ' · ' + i.cargo : '')))
        p.appendChild(el('div', 'detalhe', 'Equipe ' + i.equipe + ' · ' + i.usuarios + ' usuário(s) · ' + i.uso))
        p.appendChild(el('div', 'detalhe', i.ferramentas.join(', ') + (i.site ? '\n' + i.site : '')))
        var u = el('td', 'detalhe', i.casoDeUso)
        var s = el('td'); s.appendChild(el('span', 'estado ' + i.status, i.status))
        if (i.decididoPor) s.appendChild(el('div', 'detalhe', 'por ' + i.decididoPor))
        var a = el('td'), box = el('div', '', ''); box.style.display = 'flex'; box.style.gap = '6px'; box.style.flexWrap = 'wrap'
        function botao(texto, status, sec) { var b = el('button', 'mini' + (sec ? ' sec' : ''), texto); b.type = 'button'; b.addEventListener('click', function () { decidir(i.id, status, b) }); box.appendChild(b) }
        if (i.status !== 'aprovado') botao('Aprovar', 'aprovado', false)
        if (i.status !== 'recusado') botao('Recusar', 'recusado', true)
        if (i.status !== 'pendente') botao('Voltar a pendente', 'pendente', true)
        a.appendChild(box)
        tr.appendChild(q); tr.appendChild(p); tr.appendChild(u); tr.appendChild(s); tr.appendChild(a); t.appendChild(tr)
      })
      lista.appendChild(t)
    }).catch(function () { dizer('Não consegui carregar.', 'erro') })
  }
  function decidir(id, status, botao) {
    botao.disabled = true
    fetch('/admin/waitlist/decidir', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': '1' }, body: JSON.stringify({ id: id, status: status }) })
      .then(function (r) { return r.json() }).then(function (j) { if (j.erro) dizer(j.erro, 'erro'); carregar() })
      .catch(function () { dizer('Sem conexão.', 'erro') })
  }
  document.getElementById('filtros').addEventListener('click', function (e) { var f = e.target && e.target.getAttribute && e.target.getAttribute('data-f'); if (f !== null && f !== undefined) { filtro = f; carregar() } })
  carregar()
})()
`
  return montar({ titulo: 'Waitlist', corpo, script, largura: '1040px' })
}
