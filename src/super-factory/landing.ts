export function paginaInicial(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Super Factory</title>
  <meta name="description" content="A mesa em que um pedido vira card e só atravessa implementação, merge e release quando uma pessoa libera." />
  <link rel="icon" href="/sf.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Geist:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #080808;
      --panel: #0f0f0f;
      --panel-2: #121212;
      --ink: #f0f0f0;
      --muted: #939393;
      --line: #1c1c1c;
      --line-2: #242424;
      --orange: #fdac53;
      --orange-2: #e0993f;
      --orange-ink: #1a1208;
      --green: #7aff78;
      --red: #ff4931;
      --sans: "Geist", "Avenir Next", "Segoe UI", sans-serif;
      --mono: "Geist Mono", ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 16px;
      line-height: 1.5;
    }
    a { color: inherit; text-decoration: none; }
    button, .btn { font-family: inherit; }
    .banner {
      display: flex;
      justify-content: center;
      gap: 10px;
      align-items: center;
      min-height: 36px;
      padding: 8px 16px;
      background: #101010;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
      text-align: center;
    }
    .banner b { color: var(--ink); font-weight: 500; }
    .banner a { color: var(--orange); }
    .top {
      position: sticky;
      top: 0;
      z-index: 5;
      background: rgba(8, 8, 8, 0.86);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--line);
    }
    .wrap { width: min(1160px, calc(100% - 40px)); margin: 0 auto; }
    .top-inner { display: flex; align-items: center; gap: 22px; min-height: 64px; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 600; letter-spacing: -0.03em; }
    .mark {
      width: 28px; height: 28px; border-radius: 7px;
      display: grid; place-items: center;
      background: var(--orange); color: var(--orange-ink);
      font-size: 12px; font-weight: 600;
    }
    nav { display: flex; gap: 18px; }
    nav a { color: var(--muted); font-size: 14px; }
    nav a:hover { color: var(--ink); }
    .nav-cta { margin-left: auto; display: flex; gap: 8px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 36px; padding: 0 14px; border-radius: 8px;
      border: 1px solid transparent; font-size: 14px; font-weight: 500;
    }
    .btn.solid { background: var(--orange); color: var(--orange-ink); }
    .btn.solid:hover { background: var(--orange-2); }
    .btn.ghost { background: transparent; color: var(--ink); border-color: var(--line-2); }
    .btn.ghost:hover { border-color: #3a3a3a; }
    .hero { padding: 72px 0 28px; max-width: 820px; }
    .kicker {
      margin: 0 0 18px;
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--orange);
    }
    h1 {
      margin: 0;
      font-size: clamp(46px, 6.2vw, 76px);
      font-weight: 500;
      letter-spacing: -0.048em;
      line-height: 0.96;
    }
    h1 em { font-style: normal; color: var(--orange); }
    .lead { margin: 22px 0 0; max-width: 58ch; color: var(--muted); font-size: 18px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
    .frame {
      margin: 28px 0 8px;
      border: 1px solid var(--line-2);
      border-radius: 16px;
      background: #0c0c0c;
      overflow: hidden;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
    }
    .frame-bar {
      display: flex; align-items: center; gap: 10px;
      min-height: 44px; padding: 0 14px;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
    }
    .dots { display: flex; gap: 6px; }
    .dots i { width: 8px; height: 8px; border-radius: 99px; background: #2b2b2b; display: block; }
    .dots i:first-child { background: var(--orange); }
    .frame-grid { display: grid; grid-template-columns: 210px 1fr 280px; min-height: 360px; }
    .tree, .evals { background: var(--panel); }
    .tree { border-right: 1px solid var(--line); padding: 14px 8px; }
    .evals { border-left: 1px solid var(--line); padding: 14px; }
    .file, .trace-row, .score {
      display: flex; justify-content: space-between; gap: 12px; align-items: center;
    }
    .file { padding: 7px 10px; border-radius: 8px; color: var(--muted); font-size: 13px; }
    .file.on { background: #171717; color: var(--ink); }
    .file span { font-family: var(--mono); font-size: 11px; color: var(--orange); }
    .trace { padding: 8px 0; }
    .trace-row { padding: 10px 16px; border-bottom: 1px solid var(--line); font-size: 14px; }
    .trace-row small, .score small, .file small { color: var(--muted); font-family: var(--mono); font-size: 12px; }
    .wait { background: rgba(253, 172, 83, 0.08); }
    .wait strong { color: var(--orange); font-weight: 500; }
    .evals h2, .tree p { margin: 4px 10px 12px; font-size: 12px; color: var(--muted); font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
    .score { padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
    .ok { color: var(--green); font-family: var(--mono); font-size: 12px; }
    .hold { color: var(--orange); font-family: var(--mono); font-size: 12px; }
    section { padding: 72px 0; }
    .section-kicker { margin: 0 0 10px; color: var(--muted); font-family: var(--mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
    h3 { margin: 0 0 12px; font-size: clamp(32px, 4vw, 48px); font-weight: 500; letter-spacing: -0.04em; line-height: 1.05; }
    .intro { margin: 0 0 28px; max-width: 64ch; color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .card, .role, .limit {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 20px;
    }
    .card em, .role small { font-family: var(--mono); font-style: normal; font-size: 12px; color: var(--orange); }
    .card h4, .role h4, .limit h4 { margin: 10px 0 8px; font-size: 18px; font-weight: 500; letter-spacing: -0.02em; }
    .card p, .role p, .limit p { margin: 0; color: var(--muted); }
    .rail { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
    .stage { min-height: 120px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); padding: 14px; }
    .stage b { display: block; margin-bottom: 28px; font-family: var(--mono); font-size: 12px; font-weight: 500; color: var(--orange); }
    .cols { display: flex; flex-wrap: wrap; gap: 8px; }
    .cols span { border: 1px solid var(--line-2); border-radius: 999px; padding: 7px 12px; font-family: var(--mono); font-size: 12px; color: var(--muted); }
    .cols .hot { background: var(--orange); color: var(--orange-ink); border-color: transparent; }
    .cols .stop { color: var(--red); border-color: rgba(255, 73, 49, 0.45); }
    .roles { display: grid; grid-template-columns: 1.4fr repeat(3, 1fr); gap: 12px; }
    .role.wide { grid-column: span 2; background: linear-gradient(180deg, rgba(253, 172, 83, 0.1), var(--panel) 42%); }
    .limits { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 28px; align-items: start; }
    .limit-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    pre {
      margin: 12px 0 0; padding: 16px; border-radius: 12px;
      background: #0c0c0c; border: 1px solid var(--line);
      overflow: auto; font-family: var(--mono); font-size: 13px; line-height: 1.6; color: #f0f0f0;
    }
    .key { color: var(--orange); }
    footer {
      border-top: 1px solid var(--line);
      padding: 28px 0 40px;
      color: var(--muted);
      display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    }
    footer a { color: var(--ink); }
    @media (max-width: 980px) {
      nav { display: none; }
      .wrap { width: min(1160px, calc(100% - 28px)); }
      .hero { padding-top: 40px; }
      .frame-grid, .grid, .rail, .roles, .limits, .limit-list { grid-template-columns: 1fr; }
      .tree, .evals { border: 0; border-top: 1px solid var(--line); }
      .role.wide { grid-column: auto; }
      section { padding: 48px 0; }
    }
  </style>
</head>
<body>
  <div class="banner">
    <b>Três portões humanos.</b>
    <span>Nenhum merge e nenhum deploy saem da fábrica.</span>
    <a href="#limites">Ver os limites</a>
  </div>
  <header class="top">
    <div class="wrap top-inner">
      <a class="brand" href="/"><span class="mark" aria-hidden="true">SF</span> Super Factory</a>
      <nav>
        <a href="#proposta">Proposta</a>
        <a href="#ciclo">Ciclo</a>
        <a href="#papeis">Papéis</a>
        <a href="#instalar">Instalar</a>
        <a href="#limites">Limites</a>
      </nav>
      <div class="nav-cta">
        <a class="btn ghost" href="#ciclo">Ciclo</a>
        <a class="btn solid" href="/studio">Abrir a mesa</a>
      </div>
    </div>
  </header>
  <main>
    <div class="wrap">
      <div class="hero">
        <p class="kicker">SDLC agentic · evidência antes de confiança</p>
        <h1>Conduza o pedido. <em>Pare</em> no portão.</h1>
        <p class="lead">Super Factory é a mesa. Um pedido vira card, passa por triagem, especificação, plano, verificação e revisão, e para três vezes: implementação, merge e release. Agente não aprova, não faz merge e não publica.</p>
        <div class="actions">
          <a class="btn solid" href="/studio">Abrir a mesa</a>
          <a class="btn ghost" href="#instalar">Instalar</a>
          <a class="btn ghost" href="#ciclo">Ver o ciclo</a>
        </div>
      </div>
      <section class="frame" aria-label="Execução do ciclo parada no portão humano">
        <div class="frame-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> super-factory / sdlc · R-3</div>
        <div class="frame-grid">
          <aside class="tree">
            <p>projeto</p>
            <div class="file">factory.json <span>ok</span></div>
            <div class="file">agents/</div>
            <div class="file on">workflows/sdlc.ts <span>ativo</span></div>
            <div class="file">quadro</div>
            <div class="file">trilha</div>
          </aside>
          <div class="trace">
            <div class="trace-row"><span>triagem</span><small>0.012s</small></div>
            <div class="trace-row"><span>especificação</span><small>0.041s</small></div>
            <div class="trace-row wait"><strong>portão humano</strong><small>beforeImplementation</small></div>
            <div class="trace-row"><span>verificação</span><small>ainda não</small></div>
            <div class="trace-row"><span>revisão</span><small>ainda não</small></div>
            <div class="trace-row"><span>entrega</span><small>sem merge</small></div>
          </div>
          <aside class="evals">
            <h2>avaliações</h2>
            <div class="score"><span>Evidência honesta</span><b class="ok">100%</b></div>
            <div class="score"><span>Portões humanos</span><b class="ok">100%</b></div>
            <div class="score"><span>Testes do produto</span><b class="hold">NOT_RUN</b></div>
            <div class="score"><span>Merge automático</span><b class="hold">bloqueado</b></div>
          </aside>
        </div>
      </section>
    </div>
    <section id="proposta">
      <div class="wrap">
        <p class="section-kicker">proposta</p>
        <h3>Uma mesa de operação, com o julgamento fora do agente.</h3>
        <p class="intro">A mesa continua sendo o lugar de trabalhar. A página explica o contrato: o que a fábrica conduz, o que ela observa e o que ela se recusa a fazer sozinha.</p>
        <div class="grid">
          <article class="card">
            <em>01 · Evidência</em>
            <h4>PASS só com o que foi observado.</h4>
            <p>Critério vago, segredo ou force-push para o card. Teste de produto fica <strong>NOT_RUN</strong>. A fábrica não executa shell, build nem suíte.</p>
          </article>
          <article class="card">
            <em>02 · Portões</em>
            <h4>Três pausas com nome de gente.</h4>
            <p>Antes da implementação, antes do merge e antes do release. A retomada pede aprovado, aprovador e nota. Um agente não preenche isso.</p>
          </article>
          <article class="card">
            <em>03 · Acompanhamento</em>
            <h4>GitHub e Azure DevOps no mesmo ciclo.</h4>
            <p>Com credencial, a chamada é ao vivo. Sem credencial, a resposta diz que é simulada. O pull request, quando existe, sai como rascunho.</p>
          </article>
        </div>
      </div>
    </section>
    <section id="ciclo">
      <div class="wrap">
        <p class="section-kicker">ciclo</p>
        <h3>Seis estágios, uma trilha.</h3>
        <p class="intro">Cada passo deixa registro. O relatório fecha com contexto, critérios, donos, evidência, portões e o próximo passo.</p>
        <div class="rail">
          <div class="stage"><b>01</b>Triagem</div>
          <div class="stage"><b>02</b>Especificação</div>
          <div class="stage"><b>03</b>Implementação</div>
          <div class="stage"><b>04</b>Verificação</div>
          <div class="stage"><b>05</b>Revisão humana</div>
          <div class="stage"><b>06</b>Entrega</div>
        </div>
      </div>
    </section>
    <section id="quadro">
      <div class="wrap">
        <p class="section-kicker">quadro</p>
        <h3>O quadro decide para onde o card vai.</h3>
        <p class="intro">Pedido claro ou bug com critério observável entra em ready. Pedido vago, segredo ou force-push fica blocked. A onda pega no máximo cinco cards prontos, com escritas disjuntas.</p>
        <div class="cols" aria-label="Colunas do quadro">
          <span>backlog</span><span class="hot">ready</span><span>build</span><span>qa</span><span>review</span><span class="stop">blocked</span><span>done</span>
        </div>
      </div>
    </section>
    <section id="papeis">
      <div class="wrap">
        <p class="section-kicker">papéis</p>
        <h3>Oito papéis. Um só abre o card.</h3>
        <div class="roles">
          <article class="role wide">
            <div class="file"><h4>Chief of Staff</h4><small>delega</small></div>
            <p>Único papel que abre card e encaminha o ciclo. Não aprova portão. Para os três portões, o caminho é o workflow sdlc.</p>
          </article>
          <article class="role"><h4>Architect</h4><p>Separa donos e caminhos. Se duas fatias cobrem o mesmo lugar, o card para.</p></article>
          <article class="role"><h4>Frontend</h4><p>A escrita, quando o ciclo chega lá, fica em src/ui/.</p></article>
          <article class="role"><h4>Backend</h4><p>A escrita da API fica em src/api/.</p></article>
          <article class="role"><h4>Integrations</h4><p>Lê e abre issue ou work item. Não faz merge.</p></article>
          <article class="role"><h4>QA</h4><p>Lê evidência. Não transforma NOT_RUN em PASS.</p></article>
          <article class="role"><h4>Security</h4><p>Somente leitura. Procura segredo, push protegido e portão furado.</p></article>
          <article class="role"><h4>Docs</h4><p>O relatório diz o que foi observado e o que ficou de fora.</p></article>
        </div>
      </div>
    </section>
    <section id="instalar">
      <div class="wrap">
        <p class="section-kicker">instalar</p>
        <h3>Um passo. Depois o próximo.</h3>
        <p class="intro">Se uma linha vermelha aparecer, copie essa mensagem e cole no chat da mesa. A conversa fica nesse passo, explica o conserto e só então segue. Não cole chave, token ou senha.</p>
        <div class="grid">
          <article class="card"><em>01</em><h4>Node</h4><p>Baixe a versão 22 em nodejs.org. No Terminal, node -v precisa mostrar v22.18 ou mais.</p></article>
          <article class="card"><em>02</em><h4>Terminal</h4><p>No Mac, Command + espaço e escreva Terminal. No Windows, escreva PowerShell no Iniciar.</p></article>
          <article class="card"><em>03</em><h4>Projeto</h4><p>Primeira vez, clone github.com/juliopessan/super-factory. Se a pasta já existe, não clone de novo: atualize a branch main.</p></article>
          <article class="card"><em>04</em><h4>Peças</h4><p>Dentro da pasta, npm install. Espere a linha added packages. Não use sudo.</p></article>
          <article class="card"><em>05</em><h4>Ligar</h4><p>npm run dev e deixe a janela aberta. A linha saudável mostra 4721.</p></article>
          <article class="card"><em>06</em><h4>Mesa</h4><p>No navegador, localhost:4721 é a página. localhost:4721/studio é a mesa.</p></article>
        </div>
        <p class="intro">O sétimo passo é a chave, e ele é opcional. Sem chave, a mesa funciona e avisa quando a resposta é uma amostra.</p>
      </div>
    </section>
    <section id="limites">
      <div class="wrap limits">
        <div>
          <p class="section-kicker">limites</p>
          <h3>O que a fábrica deixa do lado de fora.</h3>
          <p class="intro">O desfecho aceito-com-ressalvas significa que a pessoa aceitou o release e os testes do produto continuam fora deste ciclo.</p>
        </div>
        <div>
          <div class="limit-list">
            <article class="limit"><h4>Sem merge</h4><p>O portão libera o acompanhamento. A branch protegida não recebe push.</p></article>
            <article class="limit"><h4>Sem deploy</h4><p>Release não publica. Produção continua com quem opera o repositório.</p></article>
            <article class="limit"><h4>Sem force-push</h4><p>Pedido de push forçado ou commit direto em main para na triagem.</p></article>
            <article class="limit"><h4>Sem comando</h4><p>Nada de shell. Quem roda a suíte é uma pessoa, e o resultado fica anexado depois.</p></article>
          </div>
          <pre>{ <span class="key">"aprovado"</span>: true, <span class="key">"aprovador"</span>: "Joana", <span class="key">"nota"</span>: "Pode seguir, sem merge." }</pre>
        </div>
      </div>
    </section>
  </main>
  <div class="wrap">
    <footer>
      <span>SF · Super Factory</span>
      <span><a href="/studio">Mesa</a> · <a href="https://github.com/juliopessan/super-factory">GitHub</a></span>
    </footer>
  </div>
</body>
</html>`
}
