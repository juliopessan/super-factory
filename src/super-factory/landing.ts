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
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <script>
    try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('mov') } catch (e) {}
    setTimeout(function () { if (!window.Motion) document.documentElement.classList.remove('mov') }, 2500)
  </script>
  <script src="/motion.js" defer onerror="document.documentElement.classList.remove('mov')"></script>
  <style>
    /* Design system da Factory: skills/factory-ui/SKILL.md */
    :root {
      --bg: #050505; --frame: #0b0b0b; --card: #141414; --card-2: #1b1b1b;
      --line: #ffffff14; --line-2: #ffffff24;
      --text: #ededed; --muted: #9a9a9a; --faint: #6b6b6b;
      --accent: #f5a25d; --signal: #5ee08a; --violet: #9b7bf2;
      --button: #e8e8e8; --button-text: #0b0b0b; --veil: #000000b3;
      --sans: "Geist", ui-sans-serif, system-ui, sans-serif;
      --mono: "Geist Mono", ui-monospace, monospace;
      --ease: cubic-bezier(.22, 1, .36, 1);
      color-scheme: dark;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f4f4f2; --frame: #e9e9e6; --card: #ffffff; --card-2: #f1f1ee;
        --line: #0000001a; --line-2: #0000002b;
        --text: #111111; --muted: #555555; --faint: #8a8a8a;
        --accent: #b85f12; --signal: #137a3d; --violet: #5b3fc4;
        --button: #111111; --button-text: #f4f4f2; --veil: #0000008c;
        color-scheme: light;
      }
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 15px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    :focus-visible { outline: 2px solid var(--text); outline-offset: 2px; border-radius: 6px; }
    .wrap { width: 100%; max-width: 1232px; margin: 0 auto; padding: 0 16px; }
    h1, h2, h3, h4 { margin: 0; font-weight: 500; }
    .mono { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    .laranja { color: var(--accent); }
    .verde { color: var(--signal); }
    .sub { text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: max(1.5px, .04em); text-underline-offset: .14em; text-decoration-skip-ink: none; }
    .gira { display: inline-block; color: var(--accent); line-height: 1; animation: gira 1.6s linear infinite; }
    @keyframes gira { to { transform: rotate(360deg); } }

    /* topo */
    .top { position: sticky; top: 0; z-index: 10; background: var(--bg); border-bottom: 1px solid var(--line); }
    .top-inner { display: flex; align-items: center; gap: 28px; min-height: 60px; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 500; font-size: 17px; letter-spacing: -.02em; }
    .mark { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: #ff8c00; color: #1a1a1a; font-family: var(--mono); font-size: 11px; font-weight: 500; }
    nav { display: flex; gap: 24px; }
    nav a { color: var(--muted); font-size: 14px; display: inline-flex; align-items: center; gap: 8px; }
    nav a::before { content: ""; width: 4px; height: 4px; border-radius: 9px; background: var(--faint); }
    nav a:hover { color: var(--text); }
    .nav-cta { margin-left: auto; display: flex; align-items: center; gap: 14px; }
    .nav-cta .link { color: var(--muted); font-size: 14px; background: none; border: 0; cursor: pointer; font-family: inherit; }
    .nav-cta .link:hover { color: var(--text); }
    .pilula { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--card); color: var(--text); font-size: 14px; font-family: inherit; cursor: pointer; transition: border-color .15s var(--ease); }
    .pilula:hover { border-color: var(--text); }
    .aba { display: inline-flex; align-items: center; gap: 10px; margin-left: clamp(0px, 4vw, 48px); padding: 10px 24px 12px; border-radius: 0 0 20px 20px; background: var(--card); border: 1px solid var(--line); border-top: 0; font-size: 14px; color: var(--muted); }
    .aba b { font-weight: 400; color: var(--text); }
    .aba i { width: 3px; height: 3px; border-radius: 9px; background: var(--faint); }

    /* hero */
    .hero { text-align: center; padding: 8px 0 120px; }
    .rede { display: block; width: min(760px, 100%); height: auto; margin: 0 auto; }
    .rede .no { fill: none; stroke: var(--line-2); stroke-width: 1.2; }
    .rede .fio { fill: none; stroke: var(--line-2); stroke-width: 1.2; }
    .rede .fluxo { fill: none; stroke: var(--accent); stroke-width: 1.4; stroke-dasharray: 10 300; animation: flui 4.8s linear infinite; opacity: .8; }
    .rede .ic { fill: none; stroke: var(--faint); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
    @keyframes flui { from { stroke-dashoffset: 310; } to { stroke-dashoffset: 0; } }
    .rotulo-hero { margin: 8px 0 18px; font-size: 14px; font-weight: 500; }
    .hero h1 { font-size: clamp(2.4rem, 1rem + 4.4vw, 4.75rem); line-height: 1.05; letter-spacing: -.035em; margin: 0 auto; }
    .hero h1 .linha { display: block; }
    .verbo { display: inline-block; white-space: nowrap; vertical-align: bottom; overflow: hidden; padding-bottom: .1em; margin-bottom: -.1em; }
    .verbo-txt { display: inline-block; }
    .hero .lead { margin: 22px auto 0; max-width: 54ch; color: var(--muted); font-size: clamp(1.05rem, .95rem + .4vw, 1.3rem); }
    .acoes { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 12px 28px; margin-top: 36px; }
    .primario { display: inline-flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 22px; border-radius: 999px; background: var(--button); color: var(--button-text); font-size: 15px; font-weight: 500; transition: transform .15s var(--ease); }
    .primario:hover { transform: translateY(-1px); }
    .primario .gira { color: inherit; opacity: .7; }
    .seta { color: var(--muted); font-size: 15px; }
    .seta:hover { color: var(--text); }

    /* seções */
    section { padding: 120px 0 0; }
    .cabeca { text-align: center; margin: 0 auto 64px; max-width: 760px; }
    .cabeca h2 { font-size: clamp(2.25rem, 1.2rem + 2.6vw, 3.6rem); line-height: 1.05; letter-spacing: -.035em; }
    .cabeca p { margin: 16px auto 0; color: var(--muted); font-size: clamp(1.05rem, .95rem + .4vw, 1.3rem); max-width: 58ch; }
    .moldura { background: var(--frame); border-radius: 40px; padding: 10px; }
    .card { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 28px; padding: 36px; overflow: hidden; min-width: 0; }
    .card.grao::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .05; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    .card.brilho::before { content: ""; position: absolute; inset: -20% -10% auto auto; width: 60%; height: 80%; pointer-events: none; background: radial-gradient(closest-side, #ffffff0d, transparent); }
    .card h3 { font-size: 16px; }
    .card > p, .card .desc { margin: 4px 0 0; color: var(--muted); max-width: 40ch; }
    .grade { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
    .grade.dois { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grade .card { min-height: 360px; display: flex; flex-direction: column; }
    .mini { margin-top: auto; padding-top: 28px; }

    /* mini-interfaces */
    .pilhas { display: grid; justify-items: center; gap: 10px; }
    .pilhas span { display: flex; align-items: center; gap: 10px; padding: 9px 18px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--card-2); font-size: 15px; }
    .pilhas span:nth-child(2) { opacity: .65; font-size: 14px; }
    .pilhas span:nth-child(3) { opacity: .3; font-size: 13px; }
    .anel { width: 12px; height: 12px; border-radius: 99px; border: 2px solid var(--text); flex: none; }
    .arvore { font-family: var(--mono); font-size: 12px; letter-spacing: .06em; display: grid; gap: 10px; padding-left: 8px; }
    .arvore div { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); }
    .arvore div b { font-weight: 400; color: var(--accent); }
    .arvore div:nth-child(n + 4) { opacity: .45; }
    .dialogo { margin: 0 auto; max-width: 300px; padding: 18px; border-radius: 16px; background: var(--card-2); border: 1px solid var(--line); }
    .dialogo p { margin: 0 0 16px; font-size: 13px; color: var(--text); display: flex; gap: 10px; }
    .dialogo .botoes { display: flex; gap: 8px; }
    .dialogo button { font: inherit; font-size: 12px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--muted); cursor: default; }
    .dialogo button.sim { color: var(--signal); border-color: color-mix(in srgb, var(--signal) 40%, transparent); }
    .tracejado { position: relative; border: 1px dashed var(--accent); border-radius: 14px; padding: 26px 14px 14px; display: grid; gap: 8px; }
    .tracejado > .mono { position: absolute; top: -10px; left: 14px; padding: 2px 8px; background: var(--card); color: var(--accent); }
    .tracejado code { font-family: var(--mono); font-size: 12px; color: var(--muted); background: var(--card-2); border-radius: 8px; padding: 7px 10px; overflow-wrap: anywhere; }
    .tracejado code b { font-weight: 400; color: var(--accent); }
    .progresso { display: grid; gap: 12px; }
    .barra { height: 28px; border-radius: 8px; border: 1px solid var(--line-2); display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-family: var(--mono); font-size: 12px; color: var(--muted); background: linear-gradient(90deg, color-mix(in srgb, var(--signal) 22%, transparent) var(--p, 80%), transparent 0); }
    .barra b { font-weight: 400; color: var(--signal); }
    .linhas-check { display: grid; gap: 6px; font-family: var(--mono); font-size: 12px; }
    .linhas-check div { display: flex; justify-content: space-between; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; color: var(--muted); }
    .linhas-check .ok { color: var(--signal); }
    .linhas-check .nr { color: var(--accent); }
    .provedores { display: grid; gap: 8px; }
    .provedores div { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 12px; background: var(--card-2); border: 1px solid var(--line); font-size: 14px; }
    .provedores small { font-family: var(--mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--faint); }

    /* diagrama */
    .card.destaque { padding: 40px; min-height: 520px; }
    .rolagem { overflow-x: auto; margin: 32px -8px 0; padding: 0 8px 8px; }
    .diagrama { display: block; width: 100%; min-width: 760px; height: auto; }
    .diagrama .trilho { fill: none; stroke: var(--card-2); stroke-width: 7; stroke-linecap: round; }
    .diagrama .corre { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 18 400; animation: corre 3.2s linear infinite; }
    @keyframes corre { from { stroke-dashoffset: 418; } to { stroke-dashoffset: 0; } }
    .diagrama .miolo { fill: var(--card-2); }
    .diagrama .borda { fill: none; stroke: var(--line-2); stroke-width: 2.5; stroke-linecap: round; }
    .diagrama .ic { fill: none; stroke: var(--text); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: .8; }
    .diagrama text { font-family: var(--mono); font-size: 13px; letter-spacing: .08em; fill: var(--accent); }
    .diagrama text.apagado { fill: var(--faint); }

    /* suspende, código */
    .suspende { margin: 40px auto 0; max-width: 360px; padding: 18px 20px; border-radius: 16px; background: var(--card-2); border: 1px solid var(--line); text-align: left; }
    .suspende .linha { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .suspende .linha b { font-weight: 500; display: flex; align-items: center; gap: 10px; }
    .suspende small { color: var(--muted); }
    .suspende .linha + p { margin: 6px 0 18px; color: var(--muted); font-size: 14px; }
    .suspende .pills { display: flex; gap: 8px; flex-wrap: wrap; }
    .suspende .pills span { padding: 5px 14px; border-radius: 999px; border: 1px solid var(--line-2); font-size: 13px; color: var(--muted); }
    pre { margin: 0; padding: 18px; border-radius: 16px; background: var(--card-2); border: 1px solid var(--line); font-family: var(--mono); font-size: 13px; line-height: 1.7; color: var(--muted); overflow-x: auto; }
    pre .k { color: var(--accent); }
    pre .s { color: var(--signal); }
    .chamadas { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; }
    .chamada { display: grid; justify-items: center; gap: 12px; }
    .chamada code { font-family: var(--mono); font-size: 12px; color: var(--accent); background: var(--card-2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; }
    .chamada svg { width: 96px; height: 96px; }

    /* quadro */
    .colunas { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }
    .coluna { border: 1px solid var(--line); border-radius: 16px; padding: 14px 12px; min-height: 150px; background: var(--card-2); min-width: 0; }
    .coluna .mono { color: var(--faint); font-size: 11px; }
    .coluna .cartao { margin-top: 14px; padding: 10px; border-radius: 10px; background: var(--card); border: 1px solid var(--line-2); font-size: 12px; color: var(--muted); }
    .coluna.pronto .mono { color: var(--signal); }
    .coluna.parado .mono { color: var(--accent); }
    .coluna.parado .cartao { border-style: dashed; border-color: var(--accent); }

    /* trilha */
    .trilha-grade { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 16px; }
    .pilha-cards { display: grid; gap: 16px; }
    .pilha-cards .card { padding: 32px; }
    .trace { margin-top: 32px; margin-right: -37px; border: 1px solid var(--line); border-right: 0; border-radius: 16px 0 0 16px; background: var(--card-2); overflow: hidden; }
    .trace-topo { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-bottom: 1px solid var(--line); font-size: 15px; }
    .trace-topo small { color: var(--faint); font-family: var(--mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .passo { display: grid; grid-template-columns: minmax(0, 1fr) 40% 64px; gap: 14px; align-items: center; padding: 11px 22px; font-size: 14px; }
    .passo .nome { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .passo[data-n="1"] .nome { padding-left: 22px; } .passo[data-n="2"] .nome { padding-left: 44px; color: var(--muted); }
    .passo .trilho { height: 12px; border-radius: 99px; background: var(--card); overflow: hidden; }
    .passo .trilho i { display: block; height: 100%; border-radius: 99px; width: var(--w); transform-origin: left; }
    .passo .t { font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: right; }
    .verde-b { background: var(--signal); } .violeta-b { background: var(--violet); } .laranja-b { background: var(--accent); }

    /* limites e instalar */
    .lados { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .lados > div { padding: 8px 32px; min-width: 0; }
    .lados > div + div { border-left: 1px solid var(--line); }
    .lados h3 { font-size: 20px; margin-bottom: 18px; }
    .lados ul { list-style: none; margin: 0; padding: 0; }
    .lados li { padding: 14px 0; border-top: 1px solid var(--line); color: var(--muted); display: flex; gap: 12px; }
    .lados li b { font-weight: 400; color: var(--signal); font-family: var(--mono); }
    .lados > div + div li b { color: var(--accent); }
    .passos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .passo-card { padding: 28px; border-radius: 28px; background: var(--card); border: 1px solid var(--line); min-width: 0; }
    .passo-card .mono { color: var(--accent); }
    .passo-card h3 { margin: 14px 0 6px; font-size: 18px; }
    .passo-card p { margin: 0; color: var(--muted); }
    .passo-card.opcional .mono { color: var(--faint); }
    code.c { font-family: var(--mono); font-size: .9em; color: var(--text); background: var(--card-2); border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; overflow-wrap: anywhere; }
    .fim { text-align: center; padding: 140px 0 120px; }
    .fim h2 { font-size: clamp(2.25rem, 1.2rem + 2.6vw, 3.6rem); letter-spacing: -.035em; line-height: 1.05; }
    .fim p { color: var(--muted); margin: 16px 0 0; }
    footer { border-top: 1px solid var(--line); padding: 32px 0 40px; color: var(--muted); font-size: 14px; }
    .foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .foot a:hover { color: var(--text); }

    .mov [data-revela] { opacity: 0; }

    /* guia */
    .guia-alvo { position: relative; z-index: 40; outline: 2px solid var(--accent); outline-offset: 6px; border-radius: 28px; }
    .guia-velo { position: fixed; inset: 0; z-index: 30; background: var(--veil); }
    .guia-painel { position: fixed; z-index: 50; left: 50%; bottom: 20px; transform: translateX(-50%); width: min(560px, calc(100% - 24px)); background: var(--card); color: var(--text); border: 1px solid var(--line-2); border-radius: 24px; padding: 22px; }
    .guia-painel[hidden], #guia[hidden] { display: none; }
    .guia-kicker { margin: 0 0 8px; font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
    .guia-painel h2 { margin: 0 0 8px; font-size: 22px; letter-spacing: -.02em; }
    .guia-painel p { margin: 0; color: var(--muted); }
    .guia-acoes { display: flex; gap: 8px; margin-top: 16px; }
    .guia-acoes button { min-height: 38px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text); cursor: pointer; font: inherit; font-size: 14px; }
    .guia-acoes .solid { background: var(--button); color: var(--button-text); border-color: transparent; }

    @media (max-width: 1080px) {
      nav { display: none; }
      .grade { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .trilha-grade { grid-template-columns: 1fr; }
      .colunas { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .passos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 760px) {
      section { padding-top: 72px; }
      .cabeca { margin-bottom: 40px; }
      .grade, .grade.dois, .passos, .lados { grid-template-columns: 1fr; }
      .lados > div { padding: 8px 0; }
      .lados > div + div { border-left: 0; margin-top: 24px; }
      .card, .card.destaque { padding: 24px; }
      .moldura { border-radius: 32px; padding: 6px; }
      .colunas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grade .card { min-height: 0; }
      .trace { margin-right: -25px; }
      .passo { grid-template-columns: minmax(0, 1fr) 30% 56px; padding: 10px 14px; }
      .passo[data-n="1"] .nome { padding-left: 12px; } .passo[data-n="2"] .nome { padding-left: 24px; }
      .aba { margin-left: 0; padding: 8px 16px 10px; font-size: 13px; }
      .aba .longo { display: none; }
      .hero { padding-bottom: 72px; }
    }
    @media (max-width: 480px) {
      .brand span.nome { display: none; }
      .nav-cta .link { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .gira, .rede .fluxo, .diagrama .corre { animation: none; }
      .rede .fluxo, .diagrama .corre { display: none; }
      .mov [data-revela] { opacity: 1; }
    }
  </style>
</head>
<body>
  <header class="top">
    <div class="wrap top-inner">
      <a class="brand" href="/"><span class="mark" aria-hidden="true">SF</span><span class="nome">Super Factory</span></a>
      <nav aria-label="Seções">
        <a href="#papeis">Papéis</a>
        <a href="#ciclo">Ciclo</a>
        <a href="#quadro">Quadro</a>
        <a href="#limites">Limites</a>
        <a href="#instalar">Instalar</a>
      </nav>
      <div class="nav-cta">
        <a class="link" href="https://github.com/juliopessan/super-factory">GitHub</a>
        <button class="link" type="button" id="guia-abrir">Guia-me</button>
        <a class="pilula" href="/studio" id="factory-cta">Abrir a Factory</a>
      </div>
    </div>
  </header>
  <div class="wrap"><a class="aba" href="#instalar"><span class="longo">Guia de instalação</span><i class="longo" aria-hidden="true"></i><b>7 passos até o gate</b> →</a></div>
  <main>
    <div class="wrap hero">
      <svg class="rede" viewBox="0 0 760 300" role="img" aria-label="Os papéis da Factory ligados ao gate no centro">
<defs><radialGradient id="orbe" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#9a9a9a"/><stop offset=".45" stop-color="#3a3a3a"/><stop offset="1" stop-color="#0c0c0c"/></radialGradient><radialGradient id="halo" r=".5"><stop offset=".6" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient><linearGradient id="some" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="mascara"><rect width="100%" height="100%" fill="url(#some)"/></mask></defs>
<g mask="url(#mascara)">
<path class="fio" d="M120 70 Q270 45 380 150"/>
<path class="fio" d="M205 150 Q292 106 380 150"/>
<path class="fio" d="M110 230 Q225 122 380 150"/>
<path class="fio" d="M260 60 Q342 75 380 150"/>
<path class="fio" d="M285 245 Q309 174 380 150"/>
<path class="fio" d="M470 55 Q449 125 380 150"/>
<path class="fio" d="M560 140 Q472 190 380 150"/>
<path class="fio" d="M640 70 Q530 175 380 150"/>
<path class="fio" d="M655 225 Q499 256 380 150"/>
<path class="fio" d="M520 250 Q425 235 380 150"/>
<path class="fio" d="M40 150 Q128 50 260 60"/>
<path class="fio" d="M720 150 Q526 306 285 245"/>
<path class="fio" d="M330 20 Q409 2 470 55"/>
<path class="fio" d="M430 280 Q460 178 560 140"/>
<path class="fio" d="M170 15 Q419 -75 640 70"/>
<path class="fio" d="M600 15 Q680 106 655 225"/>
<path class="fluxo" d="M120 70 Q270 45 380 150"/>
<path class="fluxo" d="M205 150 Q292 106 380 150"/>
<path class="fluxo" d="M110 230 Q225 122 380 150"/>
<path class="fluxo" d="M260 60 Q342 75 380 150"/>
<path class="fluxo" d="M285 245 Q309 174 380 150"/>
<path class="fluxo" d="M470 55 Q449 125 380 150"/>
<circle cx="120" cy="70" r="24" fill="var(--bg)"/><circle class="no" cx="120" cy="70" r="24"/>
<path class="ic" transform="translate(112.56 62.56) scale(0.62)" d="M3 7h6l2 2h10v10H3z"/>
<circle cx="205" cy="150" r="30" fill="var(--bg)"/><circle class="no" cx="205" cy="150" r="30"/>
<path class="ic" transform="translate(197.56 142.56) scale(0.62)" d="M4 5h16l-6 7v6l-4 2v-8z"/>
<circle cx="110" cy="230" r="22" fill="var(--bg)"/><circle class="no" cx="110" cy="230" r="22"/>
<path class="ic" transform="translate(102.56 222.56) scale(0.62)" d="M4 5h16v11H9l-5 4z"/>
<circle cx="260" cy="60" r="20" fill="var(--bg)"/><circle class="no" cx="260" cy="60" r="20"/>
<circle cx="285" cy="245" r="26" fill="var(--bg)"/><circle class="no" cx="285" cy="245" r="26"/>
<path class="ic" transform="translate(277.56 237.56) scale(0.62)" d="M7 3h7l4 4v14H7z M14 3v4h4"/>
<circle cx="470" cy="55" r="22" fill="var(--bg)"/><circle class="no" cx="470" cy="55" r="22"/>
<path class="ic" transform="translate(462.56 47.56) scale(0.62)" d="M12 3l9 5-9 5-9-5z M3 13l9 5 9-5"/>
<circle cx="560" cy="140" r="30" fill="var(--bg)"/><circle class="no" cx="560" cy="140" r="30"/>
<path class="ic" transform="translate(552.56 132.56) scale(0.62)" d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>
<circle cx="640" cy="70" r="20" fill="var(--bg)"/><circle class="no" cx="640" cy="70" r="20"/>
<circle cx="655" cy="225" r="24" fill="var(--bg)"/><circle class="no" cx="655" cy="225" r="24"/>
<path class="ic" transform="translate(647.56 217.56) scale(0.62)" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
<circle cx="520" cy="250" r="22" fill="var(--bg)"/><circle class="no" cx="520" cy="250" r="22"/>
<path class="ic" transform="translate(512.56 242.56) scale(0.62)" d="M4 19V5 M4 19h16 M8 15l3-4 3 2 5-6"/>
<circle cx="40" cy="150" r="18" fill="var(--bg)"/><circle class="no" cx="40" cy="150" r="18"/>
<circle cx="720" cy="150" r="18" fill="var(--bg)"/><circle class="no" cx="720" cy="150" r="18"/>
<circle cx="330" cy="20" r="14" fill="var(--bg)"/><circle class="no" cx="330" cy="20" r="14"/>
<circle cx="430" cy="280" r="14" fill="var(--bg)"/><circle class="no" cx="430" cy="280" r="14"/>
<circle cx="170" cy="15" r="12" fill="var(--bg)"/><circle class="no" cx="170" cy="15" r="12"/>
<circle cx="600" cy="15" r="12" fill="var(--bg)"/><circle class="no" cx="600" cy="15" r="12"/>
</g>
<circle cx="380" cy="150" r="92" fill="url(#halo)"/>
<circle cx="380" cy="150" r="58" fill="url(#orbe)" stroke="#ffffff22"/>
<g fill="none" stroke="#f0f0f0" stroke-width="3.2" stroke-linecap="round" opacity=".92"><path d="M360 172V138 M400 172V138 M353 136H407"/></g>
<text x="380" y="165" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="15" font-weight="500" fill="#f0f0f0">SF</text>
</svg>
      <p class="rotulo-hero">Super Factory</p>
      <h1 aria-label="Conduza o pedido. Pare no gate."><span class="linha" aria-hidden="true"><span class="verbo"><span class="verbo-txt">Conduza</span></span> o pedido.</span> <span class="linha" aria-hidden="true">Pare no <span class="sub">gate</span>.</span></h1>
      <p class="lead">Cada pedido vira um card e atravessa seis estágios. Em três momentos, ele só segue quando uma pessoa libera.</p>
      <div class="acoes">
        <a class="primario" href="/studio">Abrir a Factory <span class="gira" aria-hidden="true">✻</span></a>
        <a class="seta" href="#instalar">Instalar ↗</a>
      </div>
    </div>

    <section id="papeis">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Papéis</h2>
          <p>Oito agentes com um lugar para escrever, ou só para ler. Nenhum deles aprova gate.</p>
        </div>
        <div class="moldura" data-revela>
          <div class="card destaque grao brilho" id="portao">
            <h3>Três pausas com nome de gente</h3>
            <p class="desc">O ciclo suspende antes da implementação, do merge e do release. Só segue com aprovado, aprovador e nota.</p>
            <div class="rolagem"><svg class="diagrama" viewBox="0 0 1080 340" role="img" aria-label="Ciclo sdlc: triagem, especificação, gate, verificação, gate, entrega e gate. Pedido com segredo vai para blocked.">
<path class="trilho" d="M90 230 C150 230 170 120 250 120 H1000"/><path class="trilho" d="M90 230 C150 230 170 290 250 290"/>
<path class="corre" d="M90 230 C150 230 170 120 250 120 H1000"/>
<g><circle class="miolo" cx="90" cy="230" r="27"/><path class="borda" d="M60.9 205.6 A38 38 0 0 1 103.0 194.3"/><path class="borda" d="M119.1 254.4 A38 38 0 0 1 77.0 265.7"/><path class="ic" transform="translate(79.2 219.2) scale(0.9)" d="M4 5h16l-6 7v6l-4 2v-8z"/><text x="90" y="292" text-anchor="middle" class="">TRIAGEM</text></g>
<g><circle class="miolo" cx="250" cy="120" r="27"/><path class="borda" d="M220.9 95.6 A38 38 0 0 1 263.0 84.3"/><path class="borda" d="M279.1 144.4 A38 38 0 0 1 237.0 155.7"/><path class="ic" transform="translate(239.2 109.2) scale(0.9)" d="M7 3h7l4 4v14H7z M14 3v4h4"/><text x="250" y="182" text-anchor="middle" class="">ESPECIFICAÇÃO</text></g>
<g><circle class="miolo" cx="400" cy="120" r="27"/><path class="borda" d="M370.9 95.6 A38 38 0 0 1 413.0 84.3"/><path class="borda" d="M429.1 144.4 A38 38 0 0 1 387.0 155.7"/><path class="ic" transform="translate(389.2 109.2) scale(0.9)" d="M8 13V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 13a1.5 1.5 0 0 1 2.4-1.8L8 14"/><text x="400" y="182" text-anchor="middle" class="">GATE 1</text></g>
<g><circle class="miolo" cx="550" cy="120" r="27"/><path class="borda" d="M520.9 95.6 A38 38 0 0 1 563.0 84.3"/><path class="borda" d="M579.1 144.4 A38 38 0 0 1 537.0 155.7"/><path class="ic" transform="translate(539.2 109.2) scale(0.9)" d="M5 12.5l4.5 4.5L19 7.5"/><text x="550" y="182" text-anchor="middle" class="">VERIFICAÇÃO</text></g>
<g><circle class="miolo" cx="700" cy="120" r="27"/><path class="borda" d="M670.9 95.6 A38 38 0 0 1 713.0 84.3"/><path class="borda" d="M729.1 144.4 A38 38 0 0 1 687.0 155.7"/><path class="ic" transform="translate(689.2 109.2) scale(0.9)" d="M8 13V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 13a1.5 1.5 0 0 1 2.4-1.8L8 14"/><text x="700" y="182" text-anchor="middle" class="">GATE 2</text></g>
<g><circle class="miolo" cx="850" cy="120" r="27"/><path class="borda" d="M820.9 95.6 A38 38 0 0 1 863.0 84.3"/><path class="borda" d="M879.1 144.4 A38 38 0 0 1 837.0 155.7"/><path class="ic" transform="translate(839.2 109.2) scale(0.9)" d="M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9c0 6-12 3-12 9"/><text x="850" y="182" text-anchor="middle" class="">ENTREGA</text></g>
<g><circle class="miolo" cx="1000" cy="120" r="27"/><path class="borda" d="M970.9 95.6 A38 38 0 0 1 1013.0 84.3"/><path class="borda" d="M1029.1 144.4 A38 38 0 0 1 987.0 155.7"/><path class="ic" transform="translate(989.2 109.2) scale(0.9)" d="M8 13V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 13a1.5 1.5 0 0 1 2.4-1.8L8 14"/><text x="1000" y="182" text-anchor="middle" class="">GATE 3</text></g>
<g><circle class="miolo" cx="250" cy="290" r="27"/><path class="borda" d="M220.9 265.6 A38 38 0 0 1 263.0 254.3"/><path class="borda" d="M279.1 314.4 A38 38 0 0 1 237.0 325.7"/><path class="ic" transform="translate(239.2 279.2) scale(0.9)" d="M7 7l10 10M17 7L7 17"/><text x="250" y="290" dx="96" dominant-baseline="middle" text-anchor="middle" class="apagado">BLOCKED</text></g>
</svg></div>
          </div>
        </div>
        <div class="grade">
          <article class="card" data-revela>
            <h3>Chief of Staff</h3>
            <p class="desc">Único papel que abre card. Encaminha o pedido pelo workflow sdlc.</p>
            <div class="mini pilhas"><span><i class="anel"></i>C-14 Filtro de datas</span><span><i class="anel"></i>C-15 Upload de recibo</span><span><i class="anel"></i>C-16 Exportar CSV</span></div>
          </article>
          <article class="card" data-revela>
            <h3>Architect</h3>
            <p class="desc">Separa donos e caminhos. Se duas fatias cobrem o mesmo lugar, o card para.</p>
            <div class="mini arvore"><div>src/ui/ <b>FRONTEND</b></div><div>src/api/ <b>BACKEND</b></div><div>src/integrations/ <b>INTEGRATIONS</b></div><div>docs/ <b>DOCS</b></div></div>
          </article>
          <article class="card" data-revela>
            <h3>Gate humano</h3>
            <p class="desc">Nenhum agente libera. Uma pessoa lê o card e decide, com o nome dela.</p>
            <div class="mini"><div class="dialogo"><p><span aria-hidden="true">✋</span>O card C-14 quer seguir para o merge. Liberar o acompanhamento?</p><div class="botoes"><button type="button" class="sim" tabindex="-1">Liberar</button><button type="button" tabindex="-1">Recusar</button></div></div></div>
          </article>
          <article class="card" data-revela>
            <h3>Security</h3>
            <p class="desc">Somente leitura. Procura segredo, push protegido e gate furado.</p>
            <div class="mini"><div class="tracejado"><span class="mono">factory.db</span><code>descricao: "use o token <b>[segredo:token-github]</b>"</code><code>coluna: <b>blocked</b></code></div></div>
          </article>
          <article class="card" data-revela>
            <h3>QA</h3>
            <p class="desc">Lê a evidência. Não transforma NOT_RUN em PASS.</p>
            <div class="mini progresso"><div class="barra" style="--p: 80%"><span>EVIDÊNCIA</span><b>4 / 5</b></div><div class="linhas-check"><div>critérios-de-aceite <span class="ok">PASS</span></div><div>varredura-de-segredos <span class="ok">PASS</span></div><div>testes-do-produto <span class="nr">NOT_RUN</span></div></div></div>
          </article>
          <article class="card" data-revela>
            <h3>Integrations</h3>
            <p class="desc">Abre issue ou work item. Sem credencial, diz que é simulado.</p>
            <div class="mini provedores"><div>GitHub <small>issue · rascunho</small></div><div>Azure DevOps <small>work item</small></div><div>Merge <small class="laranja">não existe</small></div></div>
          </article>
        </div>
        <p class="cabeca" style="margin: 28px auto 0; font-size: 15px; color: var(--muted)">Frontend, Backend e Docs completam os oito: cada um escreve só no próprio caminho.</p>
      </div>
    </section>

    <section id="ciclo">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Ciclo</h2>
          <p>O workflow sdlc conduz o card da triagem ao release e guarda cada passo. Ele suspende, espera e retoma.</p>
        </div>
        <div class="grade dois">
          <article class="card grao" data-revela>
            <h3>Suspende no gate</h3>
            <p class="desc">Cada gate vira uma pausa de verdade no workflow. O estado fica salvo até a pessoa voltar.</p>
            <div class="mini"><div class="suspende"><div class="linha"><b><span class="gira" aria-hidden="true">✻</span>Gate · beforeMerge</b><small>41 ms</small></div><p>C-14 · Filtro de datas com hora</p><div class="pills"><span>Entrada</span><span>Saída</span><span>Trilha</span></div></div></div>
          </article>
          <article class="card grao" data-revela>
            <h3>Retoma com nome</h3>
            <p class="desc">A retomada pede três campos. Recusar fecha o card bloqueado, ou retido no release.</p>
            <div class="mini"><pre aria-label="Exemplo de retomada">{
  <span class="k">"aprovado"</span>: <span class="s">true</span>,
  <span class="k">"aprovador"</span>: <span class="s">"Joana"</span>,
  <span class="k">"nota"</span>: <span class="s">"Pode seguir, sem merge."</span>
}</pre></div>
          </article>
          <article class="card grao" data-revela>
            <h3>Nada de segredo no disco</h3>
            <p class="desc">O token colado no pedido vira marcador antes de qualquer gravação. A triagem ainda bloqueia o card.</p>
            <div class="mini"><div class="tracejado"><span class="mono">workflow_snapshots</span><code>input.descricao → <b>[segredo:token-github]</b></code><code>trilha → Padrão de segredo. O valor não foi copiado.</code></div></div>
          </article>
          <article class="card grao" data-revela>
            <h3>GitHub e Azure DevOps</h3>
            <p class="desc">Com credencial, a chamada é real. O pull request sai em rascunho, e não há endpoint de merge.</p>
            <div class="mini chamadas"><div class="chamada"><code>criarIssueGithub()</code><svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="30" fill="var(--card-2)"/><path d="M18 30 A36 36 0 0 1 40 13" fill="none" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/><path d="M78 66 A36 36 0 0 1 56 83" fill="none" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/><path transform="translate(36 36)" d="M7 3h7l4 4v14H7z M14 3v4h4" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="chamada"><code>criarRascunhoGithub()</code><svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="30" fill="var(--card-2)"/><path d="M18 30 A36 36 0 0 1 40 13" fill="none" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/><path d="M78 66 A36 36 0 0 1 56 83" fill="none" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/><path transform="translate(36 36)" d="M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9c0 6-12 3-12 9" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          </article>
        </div>
      </div>
    </section>

    <section id="quadro">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Quadro</h2>
          <p>Pedido claro entra em ready. Pedido vago, segredo ou force-push vai para blocked. Cada onda leva no máximo 5 cards.</p>
        </div>
        <div class="moldura" data-revela>
          <div class="card grao">
            <div class="colunas" aria-label="Colunas do quadro">
              <div class="coluna"><span class="mono">backlog</span><div class="cartao">C-16 Exportar CSV</div></div>
              <div class="coluna pronto"><span class="mono">ready</span><div class="cartao">C-14 Filtro de datas</div></div>
              <div class="coluna"><span class="mono">build</span></div>
              <div class="coluna"><span class="mono">qa</span></div>
              <div class="coluna"><span class="mono">review</span></div>
              <div class="coluna parado"><span class="mono">blocked</span><div class="cartao">C-15 com token</div></div>
              <div class="coluna"><span class="mono">done</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="trilha">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Trilha</h2>
          <p>Cada passo deixa registro, com tempo, entrada e saída. O relatório fecha com o que foi observado e o que ficou de fora.</p>
        </div>
        <div class="trilha-grade">
          <div class="pilha-cards">
            <article class="card" data-revela><h3>Siga cada passo</h3><p class="desc">Veja onde o card parou, quem estava com ele e por quê.</p></article>
            <article class="card" data-revela><h3>Base do projeto</h3><p class="desc">As regras que uma pessoa do cliente ditou, com o nome dela como autora.</p></article>
            <article class="card" data-revela><h3>Avalie o ciclo</h3><p class="desc">Evidência honesta, gates humanos e relatório completo viram notas no Studio.</p></article>
          </div>
          <article class="card grao brilho" data-revela>
            <h3>Trilha do card</h3>
            <p class="desc">Do pedido ao gate, cada linha é uma observação. Nenhuma é um PASS inventado.</p>
            <div class="trace" role="table" aria-label="Trilha do card C-14">
              <div class="trace-topo"><span aria-hidden="true">≡</span>Trilha <small>R-3 · C-14 Filtro de datas com hora</small></div>
              <div class="passo" data-n="0" role="row"><span class="nome">card: C-14</span><span class="trilho"><i class="verde-b" style="--w: 92%"></i></span><span class="t">4,212 s</span></div>
              <div class="passo" data-n="1" role="row"><span class="nome">triagem</span><span class="trilho"><i class="verde-b" style="--w: 6%"></i></span><span class="t">0,012 s</span></div>
              <div class="passo" data-n="1" role="row"><span class="nome">especificação</span><span class="trilho"><i class="violeta-b" style="--w: 18%"></i></span><span class="t">0,041 s</span></div>
              <div class="passo" data-n="1" role="row"><span class="nome">gate: beforeImplementation</span><span class="trilho"><i class="laranja-b" style="--w: 64%"></i></span><span class="t">Joana</span></div>
              <div class="passo" data-n="2" role="row"><span class="nome">check: testes-do-produto</span><span class="trilho"><i class="laranja-b" style="--w: 3%"></i></span><span class="t">NOT_RUN</span></div>
              <div class="passo" data-n="1" role="row"><span class="nome">revisão: security</span><span class="trilho"><i class="violeta-b" style="--w: 22%"></i></span><span class="t">0,388 s</span></div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="limites">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Limites</h2>
          <p>O agente prepara. Uma pessoa decide. O que tem consequência fora do card continua com quem opera o repositório.</p>
        </div>
        <div class="moldura" data-revela>
          <div class="card grao lados">
            <div>
              <h3>A Factory faz</h3>
              <ul>
                <li><b>✓</b>Triagem, especificação e plano do card</li>
                <li><b>✓</b>Checks internos, com evidência do que observou</li>
                <li><b>✓</b>Issue ou work item no provedor</li>
                <li><b>✓</b>Pull request em rascunho, quando a branch existe</li>
              </ul>
            </div>
            <div>
              <h3>Fica com uma pessoa</h3>
              <ul>
                <li><b>✋</b>Merge: a branch protegida não recebe push</li>
                <li><b>✋</b>Deploy: o release não publica nada</li>
                <li><b>✋</b>Force-push e commit direto em main</li>
                <li><b>✋</b>Rodar a suíte do produto e anexar o resultado</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="instalar">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Instalar</h2>
          <p>Um passo de cada vez. Se o Terminal mostrar uma linha vermelha, cole no chat da Factory e a conversa continua dali. Não cole chave, token ou senha.</p>
        </div>
        <div class="passos">
          <article class="passo-card" id="passo-1" data-revela><span class="mono">Passo 1</span><h3>Node</h3><p>Baixe a versão 22 em nodejs.org. No Terminal, <code class="c">node -v</code> precisa mostrar v22.18 ou mais.</p></article>
          <article class="passo-card" id="passo-2" data-revela><span class="mono">Passo 2</span><h3>Terminal</h3><p>No Mac, Command + espaço e escreva Terminal. No Windows, procure PowerShell no Iniciar.</p></article>
          <article class="passo-card" id="passo-3" data-revela><span class="mono">Passo 3</span><h3>Projeto</h3><p>Na primeira vez, clone <code class="c">github.com/juliopessan/super-factory</code>. Se a pasta já existe, atualize a branch <code class="c">main</code>.</p></article>
          <article class="passo-card" id="passo-4" data-revela><span class="mono">Passo 4</span><h3>Peças</h3><p>Dentro da pasta, <code class="c">npm install</code>. Espere a linha <code class="c">added packages</code>. Não use sudo.</p></article>
          <article class="passo-card" id="passo-5" data-revela><span class="mono">Passo 5</span><h3>Ligar</h3><p><code class="c">npm run dev</code> e deixe a janela aberta. A linha saudável mostra 4721.</p></article>
          <article class="passo-card" id="passo-6" data-revela><span class="mono">Passo 6</span><h3>Factory</h3><p><code class="c">localhost:4721</code> é esta página. <code class="c">localhost:4721/studio</code> é a Factory.</p></article>
          <article class="passo-card opcional" id="passo-7" data-revela><span class="mono">Passo 7 · opcional</span><h3>Chave, se quiser</h3><p>Sem chave, a Factory funciona e avisa quando a resposta é uma amostra.</p></article>
        </div>
      </div>
    </section>

    <div class="wrap fim" data-revela>
      <h2>O pedido chega. O gate espera.</h2>
      <p>Abra a Factory e conduza o primeiro card.</p>
      <div class="acoes"><a class="primario" href="/studio">Abrir a Factory <span class="gira" aria-hidden="true">✻</span></a><a class="seta" href="https://github.com/juliopessan/super-factory">Ver no GitHub ↗</a></div>
    </div>
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
        { alvo: 'portao', titulo: 'O ciclo para no gate', texto: 'Um pedido passa por triagem e especificação e espera uma pessoa em implementação, merge e release. O agente não aprova.' },
        { alvo: 'ciclo', titulo: 'Seis estágios', texto: 'Triagem, especificação, implementação, verificação, revisão humana e entrega. Cada passo deixa registro.' },
        { alvo: 'quadro', titulo: 'O quadro', texto: 'Pedido claro entra em ready. Pedido vago, segredo ou force-push fica blocked. A onda leva no máximo cinco cards.' },
        { alvo: 'papeis', titulo: 'Oito papéis', texto: 'Só o Chief of Staff abre card. Security é somente leitura. Nenhum papel aprova gate.' },
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

      // Revela todo bloco cujo topo já entrou na tela, inclusive os que uma rolagem rápida ou um salto pulou.
      var pendentes = Array.prototype.slice.call(document.querySelectorAll('[data-revela]'))
      var agendado = false
      function revelar() {
        agendado = false
        var limite = window.innerHeight * 0.92
        var lote = 0
        pendentes = pendentes.filter(function (el) {
          if (el.getBoundingClientRect().top > limite) return true
          M.animate(el, { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0)'] }, { duration: 0.7, delay: Math.min(lote++, 8) * 0.06, ease: suave })
          return false
        })
        if (!pendentes.length) window.removeEventListener('scroll', agendar)
      }
      function agendar() { if (!agendado) { agendado = true; requestAnimationFrame(revelar) } }
      window.addEventListener('scroll', agendar, { passive: true })
      window.addEventListener('resize', agendar)
      revelar()

      document.querySelectorAll('.trace').forEach(function (trace) {
        var barras = trace.querySelectorAll('.trilho i')
        barras.forEach(function (b) { b.style.transform = 'scaleX(0)' })
        M.inView(trace, function () {
          barras.forEach(function (b, i) {
            M.animate(b, { transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: 0.9, delay: 0.15 + i * 0.12, ease: suave })
          })
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
    })
  </script>
</body>
</html>`
}
