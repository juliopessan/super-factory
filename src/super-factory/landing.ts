import { traduzirParaIngles } from './landing-en.ts'

export type Idioma = 'pt' | 'en'

export function paginaInicial(idioma: Idioma = 'pt'): string {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Super Factory</title>
  <meta name="description" content="A programação morreu. A engenharia não. A Super Factory lê a demanda no Azure DevOps ou no GitHub, implementa e testa num container e abre o pull request. Você decide o merge." />
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
    .mark { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: #f0f0f0; color: #080808; font-family: Greed, ui-sans-serif, system-ui, sans-serif; font-size: 11.5px; font-weight: 600; letter-spacing: .2px; }
    nav { display: flex; gap: 24px; }
    nav a { color: var(--muted); font-size: 14px; display: inline-flex; align-items: center; gap: 8px; }
    nav a::before { content: ""; width: 4px; height: 4px; border-radius: 9px; background: var(--faint); }
    nav a:hover { color: var(--text); }
    nav a[aria-current="location"] { color: var(--text); }
    nav a[aria-current="location"]::before { background: var(--accent); transform: scale(1.5); }
    nav a::before { transition: background-color .2s var(--ease), transform .2s var(--ease); }
    /* O título da seção para 28px abaixo do cabeçalho fixo: o ponto de chegada desconta o respiro do topo da seção. */
    section[id] { scroll-margin-top: calc(var(--topo, 61px) - var(--respiro) + 28px); }
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

    /* motion do hero: só vale com a classe mov (sem movimento reduzido). Sem o script, o hero aparece inteiro. */
    .hero { position: relative; }
    :where(.hero) > :where(:not(.campo-pontos)) { position: relative; z-index: 1; }
    .campo-pontos { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; -webkit-mask-image: radial-gradient(ellipse 74% 64% at 50% 36%, #000 38%, transparent 100%); mask-image: radial-gradient(ellipse 74% 64% at 50% 36%, #000 38%, transparent 100%); }
    .mov .hero h1 .linha, .mov .hero .rede, .mov .hero .rotulo-hero, .mov .hero .lead, .mov .hero .primario, .mov .hero .seta { opacity: 0; animation: hero-seguro .01s 4.4s forwards; }
    @keyframes hero-seguro { to { opacity: 1; } }
    .mov .hero .p { display: inline-block; white-space: nowrap; }
    .mov .hero .l { display: inline-block; transform-origin: 50% 100%; }
    .mov .hero .sub { text-decoration: none; position: relative; }
    .mov .hero .sub::after { content: ""; position: absolute; left: 0; right: 0; bottom: .09em; height: max(1.5px, .04em); background: var(--accent); transform-origin: left center; transform: scaleX(var(--ul, 1)); }

    /* seções */
    section { --respiro: 120px; padding: var(--respiro) 0 0; }
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
    .diagrama .borda.humano { stroke: var(--accent); }
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



    .idiomas { display: flex; gap: 6px; align-items: center; }
    .idiomas a { display: inline-flex; padding: 3px; border-radius: 6px; border: 1px solid transparent; opacity: .45; transition: opacity .15s var(--ease); }
    .idiomas a:hover { opacity: .9; }
    .idiomas a[aria-current="page"] { opacity: 1; border-color: var(--line-2); }
    .idiomas svg { width: 22px; height: 16px; display: block; border-radius: 3px; }
    /* manifesto */
    .manifesto { border-top: 1px solid var(--line); }
    .frase { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: 32px; align-items: baseline; padding: 36px 0; border-bottom: 1px solid var(--line); }
    .frase h2 { font-size: clamp(2rem, 1rem + 3vw, 3.6rem); line-height: 1.05; letter-spacing: -.035em; }
    .frase p { margin: 0; color: var(--muted); font-size: clamp(1rem, .95rem + .3vw, 1.2rem); max-width: 46ch; }
    .rotulo-hero .gira { margin-right: 4px; }
    /* modo autônomo: sessão ao vivo no estilo do Claude */
    .auto-grade { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 40px; padding: 40px; }
    .etapas { list-style: none; margin: 0; padding: 0; display: grid; gap: 22px; align-content: start; }
    .etapas li { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px; }
    .etapas .mono { color: var(--accent); padding-top: 3px; }
    .etapas h3 { font-size: 16px; }
    .etapas p { margin: 4px 0 0; color: var(--muted); }
    .terminal { border: 1px solid var(--line); border-radius: 16px; background: var(--card-2); overflow: hidden; min-width: 0; align-self: start; }
    .terminal-topo { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 12px; color: var(--faint); }
    .terminal-topo .dots { display: flex; gap: 6px; }
    .terminal-topo .dots i { width: 9px; height: 9px; border-radius: 9px; border: 1px solid var(--line-2); display: block; }
    .sessao { font-family: var(--mono); font-size: 13px; line-height: 1.8; padding: 16px 18px 20px; min-height: 380px; }
    .sessao .l { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--muted); }
    .sessao .pedido { color: var(--text); margin-bottom: 6px; }
    .sessao .tool b { font-weight: 400; color: var(--signal); margin-right: 8px; }
    .sessao .res { padding-left: 22px; color: var(--faint); }
    .sessao .res.falha { color: var(--accent); }
    .sessao .pr { color: var(--signal); margin-top: 6px; }
    .sessao .humano { color: var(--accent); }
    .sessao .spin { color: var(--accent); margin-top: 4px; }
    .sessao .spin .vivo { background: linear-gradient(90deg, var(--accent) 0%, var(--text) 50%, var(--accent) 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: brilha 1.8s linear infinite; }
    .sessao .spin small { color: var(--faint); font-size: 12px; margin-left: 8px; }
    .sessao .digitando::after { content: "▍"; color: var(--faint); animation: pisca 1s steps(1) infinite; }
    .gira.js-gira { animation: none; }
    @keyframes brilha { from { background-position: 100% 0; } to { background-position: -100% 0; } }
    @keyframes pisca { 50% { opacity: 0; } }
    .mov [data-revela] { opacity: 0; }

    /* apresentação em vídeo: aparece 3 s depois da abertura */
    .video-apresentacao { padding: 0 0 96px; }
    .video-quadro { margin: 0 auto; max-width: 1120px; aspect-ratio: 16 / 9; border-radius: 28px; overflow: hidden; border: 1.5px solid var(--line-2); background: #050505; transition: opacity .7s cubic-bezier(.4,0,.2,1), transform .7s cubic-bezier(.4,0,.2,1); }
    .video-quadro.espera { opacity: 0; transform: translateY(18px); }
    .video-quadro video { display: block; width: 100%; height: 100%; object-fit: cover; }
    .video-legenda { margin: 14px 0 0; text-align: center; font-family: var(--mono); font-size: 13px; letter-spacing: .04em; color: var(--muted); }
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
      .top-inner { flex-wrap: wrap; row-gap: 0; padding-top: 8px; }
      nav { order: 3; flex: 1 0 100%; gap: 20px; margin: 0 -16px; padding: 0 16px 8px; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
      nav::-webkit-scrollbar { display: none; }
      nav a { flex: none; white-space: nowrap; min-height: 30px; }
      .grade { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .trilha-grade { grid-template-columns: 1fr; }
      .auto-grade { grid-template-columns: 1fr; padding: 24px; }
      .frase { grid-template-columns: 1fr; gap: 10px; padding: 28px 0; }
      .colunas { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .passos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 760px) {
      section { --respiro: 72px; }
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
      .gira, .rede .fluxo, .diagrama .corre, .sessao .spin .vivo, .sessao .digitando::after { animation: none; }
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
        <a href="#manifesto">Manifesto</a>
        <a href="#autonomo">Autônomo</a>
        <a href="#ciclo">Ciclo</a>
        <a href="#papeis">Papéis</a>
        <a href="#quadro">Quadro</a>
        <a href="#trilha">Trilha</a>
        <a href="#harness">Harness</a>
        <a href="#limites">Limites</a>
        <a href="#instalar">Instalar</a>
      </nav>
      <div class="nav-cta">
        <div class="idiomas" role="group" aria-label="Idioma"><a href="/" hreflang="pt-BR" aria-label="Português (Brasil)" aria-current="page"><svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#009b3a"/><path d="M14 3 25 10 14 17 3 10z" fill="#fedf00"/><circle cx="14" cy="10" r="4.2" fill="#002776"/><path d="M10 9.4c2.6-.6 5.4-.3 8 .9" stroke="#fff" stroke-width=".8" fill="none"/></svg></a><a href="/en" hreflang="en-US" aria-label="English (US)"><svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#fff"/><path d="M0 1.5h28M0 4.6h28M0 7.7h28M0 10.8h28M0 13.9h28M0 17h28" stroke="#b22234" stroke-width="1.55"/><rect width="12" height="10.8" rx="2" fill="#3c3b6e"/><g fill="#fff"><circle cx="2.5" cy="2.4" r=".6"/><circle cx="5.5" cy="2.4" r=".6"/><circle cx="8.5" cy="2.4" r=".6"/><circle cx="4" cy="4.8" r=".6"/><circle cx="7" cy="4.8" r=".6"/><circle cx="2.5" cy="7.2" r=".6"/><circle cx="5.5" cy="7.2" r=".6"/><circle cx="8.5" cy="7.2" r=".6"/></g></svg></a></div>
        <a class="link" href="https://github.com/juliopessan/super-factory">GitHub</a>
        <a class="link" href="/waitlist">Lista de espera</a>
        <button class="link" type="button" id="guia-abrir">Guia-me</button>
        <a class="pilula" href="/studio" id="factory-cta">Abrir a Factory</a>
      </div>
    </div>
  </header>
  <div class="wrap"><a class="aba" href="#instalar"><span class="longo">Guia de instalação</span><i class="longo" aria-hidden="true"></i><b>7 passos até o primeiro PR</b> →</a></div>
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
      <p class="rotulo-hero"><span class="gira" aria-hidden="true">✻</span> A factory que constrói factory</p>
      <h1 aria-label="A programação morreu. A engenharia não."><span class="linha" aria-hidden="true">A programação morreu.</span> <span class="linha" aria-hidden="true">A <span class="sub">engenharia</span> não.</span></h1>
      <p class="lead">Agentes escrevem o código. Engenharia é decidir o que entra. A Super Factory lê a demanda no Azure DevOps ou no GitHub, implementa e testa num container e abre o pull request. Você decide o merge.</p>
      <div class="acoes">
        <a class="primario" href="/studio">Abrir a Factory <span class="gira" aria-hidden="true">✻</span></a>
        <a class="seta" href="#instalar">Instalar ↗</a>
        <a class="seta" href="/waitlist">Lista de espera ↗</a>
      </div>
    </div>

    <div class="wrap video-apresentacao" id="apresentacao">
      <figure class="video-quadro" id="video-quadro" style="margin-left:auto;margin-right:auto">
        <video id="video-hero" muted playsinline loop preload="metadata" poster="/motion/super-factory-hero.jpg" aria-label="Apresentação da Super Factory, 15 segundos, sem som">
          <source src="/motion/super-factory-hero.mp4" type="video/mp4">
        </video>
      </figure>
      <p class="video-legenda">Do card ao pull request, com o merge nas mãos de uma pessoa.</p>
    </div>
    <script>
    (function () {
      var quadro = document.getElementById('video-quadro'), video = document.getElementById('video-hero')
      if (!quadro || !video) return
      var reduz = false
      try { reduz = matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) {}
      if (reduz) { quadro.classList.remove('espera'); video.loop = false; video.controls = true; return }
      quadro.classList.add('espera')
      setTimeout(function () { quadro.classList.remove('espera'); video.play().catch(function () {}) }, 3000)
    })()
    </script>

    <section id="manifesto">
      <div class="wrap">
        <div class="manifesto">
          <div class="frase" data-revela><h2>A programação morreu.</h2><p>Escrever código virou a parte barata. Um agente faz em minutos o que levava dias.</p></div>
          <div class="frase" data-revela><h2>A <span class="sub">engenharia</span> não.</h2><p>Critério de aceite, arquitetura, risco e evidência continuam sendo trabalho de gente. É isso que a Factory protege.</p></div>
          <div class="frase" data-revela><h2>Evidência antes de confiança.</h2><p>Cada pull request traz o teste que rodou, o código de saída e o que ficou de fora. Nada de “confia em mim”.</p></div>
          <div class="frase" data-revela><h2>Você decide o merge.</h2><p>A Factory abre o pull request. Quem responde pelo que entra no produto é uma pessoa.</p></div>
        </div>
      </div>
    </section>
    <section id="autonomo">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Modo autônomo</h2>
          <p>Do Azure DevOps ou do GitHub ao pull request. A Factory implementa e testa num container; você revisa e decide o merge.</p>
        </div>
        <div class="moldura" data-revela>
          <div class="card grao brilho auto-grade">
            <ol class="etapas">
              <li><span class="mono">01</span><div><h3>Lê a demanda</h3><p>Work item do Azure DevOps ou issue do GitHub. Pedido vago, segredo ou force-push param na triagem.</p></div></li>
              <li><span class="mono">02</span><div><h3>Abre um container</h3><p>Um Docker descartável por card, sem privilégios, com o repositório clonado numa branch <code class="c">factory/…</code>.</p></div></li>
              <li><span class="mono">03</span><div><h3>Implementa e testa</h3><p>O Construtor escreve o código e os testes, e roda o teste do seu repositório até passar.</p></div></li>
              <li><span class="mono">04</span><div><h3>Abre o pull request</h3><p>Pronto para revisão, com a evidência do sandbox na descrição. Com teste falhando, sai como rascunho.</p></div></li>
              <li><span class="mono">05</span><div><h3>Você decide o merge</h3><p>A Factory não tem endpoint de merge nem de deploy.</p></div></li>
            </ol>
            <div class="terminal" aria-label="Sessão de exemplo do modo autônomo">
              <div class="terminal-topo"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span id="sessao-titulo">factory · autonomo · C-14</span></div>
              <div class="sessao" id="sessao">
                <div class="l pedido">› Azure DevOps · work item 4812 · Filtro de datas com hora</div>
                <div class="l tool"><b>⏺</b> triagem → ready, critério observável</div>
                <div class="l tool"><b>⏺</b> sandbox node:22 · cap-drop ALL · branch factory/c-14</div>
                <div class="l tool"><b>⏺</b> executar-comando npm test</div>
                <div class="l res">⎿ ok 14 testes · 0 falhas · 2,8 s</div>
                <div class="l pr">✓ PR #7 pronto para revisão · testes no sandbox: PASS</div>
                <div class="l humano">✋ aguardando uma pessoa para o merge</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section id="ciclo">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Ciclo</h2>
          <p>O workflow autonomo conduz o card da triagem ao pull request e guarda cada passo. O sdlc continua para quem prefere aprovar a entrega antes de abrir o pull request.</p>
        </div>
        <div class="grade dois">
          <article class="card grao" data-revela>
            <h3>Um container por card</h3>
            <p class="desc">Tudo roda num Docker descartável. Nada toca a sua máquina nem produção.</p>
            <div class="mini"><div class="suspende"><div class="linha"><b><span class="gira" aria-hidden="true">✻</span>sandbox · node:22</b><small>C-14</small></div><p>destruído no fim do card</p><div class="pills"><span>cap-drop ALL</span><span>no-new-privileges</span><span>512 processos</span><span>4 GB</span></div></div></div>
          </article>
          <article class="card grao" data-revela>
            <h3>Evidência observada</h3>
            <p class="desc">O teste do seu repositório roda no container. O resultado vem do código de saída, não de relato.</p>
            <div class="mini"><pre aria-label="Exemplo de evidência do sandbox">{
  <span class="k">"nome"</span>: <span class="s">"testes-no-sandbox"</span>,
  <span class="k">"resultado"</span>: <span class="s">"PASS"</span>,
  <span class="k">"comando"</span>: <span class="s">"npm test"</span>,
  <span class="k">"evidencia"</span>: <span class="s">"código de saída 0, 2814 ms"</span>
}</pre></div>
          </article>
          <article class="card grao" data-revela>
            <h3>Token fora do container</h3>
            <p class="desc">O token entra só no clone e no push. O diff é varrido antes do envio: com segredo, nada sai.</p>
            <div class="mini"><div class="tracejado"><span class="mono">git push</span><code>FACTORY_GIT_AUTH → só no clone e no push</code><code>diff com <b>[segredo:token-github]</b> → bloqueado</code></div></div>
          </article>
          <article class="card grao" data-revela>
            <h3>GitHub e Azure DevOps</h3>
            <p class="desc">Clona, envia a branch e abre o pull request pronto para revisão. Não há endpoint de merge.</p>
            <div class="mini chamadas"><div class="chamada"><code>criarRascunhoAzure()</code><svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="30" fill="var(--card-2)"/><path d="M18 30 A36 36 0 0 1 40 13" fill="none" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/><path d="M78 66 A36 36 0 0 1 56 83" fill="none" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/><path transform="translate(36 36)" d="M7 3h7l4 4v14H7z M14 3v4h4" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="chamada"><code>criarRascunhoGithub()</code><svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="30" fill="var(--card-2)"/><path d="M18 30 A36 36 0 0 1 40 13" fill="none" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/><path d="M78 66 A36 36 0 0 1 56 83" fill="none" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/><path transform="translate(36 36)" d="M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9c0 6-12 3-12 9" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          </article>
        </div>
      </div>
    </section>
    <section id="papeis">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Papéis</h2>
          <p>Oito agentes com um lugar para escrever, ou só para ler. Nenhum deles aprova gate.</p>
        </div>
        <div class="moldura" data-revela>
          <div class="card destaque grao brilho" id="portao">
            <h3>Um gate só, com nome de gente</h3>
            <p class="desc">Do pedido ao pull request, a Factory segue sozinha. O merge é de uma pessoa, pelo processo do seu repositório.</p>
            <div class="rolagem"><svg class="diagrama" viewBox="0 0 960 340" role="img" aria-label="Modo autônomo: triagem, sandbox, construção, testes e pull request seguem sozinhos; o merge é de uma pessoa. Pedido com segredo vai para blocked.">
<path class="trilho" d="M90 230 C150 230 170 120 250 120 H850"/><path class="trilho" d="M90 230 C150 230 170 290 250 290"/>
<path class="corre" d="M90 230 C150 230 170 120 250 120 H850"/>
<g><circle class="miolo" cx="90" cy="230" r="27"/><path class="borda" d="M60.9 205.6 A38 38 0 0 1 103.0 194.3"/><path class="borda" d="M119.1 254.4 A38 38 0 0 1 77.0 265.7"/><path class="ic" transform="translate(79.2 219.2) scale(0.9)" d="M4 5h16l-6 7v6l-4 2v-8z"/><text x="90" y="292" text-anchor="middle" class="">TRIAGEM</text></g>
<g><circle class="miolo" cx="250" cy="120" r="27"/><path class="borda" d="M220.9 95.6 A38 38 0 0 1 263.0 84.3"/><path class="borda" d="M279.1 144.4 A38 38 0 0 1 237.0 155.7"/><path class="ic" transform="translate(239.2 109.2) scale(0.9)" d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5"/><text x="250" y="182" text-anchor="middle" class="">SANDBOX</text></g>
<g><circle class="miolo" cx="400" cy="120" r="27"/><path class="borda" d="M370.9 95.6 A38 38 0 0 1 413.0 84.3"/><path class="borda" d="M429.1 144.4 A38 38 0 0 1 387.0 155.7"/><path class="ic" transform="translate(389.2 109.2) scale(0.9)" d="M8 8l-4 4 4 4 M16 8l4 4-4 4 M13.5 5l-3 14"/><text x="400" y="182" text-anchor="middle" class="">CONSTRUÇÃO</text></g>
<g><circle class="miolo" cx="550" cy="120" r="27"/><path class="borda" d="M520.9 95.6 A38 38 0 0 1 563.0 84.3"/><path class="borda" d="M579.1 144.4 A38 38 0 0 1 537.0 155.7"/><path class="ic" transform="translate(539.2 109.2) scale(0.9)" d="M9 3h6 M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3 M7.5 15h9"/><text x="550" y="182" text-anchor="middle" class="">TESTES</text></g>
<g><circle class="miolo" cx="700" cy="120" r="27"/><path class="borda" d="M670.9 95.6 A38 38 0 0 1 713.0 84.3"/><path class="borda" d="M729.1 144.4 A38 38 0 0 1 687.0 155.7"/><path class="ic" transform="translate(689.2 109.2) scale(0.9)" d="M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9c0 6-12 3-12 9"/><text x="700" y="182" text-anchor="middle" class="">PULL REQUEST</text></g>
<g><circle class="miolo" cx="850" cy="120" r="27"/><path class="borda humano" d="M820.9 95.6 A38 38 0 0 1 863.0 84.3"/><path class="borda humano" d="M879.1 144.4 A38 38 0 0 1 837.0 155.7"/><path class="ic" transform="translate(839.2 109.2) scale(0.9)" d="M8 13V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 13a1.5 1.5 0 0 1 2.4-1.8L8 14"/><text x="850" y="182" text-anchor="middle" class="">MERGE · PESSOA</text></g>
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
            <p class="desc">Nenhum agente faz merge. Uma pessoa revisa o pull request e decide.</p>
            <div class="mini"><div class="dialogo"><p><span aria-hidden="true">✋</span>O PR #7 está pronto. Testes no sandbox: PASS. Revisar e fazer o merge?</p><div class="botoes"><button type="button" class="sim" tabindex="-1">Revisar PR</button><button type="button" tabindex="-1">Pedir ajuste</button></div></div></div>
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
            <p class="desc">Lê a demanda e abre o pull request no Azure DevOps ou no GitHub. Sem credencial, diz que é simulado.</p>
            <div class="mini provedores"><div>Azure DevOps <small>work item · PR pronto</small></div><div>GitHub <small>issue · PR pronto</small></div><div>Merge <small class="laranja">não existe</small></div></div>
          </article>
        </div>
        <p class="cabeca" style="margin: 28px auto 0; font-size: 15px; color: var(--muted)">Frontend, Backend e Docs completam os oito. No modo autônomo, o Construtor escreve o código dentro do container do card.</p>
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
    <section id="harness">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Harness evolutivo</h2>
          <p>A factory que constrói factory. O jeito de trabalhar mora no repositório, e cada melhoria passa pelo mesmo pull request e pela mesma pessoa no merge.</p>
        </div>
        <div class="grade dois">
          <article class="card grao" data-revela>
            <h3>Skills versionadas</h3>
            <p class="desc">Como construir, revisar e desenhar fica escrito em skills. Aprendeu um jeito melhor? Vira pull request na skill.</p>
            <div class="mini pilhas"><span><i class="anel"></i>factory-ui</span><span><i class="anel"></i>super-review</span><span><i class="anel"></i>super-qa</span></div>
          </article>
          <article class="card grao" data-revela>
            <h3>Regras do cliente, com autor</h3>
            <p class="desc">A base do projeto guarda o que uma pessoa do cliente ditou, com o nome dela. Nenhum agente inventa regra.</p>
            <div class="mini"><div class="tracejado"><span class="mono">base do projeto</span><code>branch protegida → <b>main</b> · autora: Joana</code><code>checks do cliente → typecheck, suíte</code></div></div>
          </article>
          <article class="card grao" data-revela>
            <h3>Política no código, não no prompt</h3>
            <p class="desc">Aprovação nas escritas externas, retry, limite de contexto e guarda na saída valem em toda chamada.</p>
            <div class="mini linhas-check"><div>aprovação em criarIssueGithub <span class="ok">ativa</span></div><div>guarda: "fiz o merge" <span class="nr">removido</span></div><div>segredo no diff <span class="nr">bloqueado</span></div></div>
          </article>
          <article class="card grao" data-revela>
            <h3>A Factory se constrói</h3>
            <p class="desc">Este repositório foi feito assim: pedido, agente, pull request, testes e merge decidido por uma pessoa.</p>
            <div class="mini provedores"><div>juliopessan/super-factory <small>pull requests</small></div><div>check · e2e <small class="verde">30 checagens</small></div><div>Merge <small class="laranja">sempre de uma pessoa</small></div></div>
          </article>
        </div>
      </div>
    </section>
    <section id="limites">
      <div class="wrap">
        <div class="cabeca" data-revela>
          <h2>Limites</h2>
          <p>O agente faz o trabalho. Uma pessoa decide o que entra.</p>
        </div>
        <div class="moldura" data-revela>
          <div class="card grao lados">
            <div>
              <h3>A Factory faz</h3>
              <ul>
                <li><b>✓</b>Triagem e plano do card</li>
                <li><b>✓</b>Código e testes num container descartável</li>
                <li><b>✓</b>Pull request pronto para revisão, com evidência</li>
                <li><b>✓</b>Card, trilha e relatório de cada passo</li>
              </ul>
            </div>
            <div>
              <h3>Fica com uma pessoa</h3>
              <ul>
                <li><b>✋</b>Merge: revisar o pull request e decidir</li>
                <li><b>✋</b>Deploy: nada vai para produção</li>
                <li><b>✋</b>Force-push e commit direto em main</li>
                <li><b>✋</b>Chaves e permissões do repositório</li>
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
          <p>Um passo de cada vez. Os passos 1 a 6 ligam a Factory; o 7 libera o modo autônomo. Se o Terminal mostrar uma linha vermelha, cole no chat da Factory e a conversa continua dali. Não cole chave, token ou senha.</p>
        </div>
        <div class="passos">
          <article class="passo-card" id="passo-1" data-revela><span class="mono">Passo 1</span><h3>Node</h3><p>Baixe a versão 22 em nodejs.org. No Terminal, <code class="c">node -v</code> precisa mostrar v22.18 ou mais.</p></article>
          <article class="passo-card" id="passo-2" data-revela><span class="mono">Passo 2</span><h3>Terminal</h3><p>No Mac, Command + espaço e escreva Terminal. No Windows, procure PowerShell no Iniciar. Confira o git com <code class="c">git --version</code>.</p></article>
          <article class="passo-card" id="passo-3" data-revela><span class="mono">Passo 3</span><h3>Projeto</h3><p>Na primeira vez, clone <code class="c">github.com/juliopessan/super-factory</code>. Se a pasta já existe, atualize com <code class="c">git pull --ff-only</code>.</p></article>
          <article class="passo-card" id="passo-4" data-revela><span class="mono">Passo 4</span><h3>Peças</h3><p>Dentro da pasta, <code class="c">npm install</code>. Espere a linha <code class="c">added packages</code>. Não use sudo.</p></article>
          <article class="passo-card" id="passo-5" data-revela><span class="mono">Passo 5</span><h3>Ligar</h3><p><code class="c">npm run dev</code> e deixe a janela aberta. A linha saudável mostra 4721.</p></article>
          <article class="passo-card" id="passo-6" data-revela><span class="mono">Passo 6</span><h3>Factory</h3><p><code class="c">localhost:4721</code> é esta página. <code class="c">localhost:4721/studio</code> é a Factory.</p></article>
          <article class="passo-card" id="passo-7" data-revela><span class="mono">Passo 7 · modo autônomo</span><h3>Docker e chaves</h3><p>Docker Desktop, ou Colima com <code class="c">colima start</code> e <code class="c">DOCKER_HOST</code> no <code class="c">.env</code>. Copie <code class="c">.env.example</code> para <code class="c">.env</code> e preencha <code class="c">ANTHROPIC_API_KEY</code>, <code class="c">GITHUB_TOKEN</code> e <code class="c">AZURE_DEVOPS_ORG</code> com <code class="c">AZURE_DEVOPS_PAT</code>. Comece por um repositório de teste.</p></article>
        </div>
      </div>
    </section>

    <div class="wrap fim" data-revela>
      <h2>A programação morreu. A engenharia está só começando.</h2>
      <p>O pedido chega, o pull request sai e você decide o merge. Abra a Factory e conduza o primeiro card.</p>
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
        { alvo: 'passo-3', titulo: 'Traga o projeto', texto: 'Primeira vez, clone github.com/juliopessan/super-factory. Se a pasta já existe, não clone de novo: atualize com git pull --ff-only.' },
        { alvo: 'passo-4', titulo: 'Instale as peças', texto: 'Dentro da pasta, npm install. Espere a linha added packages. Não use sudo. Se der erro, cole a mensagem no chat e continue daqui.' },
        { alvo: 'passo-5', titulo: 'Ligue a Factory', texto: 'npm run dev e deixe a janela aberta. A linha saudável mostra 4721.' },
        { alvo: 'passo-6', titulo: 'Abra no navegador', texto: 'localhost:4721 é esta página. localhost:4721/studio é a Factory, onde o chat continua a instalação.' },
        { alvo: 'passo-7', titulo: 'Docker e chaves', texto: 'Para o modo autônomo: Docker Desktop ou Colima, e o arquivo .env com ANTHROPIC_API_KEY e o acesso ao GitHub ou ao Azure DevOps. Comece por um repositório de teste. Não cole chave no chat.' },
        { alvo: 'manifesto', titulo: 'A engenharia não morreu', texto: 'Código ficou barato. Critério, evidência e a decisão do merge continuam com gente. É isso que a Factory protege.' },
        { alvo: 'autonomo', titulo: 'Modo autônomo', texto: 'A Factory lê a demanda no Azure DevOps ou no GitHub, implementa e testa num container e abre o pull request. Você decide o merge.' },
        { alvo: 'harness', titulo: 'Harness evolutivo', texto: 'Skills, regras do cliente e guardas vivem no repositório. Cada melhoria passa pelo mesmo pull request.' },
        { alvo: 'portao', titulo: 'Um gate só', texto: 'Triagem, sandbox, construção, testes e pull request seguem sozinhos. O merge é de uma pessoa.' },
        { alvo: 'ciclo', titulo: 'O ciclo autônomo', texto: 'Um container por card, evidência observada dos testes e token fora do container. Cada passo deixa registro.' },
        { alvo: 'quadro', titulo: 'O quadro', texto: 'Pedido claro entra em ready. Pedido vago, segredo ou force-push fica blocked. A onda leva no máximo cinco cards.' },
        { alvo: 'papeis', titulo: 'Oito papéis', texto: 'Só o Chief of Staff abre card. Security é somente leitura. Nenhum papel aprova gate.' },
        { alvo: 'limites', titulo: 'O que fica com você', texto: 'Merge, deploy, force-push e as chaves do repositório. A Factory faz o trabalho; você decide o que entra.' },
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

      var verbos = ['Conduza', 'Especifique', 'Implemente', 'Teste', 'Entregue']
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
  <script>
    // Animações no estilo do Claude, em JavaScript puro: ícone que pulsa em quadros,
    // verbo com brilho e sessão que chega digitada. Com movimento reduzido, tudo fica parado.
    (function () {
      var reduz = false
      try { reduz = matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) {}
      if (reduz) return

      var QUADROS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']
      var q = 0
      document.querySelectorAll('.gira').forEach(function (el) { el.classList.add('js-gira') })
      setInterval(function () {
        q = (q + 1) % QUADROS.length
        document.querySelectorAll('.gira').forEach(function (el) { el.textContent = QUADROS[q] })
      }, 120)

      var sessao = document.getElementById('sessao')
      var titulo = document.getElementById('sessao-titulo')
      if (!sessao) return

      var ROTEIROS = [
        { titulo: 'factory · autonomo · C-14 · Azure DevOps', linhas: [
          ['pedido', '› Azure DevOps · work item 4812 · Filtro de datas com hora', 'Lendo a demanda'],
          ['tool', 'triagem → ready, critério observável', 'Triando'],
          ['tool', 'sandbox node:22 · cap-drop ALL · factory/c-14-filtro-de-datas', 'Abrindo o container'],
          ['tool', 'git clone fabrica/pedidos-api', 'Clonando'],
          ['tool', 'ler-arquivo src/pedidos/filtro.ts', 'Lendo o código'],
          ['tool', 'escrever-arquivo src/pedidos/filtro.ts  +18 −4', 'Implementando'],
          ['tool', 'escrever-arquivo test/filtro.test.ts  +32', 'Escrevendo testes'],
          ['tool', 'executar-comando npm test', 'Testando'],
          ['res', '⎿ ok 14 testes · 0 falhas · 2,8 s', ''],
          ['tool', 'varredura de segredo no diff → limpo', 'Conferindo'],
          ['tool', 'git push factory/c-14-filtro-de-datas', 'Enviando'],
          ['pr', '✓ PR #7 pronto para revisão · testes no sandbox: PASS', 'Abrindo o pull request'],
          ['humano', '✋ aguardando uma pessoa para o merge', '']
        ] },
        { titulo: 'factory · autonomo · C-15 · GitHub', linhas: [
          ['pedido', '› GitHub · issue #128 · Exportar pedidos em CSV', 'Lendo a demanda'],
          ['tool', 'triagem → ready, critério observável', 'Triando'],
          ['tool', 'sandbox node:22 · pnpm · factory/c-15-exportar-pedidos', 'Abrindo o container'],
          ['tool', 'escrever-arquivo src/export/csv.ts  +41', 'Implementando'],
          ['tool', 'executar-comando pnpm run test', 'Testando'],
          ['res falha', '⎿ 1 falha · csv.test.ts:42 vírgula dentro do campo', ''],
          ['tool', 'escrever-arquivo src/export/csv.ts  +3 −1', 'Corrigindo'],
          ['tool', 'executar-comando pnpm run test', 'Testando de novo'],
          ['res', '⎿ ok 22 testes · 0 falhas · 3,1 s', ''],
          ['pr', '✓ PR #31 pronto para revisão · testes no sandbox: PASS', 'Abrindo o pull request'],
          ['humano', '✋ aguardando uma pessoa para o merge', '']
        ] }
      ]

      function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

      function linha(tipo) {
        var el = document.createElement('div')
        el.className = 'l ' + tipo
        sessao.appendChild(el)
        return el
      }

      async function girar(verbo, ms) {
        if (!verbo) return
        var el = linha('spin')
        var icone = document.createElement('span')
        icone.className = 'gira js-gira'
        icone.textContent = '✻'
        var vivo = document.createElement('span')
        vivo.className = 'vivo'
        vivo.textContent = ' ' + verbo + '…'
        var tempo = document.createElement('small')
        el.appendChild(icone); el.appendChild(vivo); el.appendChild(tempo)
        var inicio = Date.now()
        var relogio = setInterval(function () { tempo.textContent = '(' + Math.round((Date.now() - inicio) / 1000) + 's)' }, 250)
        await esperar(ms)
        clearInterval(relogio)
        el.remove()
      }

      async function digitar(el, texto) {
        el.classList.add('digitando')
        for (var i = 1; i <= texto.length; i += 2) {
          el.textContent = texto.slice(0, i)
          await esperar(14)
        }
        el.textContent = texto
        el.classList.remove('digitando')
      }

      async function rodar(roteiro) {
        sessao.textContent = ''
        if (titulo) titulo.textContent = roteiro.titulo
        for (var i = 0; i < roteiro.linhas.length; i++) {
          var tipo = roteiro.linhas[i][0], texto = roteiro.linhas[i][1], verbo = roteiro.linhas[i][2]
          await girar(verbo, 700 + Math.random() * 900)
          var el = linha(tipo)
          if (tipo === 'tool') {
            var ponto = document.createElement('b')
            ponto.textContent = '⏺'
            el.appendChild(ponto)
            var resto = document.createElement('span')
            el.appendChild(resto)
            await digitar(resto, texto)
          } else {
            await digitar(el, texto)
          }
        }
      }

      var comecou = false
      var observador = new IntersectionObserver(function (entradas) {
        if (comecou || !entradas.some(function (e) { return e.isIntersecting })) return
        comecou = true
        ;(async function () {
          for (var n = 0; ; n++) {
            await rodar(ROTEIROS[n % ROTEIROS.length])
            await esperar(4000)
          }
        })()
      }, { threshold: 0.3 })
      observador.observe(sessao)
    })()
  </script>
  <script>
    // Motion do hero, no estilo do modelo "orange dot": cada quadro sai só do tempo (seek(t)), com molas de forma
    // fechada. Um ponto de acento sai do "i" de "engenharia", salta e pousa no gate; a pancada percorre o campo de pontos.
    (function () {
      var reduz = false
      try { reduz = matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) {}
      var raiz = document.documentElement
      var hero = document.querySelector('.hero')
      if (reduz || !hero || !raiz.classList.contains('mov')) return
      var rede = hero.querySelector('.rede')
      var rotulo = hero.querySelector('.rotulo-hero')
      var h1 = hero.querySelector('h1')
      var lead = hero.querySelector('.lead')
      var primario = hero.querySelector('.primario')
      var seta = hero.querySelector('.seta')
      var linhas = h1 ? [].slice.call(h1.querySelectorAll('.linha')) : []
      if (!rede || !h1 || !linhas.length) return

      function limitar(x, a, b) { return x < a ? a : x > b ? b : x }
      // Mola de forma fechada, de 0 a 1. zeta < 1 passa do alvo e assenta.
      function mola(t, zeta, w) {
        if (t <= 0) return 0
        var wd = w * Math.sqrt(1 - zeta * zeta)
        return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t))
      }
      function entra(p) { p = limitar(p, 0, 1); return 1 - Math.pow(1 - p, 3) }
      function vaiVolta(p) { p = limitar(p, 0, 1); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2 }

      // ---- letras: cada uma é um elemento, para entrar sozinha
      function dividir(no, letras) {
        [].slice.call(no.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment()
            var palavra = null
            for (var i = 0; i < n.nodeValue.length; i++) {
              var c = n.nodeValue.charAt(i)
              if (c === ' ') { palavra = null; frag.appendChild(document.createTextNode(' ')); continue }
              if (!palavra) { palavra = document.createElement('span'); palavra.className = 'p'; frag.appendChild(palavra) }
              var l = document.createElement('span')
              l.className = 'l'
              l.textContent = c
              l.style.opacity = '0'
              palavra.appendChild(l)
              letras.push(l)
            }
            n.parentNode.replaceChild(frag, n)
          } else if (n.nodeType === 1 && !n.classList.contains('gira')) dividir(n, letras)
        })
      }
      var letrasH1 = []
      linhas.forEach(function (linha, i) {
        var daLinha = []
        dividir(linha, daLinha)
        daLinha.forEach(function (l) { l.setAttribute('data-linha', String(i)) })
        letrasH1 = letrasH1.concat(daLinha)
        linha.style.opacity = '1'
      })
      var letrasRotulo = []
      if (rotulo) { dividir(rotulo, letrasRotulo); rotulo.style.opacity = '1' }
      var sub = h1.querySelector('.sub')
      var letraI = sub ? sub.querySelectorAll('.l')[8] : null

      // ---- rede: fios que se desenham até o gate, nós que pulam, gate que pulsa
      var fios = [].slice.call(rede.querySelectorAll('.fio'))
      fios.forEach(function (f) { f.setAttribute('pathLength', '1'); f.style.strokeDasharray = '1'; f.style.strokeDashoffset = '1' })
      var fluxos = [].slice.call(rede.querySelectorAll('.fluxo'))
      fluxos.forEach(function (f) { f.style.opacity = '0' })
      var nos = [].slice.call(rede.querySelectorAll('circle.no')).map(function (n) {
        var fundo = n.previousElementSibling
        var icone = n.nextElementSibling && n.nextElementSibling.classList.contains('ic') ? n.nextElementSibling : null
        ;[fundo, n].forEach(function (c) { c.style.transformBox = 'fill-box'; c.style.transformOrigin = '50% 50%'; c.style.transform = 'scale(0)' })
        if (icone) icone.style.opacity = '0'
        return { fundo: fundo, n: n, icone: icone }
      })
      var gate = [rede.querySelector('circle[r="92"]'), rede.querySelector('circle[r="58"]'), rede.querySelector('g[stroke]'), rede.querySelector('text')].filter(Boolean)
      gate.forEach(function (g) { g.style.transformBox = 'view-box'; g.style.transformOrigin = '380px 150px'; g.style.transform = 'scale(0)' })
      rede.style.opacity = '1'
      ;[lead, primario, seta].forEach(function (e) { if (e) { e.style.opacity = '0'; e.style.transition = 'none' } })

      // ---- campo de pontos (halftone) atrás do hero
      var cv = document.createElement('canvas')
      cv.className = 'campo-pontos'
      cv.setAttribute('aria-hidden', 'true')
      hero.insertBefore(cv, hero.firstChild)
      var cx = cv.getContext('2d')
      var largura = 0, altura = 0, dpr = 1, passo = 22
      var corPonto = '#888', corAcento = '#f5a25d'
      var orbe = { x: 0, y: 0 }, inicio = { x: 0, y: 0 }, raio = 8
      var ondas = []
      var ptr = { x: -999, y: -999, sx: -999, sy: -999, f: 0 }
      function cores() {
        var cs = getComputedStyle(raiz)
        corPonto = cs.getPropertyValue('--faint').trim() || corPonto
        corAcento = cs.getPropertyValue('--accent').trim() || corAcento
      }
      function medir() {
        largura = hero.clientWidth
        altura = hero.clientHeight
        dpr = Math.min(2, window.devicePixelRatio || 1)
        cv.width = Math.round(largura * dpr)
        cv.height = Math.round(altura * dpr)
        passo = largura < 600 ? 18 : 22
        // O SVG não tem offsetLeft/offsetTop: a posição sai do retângulo, descontando o parallax já aplicado.
        var hr = hero.getBoundingClientRect()
        var sr = rede.getBoundingClientRect()
        orbe.x = sr.left - hr.left + sr.width / 2
        orbe.y = sr.top - hr.top + sr.height / 2 - paralaxe
        marcarInicio()
      }
      function marcarInicio() {
        if (!letraI) { inicio.x = orbe.x; inicio.y = orbe.y + 200; return }
        var hr = hero.getBoundingClientRect()
        var lr = letraI.getBoundingClientRect()
        inicio.x = lr.left - hr.left + lr.width / 2
        inicio.y = lr.top - hr.top + lr.height * 0.02
        raio = Math.max(4, lr.height * 0.085)
      }
      cores()
      try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', cores) } catch (e) {}
      medir()
      window.addEventListener('resize', medir)
      hero.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return
        var hr = hero.getBoundingClientRect()
        ptr.x = e.clientX - hr.left
        ptr.y = e.clientY - hr.top
        ptr.f = 1
        if (ptr.sx < -900) { ptr.sx = ptr.x; ptr.sy = ptr.y }
      })
      hero.addEventListener('pointerleave', function () { ptr.f = 0 })

      // ---- linha do tempo (segundos)
      var T = { rotulo: 0.3, linha1: 0.55, linha2: 0.95, sublinha: 1.7, ponto: 1.9, salto: 2.15, pouso: 2.95, lead: 2.55, botoes: 2.8 }
      var periodo = 4.8
      var pousou = false
      var ultimoCiclo = -1
      var visivel = true
      var terminou = false
      var paralaxe = 0

      function pos(i, linha) { return T[linha] + i * 0.026 }
      function letra(l, p, rot, subida) {
        if (p <= 0) return
        var k = mola(p, 0.5, 21)
        l.style.opacity = String(limitar(p / 0.12, 0, 1))
        l.style.transform = 'translate3d(0,' + ((1 - k) * subida).toFixed(3) + 'em,0) rotate(' + ((1 - k) * rot).toFixed(2) + 'deg)'
      }

      function renderizar(t) {
        // letras do rótulo e do título
        letrasRotulo.forEach(function (l, i) { letra(l, t - (T.rotulo + i * 0.018), 0, 0.55) })
        var contagem = [0, 0]
        letrasH1.forEach(function (l, i) {
          var n = Number(l.getAttribute('data-linha'))
          var k = contagem[n]++
          var rot = (((k * 37) % 11) - 5) * 2.4
          letra(l, t - (n === 0 ? T.linha1 : T.linha2) - k * 0.026, rot, 0.85)
        })
        if (sub) sub.style.setProperty('--ul', String(entra((t - T.sublinha) / 0.45)))

        // fios entram em direção ao gate; os nós pulam antes
        fios.forEach(function (f, i) { f.style.strokeDashoffset = String(1 - entra((t - (0.35 + i * 0.04)) / 0.8)) })
        fluxos.forEach(function (f) { f.style.opacity = String(0.8 * limitar((t - 1.5) / 0.6, 0, 1)) })
        nos.forEach(function (no, i) {
          var d = 0.1 + i * 0.045
          var k = mola(t - d, 0.5, 20)
          no.fundo.style.transform = no.n.style.transform = 'scale(' + k.toFixed(4) + ')'
          if (no.icone) no.icone.style.opacity = String(limitar((t - d - 0.12) / 0.2, 0, 1))
        })

        // gate: entra, leva a pancada do pouso e dá um batimento a cada ciclo
        var tp = t - T.pouso
        var escala = mola(t - 0.9, 0.5, 17)
        var pulso = tp > 0 ? Math.exp(-tp * 5) * Math.cos(tp * 26) * 0.12 : 0
        var ciclo = t > 3.8 ? Math.floor((t - 3.8) / periodo) : -1
        if (ciclo >= 0) {
          var tc = (t - 3.8) - ciclo * periodo
          pulso += Math.exp(-tc * 6) * Math.cos(tc * 30) * 0.045
          if (ciclo !== ultimoCiclo) { ultimoCiclo = ciclo; ondas.push({ t: t, a: 0.55 }) }
        }
        gate.forEach(function (g, i) { g.style.transform = 'scale(' + (escala * (1 + pulso * (i === 0 ? 1.8 : 1))).toFixed(4) + ')' })
        if (!pousou && t >= T.pouso) { pousou = true; ondas.push({ t: T.pouso, a: 1 }) }

        // texto e botões
        if (lead) { var kl = mola(t - T.lead, 0.7, 14); lead.style.opacity = String(limitar((t - T.lead) / 0.4, 0, 1)); lead.style.transform = 'translateY(' + ((1 - kl) * 18).toFixed(2) + 'px)' }
        ;[primario, seta].forEach(function (e, i) {
          if (!e) return
          var kb = mola(t - (T.botoes + i * 0.14), 0.55, 18)
          e.style.opacity = String(limitar((t - (T.botoes + i * 0.14)) / 0.25, 0, 1))
          e.style.transform = 'scale(' + (0.82 + 0.18 * kb).toFixed(4) + ')'
        })
        rede.style.transform = 'translateY(' + paralaxe.toFixed(1) + 'px)'

        if (!visivel) return
        desenhar(t)
      }

      function desenhar(t) {
        cx.setTransform(dpr, 0, 0, dpr, 0, 0)
        cx.clearRect(0, 0, largura, altura)
        ptr.sx += (ptr.x - ptr.sx) * 0.2
        ptr.sy += (ptr.y - ptr.sy) * 0.2
        var cy0 = orbe.y + paralaxe
        var alcance = Math.sqrt(largura * largura + altura * altura) * 0.8
        var revelar = vaiVolta(t / 1.5) * alcance
        ondas = ondas.filter(function (o) { return t - o.t < 2.4 })
        var cols = Math.ceil(largura / passo) + 1
        var lins = Math.ceil(altura / passo) + 1
        for (var j = 0; j < lins; j++) {
          for (var i = 0; i < cols; i++) {
            var gx = i * passo + ((j % 2) * passo) / 2
            var gy = j * passo
            var dx = gx - orbe.x, dy = gy - cy0
            var d = Math.sqrt(dx * dx + dy * dy)
            var rev = limitar((revelar - d) / 90, 0, 1)
            if (rev <= 0) continue
            var r = 1.1 + 0.3 * Math.sin(t * 0.9 + gx * 0.016 + gy * 0.012)
            var tom = 0
            for (var k = 0; k < ondas.length; k++) {
              var e = t - ondas[k].t
              var frente = e * 380
              var w = Math.exp(-Math.pow((d - frente) / 58, 2)) * ondas[k].a * (1 - e / 2.4)
              r += 2.8 * w
              if (w > tom) tom = w
            }
            if (ptr.f > 0.01 || ptr.sx > -900) {
              var mx = gx - ptr.sx, my = gy - ptr.sy
              var dp2 = mx * mx + my * my
              if (dp2 < 14400) { var q = 1 - Math.sqrt(dp2) / 120; q = q * q * Math.max(ptr.f, 0.0); r += 2.4 * q; if (q * 0.7 > tom) tom = q * 0.7 }
            }
            cx.globalAlpha = rev * (0.5 + 0.5 * limitar(tom * 1.6, 0, 1))
            cx.fillStyle = tom > 0.14 ? corAcento : corPonto
            cx.beginPath()
            cx.arc(gx, gy, r, 0, 6.2832)
            cx.fill()
          }
        }
        ptr.f *= 0.97
        cx.globalAlpha = 1

        // anel da pancada
        var tpouso = t - T.pouso
        if (tpouso > 0 && tpouso < 1.3) {
          cx.strokeStyle = corAcento
          cx.globalAlpha = 0.5 * (1 - tpouso / 1.3)
          cx.lineWidth = 2
          cx.beginPath()
          cx.arc(orbe.x, cy0, 40 + tpouso * 300, 0, 6.2832)
          cx.stroke()
          cx.globalAlpha = 1
        }

        // o ponto de acento: sai do "i", agacha, salta em arco e é absorvido pelo gate
        if (t < T.ponto || t > T.pouso + 0.22) return
        var x = inicio.x, y = inicio.y, sx = 1, sy = 1, esc = 1
        if (t < T.salto) {
          var pop = mola(t - T.ponto, 0.45, 24)
          esc = pop
          var agacha = limitar((t - (T.salto - 0.16)) / 0.16, 0, 1)
          sy = 1 - 0.3 * agacha
          sx = 1 + 0.22 * agacha
          y = inicio.y - raio * 1.8 * pop + raio * 0.9 * agacha
        } else if (t <= T.pouso) {
          var p = (t - T.salto) / (T.pouso - T.salto)
          var e2 = vaiVolta(p)
          var cxc = (inicio.x + orbe.x) / 2 + (orbe.x - inicio.x) * 0.1
          var cyc = Math.min(inicio.y, cy0) - 120
          x = (1 - e2) * (1 - e2) * inicio.x + 2 * (1 - e2) * e2 * cxc + e2 * e2 * orbe.x
          y = (1 - e2) * (1 - e2) * (inicio.y - raio * 0.9) + 2 * (1 - e2) * e2 * cyc + e2 * e2 * cy0
          var vel = Math.sin(Math.PI * p)
          sx = 1 + 0.35 * vel
          sy = 1 - 0.18 * vel
          var ang = Math.atan2(2 * (1 - e2) * (cyc - inicio.y) + 2 * e2 * (cy0 - cyc), 2 * (1 - e2) * (cxc - inicio.x) + 2 * e2 * (orbe.x - cxc))
          cx.save()
          cx.translate(x, y)
          cx.rotate(ang)
          cx.fillStyle = corAcento
          cx.beginPath()
          cx.ellipse(0, 0, raio * sx, raio * sy, 0, 0, 6.2832)
          cx.fill()
          cx.restore()
          return
        } else {
          x = orbe.x; y = cy0
          esc = 1 - limitar((t - T.pouso) / 0.22, 0, 1)
        }
        cx.fillStyle = corAcento
        cx.beginPath()
        cx.ellipse(x, y, raio * esc * sx, raio * esc * sy, 0, 0, 6.2832)
        cx.fill()
      }

      // ---- relógio
      var t0 = null
      var congelado = null
      var noFim = false
      function quadro(agora) {
        if (t0 === null) t0 = agora - (hero.getBoundingClientRect().bottom < 0 ? 6000 : 0)
        var t = congelado !== null ? congelado : (agora - t0) / 1000
        if (visivel || t < 4) renderizar(t)
        if (!noFim && t > 3.6) { noFim = true; liberar() }
        requestAnimationFrame(quadro)
      }
      // Passada a entrada, solta o que era só da animação: o hover do botão e o texto voltam ao normal.
      function liberar() {
        letrasH1.concat(letrasRotulo).forEach(function (l) { l.style.transform = ''; l.style.opacity = '' })
        fios.forEach(function (f) { f.style.strokeDasharray = ''; f.style.strokeDashoffset = '' })
        fluxos.forEach(function (f) { f.style.opacity = '' })
        nos.forEach(function (no) { no.fundo.style.transform = no.n.style.transform = ''; if (no.icone) no.icone.style.opacity = '' })
        ;[lead, primario, seta].forEach(function (e) { if (e) { e.style.transform = ''; e.style.opacity = ''; e.style.transition = '' } })
        if (sub) sub.style.removeProperty('--ul')
        terminou = true
      }
      // Depois de liberar, só o gate, o campo e o ponteiro seguem animados.
      var renderOriginal = renderizar
      renderizar = function (t) {
        if (!terminou) return renderOriginal(t)
        var tp = t - T.pouso
        var pulso = tp > 0 && tp < 1.5 ? Math.exp(-tp * 5) * Math.cos(tp * 26) * 0.12 : 0
        var ciclo = t > 3.8 ? Math.floor((t - 3.8) / periodo) : -1
        if (ciclo >= 0) {
          var tc = (t - 3.8) - ciclo * periodo
          pulso += Math.exp(-tc * 6) * Math.cos(tc * 30) * 0.045
          if (ciclo !== ultimoCiclo) { ultimoCiclo = ciclo; ondas.push({ t: t, a: 0.55 }) }
        }
        gate.forEach(function (g, i) { g.style.transform = 'scale(' + (1 + pulso * (i === 0 ? 1.8 : 1)).toFixed(4) + ')' })
        rede.style.transform = 'translateY(' + paralaxe.toFixed(1) + 'px)'
        if (visivel) desenhar(t)
      }

      if (window.IntersectionObserver) new IntersectionObserver(function (es) { visivel = es[0].isIntersecting }, { threshold: 0 }).observe(hero)
      window.addEventListener('scroll', function () { paralaxe = limitar(window.scrollY, 0, 700) * 0.1 }, { passive: true })

      // Para conferir um quadro exato: sfHeroSeek(2.5). sfHeroSeek(null) volta ao tempo real.
      var renderEnvolvido = renderizar
      window.sfHeroSeek = function (t) {
        congelado = t === null ? null : Number(t)
        if (congelado === null) { renderizar = renderEnvolvido; noFim = false; return }
        // Cada quadro pedido sai só do tempo: o estado que depende do relógio recomeça do zero.
        terminou = false
        pousou = false
        ultimoCiclo = -1
        ondas = []
        renderizar = renderOriginal
        ;[lead, primario, seta].forEach(function (e) { if (e) e.style.transition = 'none' })
        renderizar(congelado)
      }

      var comecar = function () { requestAnimationFrame(quadro) }
      var pronto = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 700) })]) : Promise.resolve()
      pronto.then(function () { medir(); comecar() })
    })()
  </script>
  <script>
    // Menu em sintonia com a página: marca a seção que está na tela e mede o cabeçalho para o ponto de chegada.
    (function () {
      var topo = document.querySelector('.top')
      var links = [].slice.call(document.querySelectorAll('nav a[href^="#"]'))
      if (!topo || !links.length) return
      var secoes = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)) }).filter(Boolean)
      var ativa = null
      var travado = false
      var fimDoRolar = null
      var reduz = false
      try { reduz = matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) {}

      function medir() { document.documentElement.style.setProperty('--topo', topo.offsetHeight + 'px') }
      medir()
      window.addEventListener('resize', medir)
      if (window.ResizeObserver) new ResizeObserver(medir).observe(topo)

      function centralizar(a) {
        var nav = a.parentElement
        if (!nav || nav.scrollWidth <= nav.clientWidth) return
        nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: reduz ? 'auto' : 'smooth' })
      }
      function marcar(id) {
        if (id === ativa) return
        ativa = id
        links.forEach(function (a) {
          if (id && a.getAttribute('href') === '#' + id) { a.setAttribute('aria-current', 'location'); centralizar(a) }
          else a.removeAttribute('aria-current')
        })
      }
      function atualizar() {
        if (travado) return
        // A seção atual é a última cujo topo já passou desta linha, um pouco abaixo do cabeçalho.
        var linha = topo.offsetHeight + window.innerHeight * 0.25
        var atual = null
        secoes.forEach(function (s) { if (s.getBoundingClientRect().top <= linha) atual = s.id })
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && secoes.length) atual = secoes[secoes.length - 1].id
        marcar(atual)
      }
      var agendado = false
      function agendar() { if (!agendado) { agendado = true; requestAnimationFrame(function () { agendado = false; atualizar() }) } }

      // Num clique no menu a marca vai direto para o destino. Sem isto ela varreria todas as seções do caminho.
      links.forEach(function (a) {
        a.addEventListener('click', function () {
          ativa = null
          marcar(a.getAttribute('href').slice(1))
          travado = true
          // Se o clique não gerar rolagem (já estou lá), a trava solta sozinha.
          clearTimeout(fimDoRolar)
          fimDoRolar = setTimeout(function () { travado = false; atualizar() }, 1600)
        })
      })
      window.addEventListener('scroll', function () {
        agendar()
        if (!travado) return
        clearTimeout(fimDoRolar)
        fimDoRolar = setTimeout(function () { travado = false; atualizar() }, 160)
      }, { passive: true })
      window.addEventListener('resize', agendar)
      atualizar()
    })()
  </script>
</body>
</html>`
  return idioma === 'en' ? traduzirParaIngles(html) : html
}
