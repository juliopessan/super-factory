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
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #10140f;
      --bg-2: #171d15;
      --ink: #f4f0e6;
      --muted: #b3ad9f;
      --line: rgba(244, 240, 230, 0.14);
      --signal: #e4ff57;
      --signal-ink: #1b2408;
      --copper: #e0a15a;
      --shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
      --serif: "Fraunces", "Iowan Old Style", Palatino, serif;
      --sans: "Outfit", "Avenir Next", "Segoe UI", sans-serif;
      --mono: "IBM Plex Mono", ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background:
        radial-gradient(900px 480px at 85% -10%, rgba(228, 255, 87, 0.12), transparent 60%),
        radial-gradient(700px 420px at -10% 20%, rgba(224, 161, 90, 0.12), transparent 55%),
        var(--bg);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 17px;
      line-height: 1.5;
    }
    a { color: inherit; }
    .wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
    .top {
      position: sticky;
      top: 0;
      z-index: 4;
      backdrop-filter: blur(16px);
      background: rgba(16, 20, 15, 0.78);
      border-bottom: 1px solid var(--line);
    }
    .top-inner { display: flex; align-items: center; gap: 18px; min-height: 72px; }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 600; letter-spacing: -0.02em; }
    .mark {
      width: 36px; height: 36px; border-radius: 10px;
      display: grid; place-items: center;
      background: var(--signal); color: var(--signal-ink);
      font-family: var(--sans); font-weight: 600; font-size: 14px;
    }
    nav { display: flex; gap: 18px; margin-left: auto; }
    nav a { color: var(--muted); text-decoration: none; font-size: 14px; }
    nav a:hover { color: var(--ink); }
    .go {
      text-decoration: none; background: var(--signal); color: var(--signal-ink);
      border-radius: 999px; padding: 10px 16px; font-weight: 600; font-size: 14px;
    }
    .go.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
    .hero { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 48px; align-items: end; padding: 72px 0 36px; }
    .kicker { font-family: var(--mono); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--copper); margin: 0 0 16px; }
    h1 { font-family: var(--serif); font-weight: 560; font-size: clamp(44px, 6vw, 76px); line-height: 0.96; letter-spacing: -0.035em; margin: 0; }
    .lead { color: var(--muted); font-size: 18px; max-width: 46ch; margin: 22px 0 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
    .ticket {
      background: var(--bg-2);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: var(--shadow);
      padding: 22px;
      position: relative;
      overflow: hidden;
    }
    .ticket:before {
      content: "";
      position: absolute; inset: 0 auto 0 0; width: 6px;
      background: repeating-linear-gradient(var(--signal) 0 8px, transparent 8px 14px);
    }
    .ticket-head, .step, .role-top { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .ticket-head { font-family: var(--mono); font-size: 12px; color: var(--muted); padding-left: 10px; }
    .pill { color: var(--signal-ink); background: var(--signal); border-radius: 999px; padding: 2px 8px; font-weight: 500; }
    .ticket h2 { font-family: var(--serif); font-size: 32px; line-height: 1.05; margin: 14px 0 18px; padding-left: 10px; font-weight: 560; }
    .step { padding: 9px 10px; border-top: 1px solid var(--line); font-size: 14px; }
    .step strong { font-weight: 500; }
    .step span { font-family: var(--mono); font-size: 12px; color: var(--muted); }
    .step.wait { background: rgba(228, 255, 87, 0.08); }
    .step.wait span { color: var(--signal); }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .stat { padding: 22px 8px; }
    .stat b { display: block; font-family: var(--serif); font-size: 34px; font-weight: 560; letter-spacing: -0.03em; }
    .stat span { color: var(--muted); font-size: 14px; }
    section { padding: 72px 0; }
    h3 { font-family: var(--serif); font-size: clamp(32px, 4vw, 48px); line-height: 1.05; letter-spacing: -0.03em; font-weight: 560; margin: 0 0 12px; }
    .intro { color: var(--muted); max-width: 62ch; margin: 0 0 28px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .card, .role, .limit {
      background: rgba(23, 29, 21, 0.8);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px;
    }
    .card em, .role small { font-family: var(--mono); font-style: normal; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--copper); }
    .card h4, .role h4, .limit h4 { margin: 10px 0 8px; font-size: 20px; letter-spacing: -0.02em; }
    .card p, .role p, .limit p { margin: 0; color: var(--muted); }
    .rail { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
    .stage { min-height: 140px; border-radius: 16px; border: 1px solid var(--line); padding: 14px; background: var(--bg-2); }
    .stage b { display: block; font-family: var(--mono); font-size: 12px; color: var(--signal); margin-bottom: 18px; }
    .cols { display: flex; flex-wrap: wrap; gap: 8px; }
    .cols span { border: 1px solid var(--line); border-radius: 999px; padding: 8px 12px; font-family: var(--mono); font-size: 13px; }
    .cols .hot { background: var(--signal); color: var(--signal-ink); border-color: transparent; }
    .cols .stop { border-color: var(--copper); color: var(--copper); }
    .roles { display: grid; grid-template-columns: 1.3fr repeat(3, 1fr); gap: 12px; }
    .role.wide { grid-column: span 2; background: linear-gradient(180deg, rgba(228, 255, 87, 0.12), rgba(23, 29, 21, 0.9)); }
    .limits { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 28px; align-items: start; }
    .limit-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    pre {
      margin: 0; padding: 18px; border-radius: 16px; background: #0b0e0a; border: 1px solid var(--line);
      overflow: auto; font-family: var(--mono); font-size: 13px; line-height: 1.6; color: #efe8d4;
    }
    footer { border-top: 1px solid var(--line); padding: 28px 0 40px; color: var(--muted); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    footer a { color: var(--ink); }
    @media (max-width: 860px) {
      nav { display: none; }
      .hero, .grid, .rail, .roles, .limits, .limit-list, .stats { grid-template-columns: 1fr; }
      .hero { padding-top: 36px; }
      section { padding: 48px 0; }
      .role.wide { grid-column: auto; }
    }
  </style>
</head>
<body>
  <header class="top">
    <div class="wrap top-inner">
      <a class="brand" href="/"><span class="mark" aria-hidden="true">SF</span> Super Factory</a>
      <nav>
        <a href="#proposta">Proposta</a>
        <a href="#ciclo">Ciclo</a>
        <a href="#papeis">Papéis</a>
        <a href="#limites">Limites</a>
      </nav>
      <a class="go" href="/studio">Abrir o Studio</a>
    </div>
  </header>
  <main>
    <div class="wrap hero">
      <div>
        <p class="kicker">SDLC agentic · evidência antes de confiança</p>
        <h1>O pedido só atravessa a fábrica quando uma pessoa libera.</h1>
        <p class="lead">Super Factory é a mesa. Um pedido vira card, passa por triagem, especificação, plano, verificação e revisão, e para três vezes: implementação, merge e release. Agente não aprova, não faz merge e não publica.</p>
        <div class="actions">
          <a class="go" href="/studio">Entrar na mesa</a>
          <a class="go ghost" href="#ciclo">Ver o ciclo</a>
        </div>
      </div>
      <aside class="ticket" aria-label="Exemplo de card parado no portão de implementação">
        <div class="ticket-head"><span>C-18 · github · acme/widgets</span><span class="pill">ready</span></div>
        <h2>Filtro de datas com hora</h2>
        <div class="step"><strong>Triagem</strong><span>observado</span></div>
        <div class="step"><strong>Especificação</strong><span>registrada</span></div>
        <div class="step wait"><strong>Implementação</strong><span>portão humano</span></div>
        <div class="step"><strong>Verificação</strong><span>ainda não</span></div>
        <div class="step"><strong>Revisão</strong><span>ainda não</span></div>
        <div class="step"><strong>Entrega</strong><span>sem merge</span></div>
      </aside>
    </div>
    <div class="wrap stats">
      <div class="stat"><b>3</b><span>portões que só uma pessoa abre</span></div>
      <div class="stat"><b>8</b><span>papéis, um único delegador</span></div>
      <div class="stat"><b>0</b><span>deploys feitos pela fábrica</span></div>
    </div>
    <section id="proposta">
      <div class="wrap">
        <h3>Uma mesa de operação, não um piloto automático.</h3>
        <p class="intro">O Studio continua sendo o lugar de trabalhar. Esta página explica o contrato: o que a fábrica conduz, o que ela observa e o que ela se recusa a fazer sozinha.</p>
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
        <h3>O quadro decide para onde o card vai.</h3>
        <p class="intro">Pedido claro ou bug com critério observável entra em ready. Pedido vago, segredo ou force-push fica blocked. A onda pega no máximo cinco cards prontos, com escritas disjuntas.</p>
        <div class="cols" aria-label="Colunas do quadro">
          <span>backlog</span><span class="hot">ready</span><span>build</span><span>qa</span><span>review</span><span class="stop">blocked</span><span>done</span>
        </div>
      </div>
    </section>
    <section id="papeis">
      <div class="wrap">
        <h3>Oito papéis. Um só abre o card.</h3>
        <div class="roles">
          <article class="role wide">
            <div class="role-top"><h4>Chief of Staff</h4><small>delega</small></div>
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
    <section id="limites">
      <div class="wrap limits">
        <div>
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
          <pre>{ "aprovado": true, "aprovador": "Joana", "nota": "Pode seguir, sem merge." }</pre>
        </div>
      </div>
    </section>
  </main>
  <div class="wrap">
    <footer>
      <span>SF · Super Factory</span>
      <span><a href="/studio">Studio</a> · <a href="https://github.com/juliopessan/super-factory">GitHub</a></span>
    </footer>
  </div>
</body>
</html>`
}
