export function paginaInicial(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Super Factory</title>
  <meta name="description" content="Na Factory, um pedido vira card e só atravessa implementação, merge e release quando uma pessoa libera." />
  <link rel="icon" href="/sf.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,400&display=swap" rel="stylesheet" />
  <script>
    try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('mov') } catch (e) {}
    setTimeout(function () { if (!window.Motion) document.documentElement.classList.remove('mov') }, 2500)
  </script>
  <script src="/motion.js" defer onerror="document.documentElement.classList.remove('mov')"></script>
  <style>
    /* Tokens do design system Codos. Fraunces substitui a GT Alpina Typewriter (licença de teste). */
    :root {
      --ground-pink: #f9def2;
      --ground-lilac: #eae3ee;
      --ground-peach: #f3d9b8;
      --ground-mint: #e6eee3;
      --bg: #ebe1f0;
      --panel: #c8bfcc;
      --panel-tab: #b9afbd;
      --chip: #ffffff;
      --text: #1a1a1a;
      --muted: #3a3a3a;
      --faint: #1a1a1a8c;
      --border: #1a1a1a1f;
      --border-strong: #1a1a1a38;
      --hairline: #1a1a1a14;
      --accent: #ff8c00;
      --accent-ring: #ff8c001f;
      --sun: #ffe100;
      --signal: #00c22d;
      --success: #2c5a44;
      --warning: #9a6a00;
      --danger: #7a3a1c;
      --footer-bg: #171619;
      --footer-text: #eee8f1;
      --veil: #1a1a1a73;
      --headline: "GT Alpina Typewriter", "Fraunces", Georgia, serif;
      --body: "DM Mono", "Geist Mono", ui-monospace, monospace;
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 16px;
      --gutter: clamp(1rem, 5.6vw, 5.6rem);
      --ease: cubic-bezier(.22, 1, .36, 1);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ground-pink: #000000; --ground-lilac: #000000; --ground-peach: #000000; --ground-mint: #000000;
        --bg: #000000; --panel: #ffffff0a; --panel-tab: #ffffff14; --chip: #ffffff14;
        --text: #ffffff; --muted: #9ca3af; --faint: #ffffff8c;
        --border: #ffffff1a; --border-strong: #ffffff38; --hairline: #ffffff0f;
        --accent: #f97316; --accent-ring: #f9731638;
        --success: #4ade80; --warning: #fbbf24; --danger: #f87171;
        --footer-bg: #0b0b0c; --veil: #000000a6;
      }
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; } }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: var(--body);
      font-size: clamp(.9375rem, .9rem + .2vw, 1.0625rem);
      line-height: 1.6;
    }
    a { color: inherit; }
    :focus-visible { outline: 2px solid var(--text); outline-offset: 2px; border-radius: var(--radius-sm); }
    .wrap { width: 100%; max-width: 90rem; margin: 0 auto; padding: 0 var(--gutter); }
    h1, h2, h3, h4 { font-family: var(--headline); font-weight: 400; margin: 0; }

    .top { position: sticky; top: 0; z-index: 5; background: var(--ground-pink); border-bottom: 1px solid var(--border); }
    .top-inner { display: flex; align-items: center; gap: 24px; min-height: 68px; }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-family: var(--headline); font-size: 21px; }
    .mark { width: 28px; height: 28px; border-radius: var(--radius-md); display: grid; place-items: center; background: var(--accent); color: #1a1a1a; font-family: var(--body); font-size: 12px; font-weight: 500; }
    nav { display: flex; gap: 22px; }
    nav a { color: var(--muted); font-size: 14px; text-decoration: none; }
    nav a:hover { color: var(--text); text-decoration: underline; text-underline-offset: 4px; }
    .nav-cta { margin-left: auto; display: flex; gap: 8px; }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 40px; padding: 0 16px; border-radius: var(--radius-md);
      border: 1px solid transparent; font-family: var(--body); font-size: 14px; letter-spacing: .005em;
      text-decoration: none; cursor: pointer; transition: background .15s var(--ease), border-color .15s var(--ease);
    }
    .btn.solid { background: var(--text); color: var(--bg); }
    .btn.solid:hover { background: var(--muted); }
    .btn.ghost { background: transparent; color: var(--text); border-color: var(--border-strong); }
    .btn.ghost:hover { border-color: var(--text); }
    .btn.lg { min-height: 52px; padding: 0 22px; font-size: clamp(.9375rem, .8rem + .4vw, 1.125rem); }

    .chip {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 4px 10px; border-radius: var(--radius-sm); background: var(--chip); color: var(--text);
      font-size: 12px; letter-spacing: .1em; line-height: 1.45;
    }
    .dot { width: 7px; height: 7px; border-radius: 9999px; background: var(--signal); display: inline-block; }
    .dot.hold { background: var(--accent); }

    .ground-pink { background: var(--ground-pink); }
    .ground-lilac { background: var(--ground-lilac); }
    .ground-peach { background: var(--ground-peach); }
    .ground-mint { background: var(--ground-mint); }
    section { padding: clamp(56px, 7vw, 100px) 0; }

    .hero { padding-top: clamp(56px, 8vw, 112px); padding-bottom: clamp(40px, 5vw, 64px); }
    .hero h1 { font-size: clamp(2.5rem, .5rem + 6.2vw, 7rem); line-height: 1; letter-spacing: -.02em; max-width: 14ch; margin-top: 24px; }
    .sub {
      text-decoration-line: underline; text-decoration-color: var(--accent);
      text-decoration-thickness: max(1.5px, .03em); text-underline-offset: .09em; text-decoration-skip-ink: none;
    }
    .verbo { display: inline-block; white-space: nowrap; vertical-align: bottom; overflow: hidden; padding-bottom: .12em; margin-bottom: -.12em; }
    .verbo-txt { display: inline-block; }
    .gira { display: inline-block; color: var(--accent); line-height: 1; animation: gira 1.6s linear infinite; }
    @keyframes gira { to { transform: rotate(360deg); } }
    .pulsa { animation: pulsa 1.8s ease-in-out infinite; }
    @keyframes pulsa { 50% { opacity: .35; } }
    .mov [data-revela] { opacity: 0; }
    @media (prefers-reduced-motion: reduce) { .gira, .pulsa { animation: none; } .mov [data-revela] { opacity: 1; } }
    .intro { margin: 28px 0 0; max-width: 46ch; color: var(--muted); font-size: clamp(1.0625rem, .85rem + .8vw, 1.5rem); line-height: 1.4; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 36px; }

    .panel { border: 1px solid var(--border-strong); border-radius: var(--radius-lg); background: var(--panel); overflow: hidden; }
    .panel-bar { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 14px; background: var(--panel-tab); font-size: 12px; letter-spacing: .1em; color: var(--muted); }
    .dots { display: flex; gap: 6px; }
    .dots i { width: 9px; height: 9px; border-radius: 9999px; border: 1px solid var(--border-strong); display: block; }
    .panel-grid { display: grid; grid-template-columns: 240px 1fr 280px; }
    .panel-grid > * { min-width: 0; padding: 14px; }
    .panel-grid > * + * { border-left: 1px solid var(--border); }
    .panel h2 { margin: 2px 4px 10px; font-family: var(--body); font-size: 12px; letter-spacing: .1em; color: var(--muted); }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 9px 4px; border-bottom: 1px solid var(--hairline); font-size: 14px; }
    .row:last-child { border-bottom: 0; }
    .row small { color: var(--muted); font-size: 12px; }
    .row.on { background: var(--chip); border-radius: var(--radius-sm); border-bottom-color: transparent; padding: 9px 10px; }
    .row.wait { background: var(--chip); border-radius: var(--radius-sm); padding: 9px 10px; border-bottom-color: transparent; }
    .row.wait > span:first-child { text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: 2px; text-underline-offset: 4px; }
    .row small .gira { margin-right: 6px; }
    .panel-bar .status { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; color: var(--text); letter-spacing: .04em; }

    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-top: clamp(40px, 5vw, 64px); }
    .metric { padding: 24px 20px 22px 0; }
    .metric + .metric { border-left: 1px solid var(--border); padding-left: 20px; }
    .metric b { display: block; font-family: var(--headline); font-weight: 400; font-size: clamp(2.75rem, .8rem + 4vw, 5rem); line-height: .95; }
    .metric span { display: block; margin-top: 10px; color: var(--muted); font-size: 14px; }

    .eyebrow { margin: 0 0 16px; font-size: 12px; letter-spacing: .1em; color: var(--muted); }
    .section-head { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: clamp(24px, 5vw, 80px); align-items: end; margin-bottom: clamp(32px, 4vw, 56px); }
    .section-head h2 { font-size: clamp(1.75rem, 1rem + 2.2vw, 3.25rem); line-height: 1.08; letter-spacing: -.01em; }
    .section-head p { margin: 0; color: var(--muted); max-width: 52ch; }

    .list { border-top: 1px solid var(--border-strong); }
    .item { display: grid; grid-template-columns: 72px minmax(0, 4fr) minmax(0, 6fr); gap: 24px; padding: 24px 0; border-bottom: 1px solid var(--hairline); align-items: baseline; }
    .item > span { font-size: 12px; letter-spacing: .1em; color: var(--muted); }
    .item h3 { font-size: clamp(1.25rem, .9rem + .9vw, 1.75rem); line-height: 1.2; }
    .item p { margin: 0; color: var(--muted); }

    .rail { display: grid; grid-template-columns: repeat(9, auto); align-items: stretch; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .stage { min-width: 128px; padding: 14px; border: 1px solid var(--border-strong); border-radius: var(--radius-lg); background: var(--chip); }
    .stage b { display: block; margin-bottom: 30px; font-weight: 400; font-size: 12px; letter-spacing: .1em; color: var(--muted); }
    .stage h3 { font-size: 19px; line-height: 1.2; }
    .gate { display: flex; flex-direction: column; justify-content: space-between; min-width: 104px; padding: 14px; border-radius: var(--radius-lg); border: 1px dashed var(--border-strong); color: var(--text); }
    .gate b { font-weight: 400; font-size: 12px; letter-spacing: .1em; text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: 2px; text-underline-offset: 4px; }
    .gate span { font-size: 13px; line-height: 1.35; }
    .legend { margin: 18px 0 0; font-size: 14px; color: var(--muted); }

    .cols { display: flex; flex-wrap: wrap; gap: 8px; }
    .cols span { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 13px; letter-spacing: .05em; background: var(--chip); }
    .cols .hot { background: var(--text); color: var(--bg); border-color: transparent; }
    .cols .stop { color: var(--danger); }
    .cols .stop::before { content: "×"; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-weight: 400; font-size: 12px; letter-spacing: .1em; color: var(--muted); padding: 0 16px 12px 0; border-bottom: 1px solid var(--border-strong); }
    td { padding: 16px 16px 16px 0; border-bottom: 1px solid var(--hairline); vertical-align: top; color: var(--muted); }
    td:first-child { color: var(--text); font-family: var(--headline); font-size: 20px; white-space: nowrap; }
    .lado { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--border-strong); border-radius: var(--radius-lg); overflow: hidden; background: var(--chip); }
    .lado > div { padding: clamp(20px, 3vw, 32px); min-width: 0; }
    .lado > div + div { border-left: 1px solid var(--border-strong); }
    .lado h3 { font-size: clamp(1.375rem, .9rem + 1.2vw, 1.875rem); margin-bottom: 16px; }
    .lado ul { margin: 0; padding: 0; list-style: none; }
    .lado li { padding: 12px 0; border-top: 1px solid var(--hairline); }
    pre {
      margin: 24px 0 0; padding: 16px; border-radius: var(--radius-lg);
      background: var(--chip); border: 1px solid var(--border-strong);
      overflow: auto; font-family: var(--body); font-size: 13px; line-height: 1.6; color: var(--text);
    }
    .key { color: var(--danger); }
    .nota { margin: 16px 0 0; font-size: 14px; color: var(--muted); max-width: 70ch; }

    .steps { counter-reset: passo; border-top: 1px solid var(--border-strong); }
    .step { display: grid; grid-template-columns: 72px minmax(0, 3fr) minmax(0, 7fr); gap: 24px; padding: 22px 0; border-bottom: 1px solid var(--hairline); align-items: baseline; border-radius: var(--radius-sm); }
    .step > span { font-family: var(--headline); font-size: clamp(1.75rem, 1rem + 1.4vw, 2.5rem); line-height: 1; }
    .step h3 { font-size: clamp(1.25rem, .9rem + .9vw, 1.6rem); }
    .step p { margin: 0; color: var(--muted); }
    code { font-family: var(--body); background: var(--chip); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 1px 6px; font-size: .92em; color: var(--text); overflow-wrap: anywhere; }
    .step.opcional > span { color: var(--faint); }

    footer { background: var(--footer-bg); color: var(--footer-text); padding: 48px 0 56px; }
    .foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 14px; }
    .foot .brand { color: var(--footer-text); }
    .foot a { color: var(--footer-text); text-underline-offset: 4px; }

    .guia-alvo { position: relative; z-index: 40; outline: 2px solid var(--text); outline-offset: 6px; background: var(--bg); border-radius: var(--radius-lg); transition: outline-offset .25s var(--ease); }
    .guia-velo { position: fixed; inset: 0; z-index: 30; background: var(--veil); }
    .guia-painel {
      position: fixed; z-index: 50; left: 50%; bottom: 20px; transform: translateX(-50%);
      width: min(560px, calc(100% - 24px)); background: var(--chip); color: var(--text);
      border: 1px solid var(--border-strong); border-radius: var(--radius-lg); padding: 20px;
    }
    @media (prefers-color-scheme: dark) { .guia-painel { background: #111113; } .guia-alvo { background: #000; } }
    .guia-painel[hidden], #guia[hidden] { display: none; }
    .guia-kicker { margin: 0 0 8px; font-size: 12px; letter-spacing: .1em; color: var(--muted); }
    .guia-painel h2 { margin: 0 0 8px; font-size: 26px; line-height: 1.15; }
    .guia-painel p { margin: 0; color: var(--muted); }
    .guia-acoes { display: flex; gap: 8px; margin-top: 16px; }
    .guia-acoes button { min-height: 40px; padding: 0 16px; border-radius: var(--radius-md); border: 1px solid var(--border-strong); background: transparent; color: var(--text); cursor: pointer; font: inherit; font-size: 14px; }
    .guia-acoes .solid { background: var(--text); color: var(--bg); border-color: transparent; }

    @media (max-width: 1080px) {
      nav { display: none; }
      .panel-grid { grid-template-columns: 1fr; }
      .panel-grid > * + * { border-left: 0; border-top: 1px solid var(--border); }
      .section-head { grid-template-columns: 1fr; align-items: start; }
    }
    @media (max-width: 760px) {
      .metrics { grid-template-columns: 1fr 1fr; }
      .metric:nth-child(3) { border-left: 0; padding-left: 0; }
      .metric:nth-child(n + 3) { border-top: 1px solid var(--border); }
      .item, .step { grid-template-columns: 48px minmax(0, 1fr); gap: 8px 16px; }
      .item p, .step p { grid-column: 2; }
      .lado { grid-template-columns: 1fr; }
      .rail { grid-template-columns: 1fr; overflow: visible; }
      .stage, .gate { min-width: 0; }
      .stage b { margin-bottom: 8px; }
      .gate { flex-direction: row; align-items: baseline; gap: 12px; justify-content: flex-start; }
      .lado > div + div { border-left: 0; border-top: 1px solid var(--border-strong); }
      table, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { padding: 14px 0; border-bottom: 1px solid var(--hairline); }
      td { border: 0; padding: 2px 0; }
      td:first-child { white-space: normal; }
      .guia-painel { bottom: 12px; }
    }
    @media (max-width: 480px) {
      .top-inner { gap: 12px; }
      .brand span.nome { display: none; }
      .actions .btn { width: 100%; }
    }
  </style>
</head>
<body>
  <header class="top">
    <div class="wrap top-inner">
      <a class="brand" href="/"><span class="mark" aria-hidden="true">SF</span><span class="nome">Super Factory</span></a>
      <nav aria-label="Seções">
        <a href="#ciclo">Como funciona</a>
        <a href="#quadro">Quadro</a>
        <a href="#papeis">Papéis</a>
        <a href="#limites">Limites</a>
        <a href="#instalar">Instalar</a>
      </nav>
      <div class="nav-cta">
        <button class="btn ghost" type="button" id="guia-abrir">Guia-me</button>
        <a class="btn solid" href="/studio" id="factory-cta">Abrir a Factory →</a>
      </div>
    </div>
  </header>
  <main>
    <div class="ground-pink">
      <div class="wrap hero">
        <span class="chip"><span class="gira" aria-hidden="true">✻</span>SDLC com agentes · evidência antes de confiança</span>
        <h1 aria-label="Conduza o pedido. Pare no portão."><span class="verbo" aria-hidden="true"><span class="verbo-txt">Conduza</span></span><span aria-hidden="true"> o pedido. <span class="sub">Pare</span> no portão.</span></h1>
        <p class="intro">Cada pedido vira um card e atravessa seis estágios. Em três momentos, ele só segue quando uma pessoa libera.</p>
        <div class="actions">
          <a class="btn solid lg" href="/studio">Abrir a Factory →</a>
          <a class="btn ghost lg" href="#instalar">Instalar em 7 passos →</a>
        </div>
      </div>
      <div class="wrap">
        <section class="panel" id="portao" aria-label="Execução do ciclo parada no portão humano" style="padding: 0">
          <div class="panel-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>super-factory / sdlc · R-3<span class="status" aria-live="polite"><span class="gira" aria-hidden="true">✻</span><span id="painel-status">Esperando a Joana…</span></span></div>
          <div class="panel-grid">
            <aside>
              <h2>Projeto</h2>
              <div class="row">factory.json <small>ok</small></div>
              <div class="row">agents/</div>
              <div class="row on">workflows/sdlc.ts <small>ativo</small></div>
              <div class="row">quadro</div>
              <div class="row">trilha</div>
            </aside>
            <div>
              <h2>Trilha</h2>
              <div class="row" data-etapa="0"><span>Triagem</span><small>0,012 s</small></div>
              <div class="row" data-etapa="1"><span>Especificação</span><small>0,041 s</small></div>
              <div class="row wait" data-etapa="2"><span>Portão humano · implementação</span><small><span class="gira" aria-hidden="true">✻</span>aguardando</small></div>
              <div class="row" data-etapa="3"><span>Verificação</span><small>ainda não</small></div>
              <div class="row" data-etapa="4"><span>Revisão</span><small>ainda não</small></div>
              <div class="row" data-etapa="5"><span>Entrega</span><small>sem merge</small></div>
            </div>
            <aside>
              <h2>Avaliações</h2>
              <div class="row"><span>Evidência honesta</span><small><span class="dot" aria-hidden="true"></span> 100%</small></div>
              <div class="row"><span>Portões humanos</span><small><span class="dot" aria-hidden="true"></span> 100%</small></div>
              <div class="row"><span>Testes do produto</span><small><span class="dot hold" aria-hidden="true"></span> NOT_RUN</small></div>
              <div class="row"><span>Merge automático</span><small><span class="dot hold" aria-hidden="true"></span> bloqueado</small></div>
            </aside>
          </div>
        </section>
        <div class="metrics" aria-label="A Factory em números">
          <div class="metric" data-revela><b data-conta="3">3</b><span>portões com nome de gente</span></div>
          <div class="metric" data-revela><b data-conta="6">6</b><span>estágios com registro</span></div>
          <div class="metric" data-revela><b data-conta="8">8</b><span>papéis, um só abre card</span></div>
          <div class="metric" data-revela><b data-conta="0">0</b><span>merges e deploys automáticos</span></div>
        </div>
      </div>
    </div>

    <section id="proposta" class="ground-lilac">
      <div class="wrap">
        <div class="section-head" data-revela>
          <div>
            <p class="eyebrow">Por que a Factory</p>
            <h2>O agente conduz. A decisão fica com você.</h2>
          </div>
          <p>A Factory organiza o trabalho dos agentes e guarda o que cada um observou. O que muda o repositório passa por uma pessoa.</p>
        </div>
        <div class="list">
          <article class="item" data-revela><span>01</span><h3>PASS só com o que foi observado.</h3><p>Critério vago, segredo ou force-push param o card. Teste de produto fica <code>NOT_RUN</code>: a Factory não roda shell, build nem suíte.</p></article>
          <article class="item" data-revela><span>02</span><h3>Três pausas com nome de gente.</h3><p>Antes da implementação, do merge e do release. Para seguir, a pessoa informa quem aprovou e por quê. Um agente não preenche isso.</p></article>
          <article class="item" data-revela><span>03</span><h3>GitHub e Azure DevOps no mesmo ciclo.</h3><p>Com credencial, a chamada é real. Sem credencial, a resposta diz que é simulada. O pull request, quando existe, sai como rascunho.</p></article>
        </div>
      </div>
    </section>

    <section id="ciclo" class="ground-lilac" style="padding-top: 0">
      <div class="wrap">
        <div class="section-head" data-revela>
          <div>
            <p class="eyebrow">Como funciona</p>
            <h2>Seis estágios. Três portões.</h2>
          </div>
          <p>Cada estágio deixa registro na trilha. O relatório fecha com contexto, critérios, donos, evidência, portões e o próximo passo.</p>
        </div>
        <div class="rail" role="list">
          <div class="stage" role="listitem" data-revela><b>01</b><h3>Triagem</h3></div>
          <div class="stage" role="listitem" data-revela><b>02</b><h3>Especificação</h3></div>
          <div class="gate" role="listitem" data-revela><b>Portão</b><span>Libera a implementação</span></div>
          <div class="stage" role="listitem" data-revela><b>03</b><h3>Implementação</h3></div>
          <div class="stage" role="listitem" data-revela><b>04</b><h3>Verificação</h3></div>
          <div class="stage" role="listitem" data-revela><b>05</b><h3>Revisão</h3></div>
          <div class="gate" role="listitem" data-revela><b>Portão</b><span>Libera o acompanhamento</span></div>
          <div class="stage" role="listitem" data-revela><b>06</b><h3>Entrega</h3></div>
          <div class="gate" role="listitem" data-revela><b>Portão</b><span>Aceita o release</span></div>
        </div>
        <p class="legend">Tracejado e sublinhado em laranja: onde o ciclo espera uma pessoa.</p>
      </div>
    </section>

    <section id="quadro" class="ground-peach">
      <div class="wrap">
        <div class="section-head" data-revela>
          <div>
            <p class="eyebrow">Quadro</p>
            <h2>O quadro decide para onde o card vai.</h2>
          </div>
          <p>Pedido claro ou bug com critério observável entra em <code>ready</code>. Pedido vago, segredo ou force-push vai para <code>blocked</code>. Cada onda leva no máximo 5 cards, sem dois mexendo no mesmo lugar.</p>
        </div>
        <div class="cols" aria-label="Colunas do quadro" data-revela>
          <span>backlog</span><span class="hot">ready</span><span>build</span><span>qa</span><span>review</span><span class="stop">blocked</span><span>done</span>
        </div>
      </div>
    </section>

    <section id="papeis" class="ground-peach" style="padding-top: 0">
      <div class="wrap">
        <div class="section-head" data-revela>
          <div>
            <p class="eyebrow">Papéis</p>
            <h2>Oito papéis. Um só abre o card.</h2>
          </div>
          <p>Cada papel tem um lugar para escrever ou só lê. Nenhum deles aprova portão.</p>
        </div>
        <table data-revela>
          <thead><tr><th scope="col">Papel</th><th scope="col">O que faz</th><th scope="col">Onde escreve</th></tr></thead>
          <tbody>
            <tr><td>Chief of Staff</td><td>Abre o card e encaminha o ciclo pelo workflow <code>sdlc</code>.</td><td>Quadro</td></tr>
            <tr><td>Architect</td><td>Separa donos e caminhos. Se duas fatias cobrem o mesmo lugar, o card para.</td><td>Plano</td></tr>
            <tr><td>Frontend</td><td>Escreve a interface quando o ciclo chega à implementação.</td><td><code>src/ui/</code></td></tr>
            <tr><td>Backend</td><td>Escreve a API quando o ciclo chega à implementação.</td><td><code>src/api/</code></td></tr>
            <tr><td>Integrations</td><td>Lê e abre issue ou work item. Não faz merge.</td><td>GitHub, Azure DevOps</td></tr>
            <tr><td>QA</td><td>Lê a evidência. Não transforma <code>NOT_RUN</code> em <code>PASS</code>.</td><td>Só lê</td></tr>
            <tr><td>Security</td><td>Procura segredo, push protegido e portão furado.</td><td>Só lê</td></tr>
            <tr><td>Docs</td><td>Diz no relatório o que foi observado e o que ficou de fora.</td><td>Relatório</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="limites" class="ground-mint">
      <div class="wrap">
        <div class="section-head" data-revela>
          <div>
            <p class="eyebrow">Limites</p>
            <h2>O agente prepara. Uma pessoa decide.</h2>
          </div>
          <p>A Factory não tenta fazer tudo. O que tem consequência fora do card continua com quem opera o repositório.</p>
        </div>
        <div class="lado" data-revela>
          <div>
            <h3>A Factory faz</h3>
            <ul>
              <li>Triagem, especificação e plano do card</li>
              <li>Checks internos, com evidência do que observou</li>
              <li>Issue ou work item no provedor</li>
              <li>Pull request em rascunho, quando a branch existe</li>
            </ul>
          </div>
          <div>
            <h3><span class="sub">Fica com uma pessoa</span></h3>
            <ul>
              <li>Merge: a branch protegida não recebe push</li>
              <li>Deploy: o release não publica nada</li>
              <li>Force-push e commit direto em <code>main</code></li>
              <li>Rodar a suíte do produto e anexar o resultado</li>
            </ul>
          </div>
        </div>
        <pre aria-label="Exemplo de retomada de um portão">{ <span class="key">"aprovado"</span>: true, <span class="key">"aprovador"</span>: "Joana", <span class="key">"nota"</span>: "Pode seguir, sem merge." }</pre>
        <p class="nota">Assim uma pessoa libera um portão. O desfecho <code>aceito-com-ressalvas</code> quer dizer que o release foi aceito e os testes do produto continuam fora deste ciclo.</p>
      </div>
    </section>

    <section id="instalar" class="ground-mint" style="padding-top: 0">
      <div class="wrap">
        <div class="section-head" data-revela>
          <div>
            <p class="eyebrow">Instalar</p>
            <h2>Um passo. Depois o próximo.</h2>
          </div>
          <p>Se uma linha vermelha aparecer, copie a mensagem e cole no chat da Factory. A conversa fica nesse passo, explica o conserto e só então segue. Não cole chave, token ou senha.</p>
        </div>
        <div class="steps">
          <article class="step" data-revela id="passo-1"><span>1</span><h3>Node</h3><p>Baixe a versão 22 em nodejs.org. No Terminal, <code>node -v</code> precisa mostrar v22.18 ou mais.</p></article>
          <article class="step" data-revela id="passo-2"><span>2</span><h3>Terminal</h3><p>No Mac, Command + espaço e escreva Terminal. No Windows, procure PowerShell no Iniciar.</p></article>
          <article class="step" data-revela id="passo-3"><span>3</span><h3>Projeto</h3><p>Na primeira vez, clone <code>github.com/juliopessan/super-factory</code>. Se a pasta já existe, não clone de novo: atualize a branch <code>main</code>.</p></article>
          <article class="step" data-revela id="passo-4"><span>4</span><h3>Peças</h3><p>Dentro da pasta, <code>npm install</code>. Espere a linha <code>added packages</code>. Não use sudo.</p></article>
          <article class="step" data-revela id="passo-5"><span>5</span><h3>Ligar</h3><p><code>npm run dev</code> e deixe a janela aberta. A linha saudável mostra 4721.</p></article>
          <article class="step" data-revela id="passo-6"><span>6</span><h3>Factory</h3><p>No navegador, <code>localhost:4721</code> é esta página. <code>localhost:4721/studio</code> é a Factory.</p></article>
          <article class="step opcional" id="passo-7"><span>7</span><h3>Chave, se quiser</h3><p>É opcional. Sem chave, a Factory funciona e avisa quando a resposta é uma amostra.</p></article>
        </div>
        <div class="actions">
          <a class="btn solid lg" href="/studio">Abrir a Factory →</a>
        </div>
      </div>
    </section>
  </main>
  <footer>
    <div class="wrap foot">
      <a class="brand" href="/"><span class="mark" aria-hidden="true">SF</span>Super Factory</a>
      <span><a href="/studio">Factory</a> · <a href="https://github.com/juliopessan/super-factory">GitHub</a></span>
    </div>
  </footer>
  <div id="guia" hidden>
    <div class="guia-velo"></div>
    <div class="guia-painel" role="dialog" aria-modal="true" aria-labelledby="guia-titulo">
      <p class="guia-kicker" id="guia-indice"></p>
      <h2 id="guia-titulo"></h2>
      <p id="guia-texto"></p>
      <div class="guia-acoes">
        <button type="button" id="guia-voltar">Voltar</button>
        <button type="button" class="solid" id="guia-seguir">Seguir</button>
        <button type="button" id="guia-fechar">Fechar</button>
      </div>
    </div>
  </div>
  <script>
    (function () {
      var passos = [
        { alvo: 'passo-1', titulo: 'Instale o Node', texto: 'Baixe a versão 22 em nodejs.org. No Terminal, node -v precisa mostrar v22.18 ou mais. Se a versão for antiga, fique neste passo.' },
        { alvo: 'passo-2', titulo: 'Abra o Terminal', texto: 'No Mac, Command e espaço, e escreva Terminal. No Windows, escreva PowerShell no Iniciar.' },
        { alvo: 'passo-3', titulo: 'Traga o projeto', texto: 'Primeira vez, clone github.com/juliopessan/super-factory. Se a pasta já existe, não clone de novo: atualize a branch main.' },
        { alvo: 'passo-4', titulo: 'Instale as peças', texto: 'Dentro da pasta, npm install. Espere a linha added packages. Não use sudo. Se der erro, cole a mensagem no chat e continue daqui.' },
        { alvo: 'passo-5', titulo: 'Ligue a Factory', texto: 'npm run dev e deixe a janela aberta. A linha saudável mostra 4721.' },
        { alvo: 'passo-6', titulo: 'Abra no navegador', texto: 'localhost:4721 é esta página. localhost:4721/studio é a Factory, onde o chat continua a instalação.' },
        { alvo: 'passo-7', titulo: 'A chave é opcional', texto: 'Sem chave, a Factory funciona e avisa quando a resposta é uma amostra. Não cole chave, token ou senha no chat.' },
        { alvo: 'portao', titulo: 'O ciclo para no portão', texto: 'Um pedido passa por triagem e especificação e espera uma pessoa em implementação, merge e release. O agente não aprova.' },
        { alvo: 'ciclo', titulo: 'Seis estágios', texto: 'Triagem, especificação, implementação, verificação, revisão humana e entrega. Cada passo deixa registro.' },
        { alvo: 'quadro', titulo: 'O quadro', texto: 'Pedido claro entra em ready. Pedido vago, segredo ou force-push fica blocked. A onda leva no máximo cinco cards.' },
        { alvo: 'papeis', titulo: 'Oito papéis', texto: 'Só o Chief of Staff abre card. Security é somente leitura. Nenhum papel aprova portão.' },
        { alvo: 'limites', titulo: 'O que fica de fora', texto: 'Sem merge, sem deploy, sem force-push e sem comando. Teste de produto continua NOT_RUN até uma pessoa rodar fora daqui.' },
        { alvo: 'factory-cta', titulo: 'Agora a Factory', texto: 'Abra a Factory e escreva o passo em que você está, ou cole o erro. A conversa não volta ao começo.' }
      ]
      var i = 0
      var caixa = document.getElementById('guia')
      var aberto = false
      function limpar() {
        document.querySelectorAll('.guia-alvo').forEach(function (el) { el.classList.remove('guia-alvo') })
      }
      function mostrar(n) {
        i = Math.max(0, Math.min(passos.length - 1, n))
        limpar()
        var passo = passos[i]
        var alvo = document.getElementById(passo.alvo)
        if (alvo) {
          alvo.classList.add('guia-alvo')
          alvo.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        document.getElementById('guia-indice').textContent = (i + 1) + ' de ' + passos.length
        document.getElementById('guia-titulo').textContent = passo.titulo
        document.getElementById('guia-texto').textContent = passo.texto
        document.getElementById('guia-seguir').textContent = i === passos.length - 1 ? 'Concluir' : 'Seguir'
        document.getElementById('guia-voltar').hidden = i === 0
        caixa.hidden = false
        aberto = true
      }
      function fechar() {
        limpar()
        caixa.hidden = true
        aberto = false
        try { localStorage.setItem('sf-guia', 'visto') } catch (e) {}
      }
      document.getElementById('guia-abrir').addEventListener('click', function () { mostrar(0) })
      document.getElementById('guia-seguir').addEventListener('click', function () {
        if (i >= passos.length - 1) fechar()
        else mostrar(i + 1)
      })
      document.getElementById('guia-voltar').addEventListener('click', function () { mostrar(i - 1) })
      document.getElementById('guia-fechar').addEventListener('click', fechar)
      document.querySelector('.guia-velo').addEventListener('click', fechar)
      document.addEventListener('keydown', function (evento) {
        if (!aberto) return
        if (evento.key === 'Escape') fechar()
        if (evento.key === 'ArrowRight') document.getElementById('guia-seguir').click()
        if (evento.key === 'ArrowLeft' && i > 0) mostrar(i - 1)
      })
      var forcar = /(?:\\?|&)guia=1(?:&|$)/.test(location.search)
      var visto = false
      try { visto = localStorage.getItem('sf-guia') === 'visto' } catch (e) {}
      if (forcar || !visto) setTimeout(function () { mostrar(0) }, 500)
    })()
  </script>
  <script>
    // Movimento com Motion (motion.dev). Sem a biblioteca ou com movimento reduzido, a página fica estática e inteira.
    window.addEventListener('DOMContentLoaded', function () {
      var M = window.Motion
      if (!M || !document.documentElement.classList.contains('mov')) return
      var suave = [0.22, 1, 0.36, 1]

      M.inView('[data-revela]', function (entrada) {
        var el = entrada.target
        var irmaos = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0
        M.animate(el, { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0)'] }, { duration: 0.7, delay: Math.min(irmaos, 8) * 0.06, ease: suave })
      }, { margin: '0px 0px -8% 0px' })

      document.querySelectorAll('[data-conta]').forEach(function (el) {
        var alvo = Number(el.getAttribute('data-conta'))
        if (!alvo) return
        el.textContent = '0'
        M.inView(el, function () {
          M.animate(0, alvo, { duration: 1.2, ease: suave, onUpdate: function (v) { el.textContent = String(Math.round(v)) } })
        })
      })

      var verbos = ['Conduza', 'Especifique', 'Planeje', 'Verifique', 'Revise']
      var caixa = document.querySelector('.verbo')
      var txt = document.querySelector('.verbo-txt')
      var v = 0
      if (caixa && txt) setInterval(function () {
        M.animate(txt, { opacity: [1, 0], transform: ['translateY(0)', 'translateY(-0.35em)'] }, { duration: 0.28, ease: 'easeIn' }).then(function () {
          var antes = caixa.offsetWidth
          v = (v + 1) % verbos.length
          txt.textContent = verbos[v]
          var depois = caixa.offsetWidth
          M.animate(caixa, { width: [antes + 'px', depois + 'px'] }, { duration: 0.32, ease: suave }).then(function () { caixa.style.width = '' })
          M.animate(txt, { opacity: [0, 1], transform: ['translateY(0.35em)', 'translateY(0)'] }, { duration: 0.42, ease: suave })
        })
      }, 2600)

      var etapas = [
        { fazendo: 'Triando o card…', feito: '0,012 s' },
        { fazendo: 'Escrevendo a especificação…', feito: '0,041 s' },
        { fazendo: 'Esperando a Joana…', feito: 'liberado por Joana', portao: true },
        { fazendo: 'Conferindo a evidência…', feito: 'NOT_RUN anotado' },
        { fazendo: 'Procurando segredo…', feito: 'sem achado' },
        { fazendo: 'Abrindo o rascunho…', feito: 'sem merge' }
      ]
      var linhas = document.querySelectorAll('[data-etapa]')
      var status = document.getElementById('painel-status')
      var gira = '<span class="gira" aria-hidden="true">✻</span>'
      function marcar(i, estado) {
        var linha = linhas[i]
        var etapa = etapas[i]
        var pequeno = linha.querySelector('small')
        linha.classList.toggle('wait', estado === 'fazendo' && !!etapa.portao)
        linha.classList.toggle('on', estado === 'fazendo' && !etapa.portao)
        if (estado === 'fazendo') {
          pequeno.innerHTML = gira + (etapa.portao ? 'aguardando' : 'agora')
          status.textContent = etapa.fazendo
          M.animate(linha, { opacity: [0.4, 1] }, { duration: 0.4 })
        } else if (estado === 'feito') {
          pequeno.textContent = '✓ ' + etapa.feito
        } else {
          pequeno.textContent = 'ainda não'
        }
      }
      var passo = 0
      var rodando = false
      function seguir() {
        if (passo > 0) marcar(passo - 1, 'feito')
        if (passo === etapas.length) {
          status.textContent = 'Card no portão de release'
          setTimeout(function () { for (var k = 0; k < etapas.length; k++) marcar(k, 'antes'); passo = 0; seguir() }, 3600)
          return
        }
        marcar(passo, 'fazendo')
        var espera = etapas[passo].portao ? 3400 : 1500
        passo++
        setTimeout(seguir, espera)
      }
      if (linhas.length === etapas.length && status) {
        M.inView('#portao', function () {
          if (rodando) return
          rodando = true
          for (var k = 0; k < etapas.length; k++) marcar(k, 'antes')
          seguir()
        })
      }
    })
  </script>
</body>
</html>`
}
