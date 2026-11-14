---
name: factory-ui
description: Design system da Super Factory para interface. Use quando o papel Frontend for desenhar ou revisar tela, landing, card, painel, diagrama ou animação da Factory. Fundo quase preto, cards grandes em moldura, rótulos mono em laranja, mini-interfaces dentro dos cards, movimento discreto.
---

# Factory UI

A interface da Factory parece uma bancada de trabalho à noite: fundo quase preto, peças grandes e arredondadas, e dentro de cada peça um pedaço de interface de verdade (uma trilha, um gate, um card). Nada de ilustração genérica. Mostre o produto.

Este sistema é um **modelo de layout**. Ele não carrega marca de terceiros. Logo, mascote, ícones e textos são da Factory: o selo SF, o gate, os oito papéis. Nunca copie logo, personagem, ilustração ou texto de outro site, mesmo que a referência seja parecida.

## Tokens

### Cor (tema escuro, padrão)

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#050505` | Fundo da página |
| `--frame` | `#0b0b0b` | Moldura externa dos cards grandes |
| `--card` | `#141414` | Card |
| `--card-2` | `#1b1b1b` | Mini-interface dentro do card, pílula, campo |
| `--line` | `#ffffff14` | Borda padrão, 1px |
| `--line-2` | `#ffffff24` | Borda de pílula, botão secundário, nó |
| `--text` | `#ededed` | Título e texto principal |
| `--muted` | `#9a9a9a` | Descrição e texto secundário (7:1 no card) |
| `--faint` | `#6b6b6b` | Só legenda de 12px e item apagado |
| `--accent` | `#f5a25d` | Rótulo mono, sublinhado, ícone ativo. Nunca em parágrafo |
| `--signal` | `#5ee08a` | Rótulo mono de endereço, barra de sucesso, PASS |
| `--violet` | `#9b7bf2` | Barra de duração do modelo na trilha |
| `--button` | `#e8e8e8` | Botão primário em pílula; texto `#0b0b0b` |

### Cor (tema claro)

Mesma estrutura, invertida: `--bg #f4f4f2`, `--frame #e9e9e6`, `--card #ffffff`, `--card-2 #f1f1ee`, `--line #0000001a`, `--line-2 #0000002b`, `--text #111111`, `--muted #555555`, `--faint #8a8a8a`, `--accent #b85f12`, `--signal #137a3d`, `--violet #5b3fc4`, `--button #111111` com texto `#f4f4f2`. Troque por `prefers-color-scheme`. O laranja e o verde escurecem no claro para manter 4.5:1 como texto.

### Tipografia

- **Sans:** Geist (Google Fonts), 400 e 500. Títulos em 500 com `letter-spacing: -0.035em`.
- **Mono:** Geist Mono, 400. Rótulos em MAIÚSCULAS com `letter-spacing: 0.08em`, 12px.

| Estilo | Tamanho | Uso |
| --- | --- | --- |
| `display` | `clamp(2.6rem, 1rem + 4.4vw, 4.75rem)`, altura 1.05 | Título do hero, centralizado, 2 linhas |
| `section` | `clamp(2.25rem, 1.2rem + 2.6vw, 3.6rem)`, altura 1.05 | Título de seção, centralizado |
| `lead` | `clamp(1.05rem, .95rem + .4vw, 1.3rem)` em `--muted` | Subtítulo centralizado, até 58ch |
| `card-title` | 16px, 500 | Título do card, alinhado à esquerda |
| `body` | 15px, altura 1.55, `--muted` | Descrição do card, até 40ch |
| `label` | 12px mono maiúsculo | Rótulo de nó, endereço, coluna |

### Forma e espaço

- Raio: moldura `40px`, card `28px`, mini-interface `16px`, pílula `999px`, botão `999px`.
- Card grande = moldura (`--frame`, padding 10px, raio 40) com o card dentro (`--card`, borda `--line`, raio 28). Cards de grade não têm moldura.
- Padding do card: 36px no desktop, 24px no celular. Grade com `gap: 16px`.
- Largura máxima 1200px; seção com 120px de respiro vertical (72px no celular).
- Sem sombra. A separação vem de borda de 1px e da diferença entre `--bg`, `--frame` e `--card`.
- Textura: ruído granulado suave e um brilho radial no card grande, em opacidade baixa (≤ 0.06). Nunca gradiente colorido de fundo.

## Componentes

- **Topo:** fixo, fundo `--bg` com borda inferior `--line`. Selo SF e nome à esquerda; links em 14px `--muted`; à direita, link de texto e um botão em pílula com borda `--line-2`.
- **Aba de aviso:** pendurada logo abaixo do topo, alinhada à esquerda do conteúdo, fundo `--card`, raio inferior 20px. Texto apagado, ponto, texto claro e seta: `Guia de instalação · 7 passos →`.
- **Hero:** centralizado. Ilustração de rede no alto (nós em anel ligados por curvas finas, ícones dos papéis dentro, um orbe central com o selo SF), rótulo pequeno em 500, título `display`, e duas ações: pílula primária `--button` com ícones pequenos e um link com `↗`.
- **Cabeçalho de seção:** título `section` e `lead` centralizados.
- **Card de destaque:** card grande em moldura, título e descrição no canto superior esquerdo, ilustração ocupando o resto.
- **Card de grade:** grade de 3 colunas (2 no tablet, 1 no celular). Título, descrição e, embaixo, uma mini-interface: pílulas empilhadas que vão apagando, barra de progresso, diálogo de aprovação com `Liberar` e `Recusar`, barras de gráfico.
- **Diagrama de nós:** nó = círculo `--card-2` com anel parcial `--line-2` e ícone; linhas de 6px `--card-2`; rótulo mono laranja embaixo. O nó que espera uma pessoa leva o ícone de mão.
- **Trilha:** linhas com recuo em árvore, contagem, barra arredondada colorida (verde para passo concluído, violeta para modelo, laranja para gate) e duração alinhada à direita.
- **Caixa tracejada:** borda `1px dashed --accent` com etiqueta mono no canto. Use para o que a Factory guarda ou recusa.
- **Pílulas de ação:** `Entrada`, `Saída`, `Trilha` com borda `--line-2`, raio 999.

## Movimento

Use a Motion (motion.dev), servida pelo próprio servidor em `/motion.js`.

- Revelar ao rolar: `opacity 0→1` e `translateY 18px→0`, 0.7s, `ease [0.22, 1, 0.36, 1]`, atraso de 0.06s por irmão.
- Ícone girando: `✻` em `--accent`, 1.6s linear, para estado em andamento.
- Verbos girando: troca a cada 2.6s com subida e fade; a largura acompanha.
- Fluxo nas linhas do diagrama: um traço que percorre a linha a cada 2.4s.
- Barras da trilha crescem da esquerda ao entrar na tela.
- `prefers-reduced-motion: reduce` desliga tudo. Sem a biblioteca, a página fica inteira e estática.

## Texto

Português, frases curtas, números no lugar de adjetivo. Botão com verbo e seta (`Abrir a Factory →`). Sempre "Factory", nunca "fábrica". O agente conduz, a pessoa decide: escreva o gate como uma pessoa com nome.

## Checagem antes de entregar

- Contraste 4.5:1 em texto nos dois temas; 3:1 em borda de controle e anel de foco.
- Foco visível: `outline 2px solid var(--text)` com `offset 2px`.
- Sem scroll horizontal de 320 a 1440px. Filho direto de grade que tenha `<pre>` ou texto sem quebra leva `min-width: 0`, senão a grade estica (visto na landing, ver `tasks/lessons.md`, lição 002). Meça `scrollWidth` contra `clientWidth` em 320px em vez de olhar a tela.
- Nenhum logo, personagem, ilustração ou texto de outra empresa.
