# Motion: vídeo hero da Super Factory

Vídeo de 15 segundos (1920×1080, 30 fps), feito em [Remotion](https://www.remotion.dev/), para o hero da landing.
O render pronto fica em `docs/motion/super-factory-hero.mp4`, com o pôster em `docs/motion/super-factory-hero.jpg`.

| tempo | cena |
| --- | --- |
| 0–2,5 s | "A programação morreu.", com risco cinético |
| 2–4,5 s | "A engenharia não.", com zoom que atravessa a tela |
| 4,5–10 s | a Factory trabalhando: card do Azure DevOps ou do GitHub, as 6 fases com spinning verbs, terminal do sandbox, barras de trace |
| 10–12,5 s | o pull request pronto para revisão, com o merge nas mãos de uma pessoa |
| 12,5–15 s | marca: SF, "Super Factory", "A Factory que constrói factory." |

As cores e a tipografia seguem o design system: preto `#080808`, branco `#f0f0f0`, cor só como dado, Greed (fallback Inter) e Commit Mono.

```bash
cd motion && npm install
npm run studio    # edita com preview
npm run render    # gera out/super-factory-hero.mp4
npm run poster    # gera out/super-factory-hero.jpg
```

Em ambiente sem o Chrome do Remotion, aponte `REMOTION_CHROME` para um Chromium headless.
