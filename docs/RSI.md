# Melhoria recursiva (RSI) na Factory

A técnica: um **Worker** faz a tarefa, um **Improver** avalia o resultado e propõe uma mudança de abordagem, o Worker refaz, e se o novo jeito é **de fato melhor** ele passa a ser o jeito do Worker dali em diante. Repetir.

Na literatura se separa a RSI **fraca** (laços de otimização estreitos, ainda guiados por pessoas) da **forte** (um sistema que projeta sucessores mais capazes sem ninguém no circuito). A Factory implementa a **fraca, de propósito**. A regra do projeto é que o merge, o deploy e qualquer mudança de regra são de uma pessoa; um sistema que reescreve as próprias regras sozinho contradiz isso.

## Os dois laços

### 1. Dentro do card (Worker ↔ Improver)

Liga com `SUPER_FACTORY_MELHORIA=sim` (`SUPER_FACTORY_MELHORIA_RODADAS`, 1 por padrão, no máximo 2). Desligada por padrão: custa um Improver e uma tentativa a mais por card que tenha o que melhorar, e antes de ligar convém ter uma linha de base (ver "Como saber se ajuda").

```
Worker (construtor) escreve e os testes rodam
  → a Factory MEDE: pontuação e fraquezas (só evidência observada)
  → Improver (modelo do revisor, sem ferramentas) propõe UMA mudança de abordagem
  → foto do código (commit provisório) → Worker refaz com a proposta
  → a Factory MEDE de novo
  → pontuou mais E os testes seguem verdes?  sim: fica   não: volta ao código da foto
```

- **A pontuação não é opinião de modelo.** Soma testes verdes (40), vermelho→verde (±15), critérios com teste apontado e suíte verde (até 30), lint/typecheck/build (+5 cada; −10 se regrediu), app abrindo (+5), menos 3 por nota de ancoragem do construtor (até 3). Teste vermelho nunca é melhoria, por mais pontos que tenha. Empate não é melhoria.
- **O que o Improver enxerga**: o card, a pontuação com o detalhe, as fraquezas medidas (critério sem teste apontado, bug sem prova de reprodução, lint que regrediu) e o que o Worker *disse* que fez, marcado como relato e não prova. Texto de terceiros é dado: ele não segue instruções escritas ali.
- **Custo no teto**: o Improver e a rodada entram no teto de tokens do card e do dia. Teto já gasto: a rodada nem começa.
- **No PR**: seção "Melhoria (Improver)" com a pontuação de cada rodada, a proposta e se foi adotada ou descartada.
- Se a rodada falha (Improver fora do ar, Worker com erro, teto), é descartada e o card segue com o resultado que já tinha. Se o código não volta ao lugar, o card para em vez de seguir pela metade.

### 2. Entre cards (lições para o construtor)

A Factory olha as execuções e propõe **lições**: uma linha de "como trabalhar aqui". Exemplos que ela mesma sabe propor, cada um só acima de um limiar de amostra:

| Sinal observado | Lição proposta |
|---|---|
| ≥ 30% dos critérios sem teste apontado | Escreva ao menos um teste por critério e aponte-o com `CRITERIO n: arquivo` |
| ≥ 2 bugs sem prova de reprodução | Em bug, escreva primeiro o teste que reproduz o defeito |
| ≥ 2 execuções escreveram sem ler | Leia o arquivo antes de alterá-lo |
| ≥ 2 disseram que os testes passam sem rodar | Rode o teste antes de afirmar |
| ≥ 40% dos PRs ajustados por pessoas | Compare com o estilo do código à volta |
| ≥ 2 PRs acima do orçamento de tamanho | Faça a menor mudança que cumpra os critérios |

O caminho: `proporLicoes` (com a evidência) → **uma pessoa aprova com `decidirLicao`, em nome dela** → a lição entra no pedido do construtor → `lerLicoes` mostra a pontuação média **antes e depois** da aprovação → se piorou, recomenda retirar (uma pessoa retira).

Travas:

1. Só uma pessoa aprova. O autor é o nome dela; papéis da Factory ("Chief", "agent", "Claude"…) são recusados.
2. O texto passa por um filtro que recusa lição que mexa em guarda: merge, aprovação, deploy, push, segredo, token, teste desligado, "ignore", links. Um estado adulterado não burla: o filtro roda de novo na aprovação.
3. Lição vale **junto** das regras de segurança do construtor, nunca no lugar delas (o pedido diz isso).
4. No máximo 8 lições aprovadas por escopo: instrução demais dilui todas.

## Limites honestos

- **"Melhorou" é tão bom quanto a pontuação.** Há Goodhart: o critério "PASS" depende de o construtor apontar o teste, e ele pode aprender a apontar sem provar. Por isso a evidência diz "cobertura declarada" e a revisão humana continua sendo quem confirma. A pontuação reflete o que o sandbox consegue observar, não qualidade de código.
- **Antes/depois é correlação.** Cards diferentes têm dificuldades diferentes; com menos de 3 execuções depois da aprovação a Factory não conclui. É um sinal para uma pessoa decidir, não um veredito.
- **As lições são geradas por regras, não por um modelo.** O único modelo novo é o Improver do laço interno. Dá para somar um analisador por modelo depois, mantendo a aprovação humana.
- **Nada disso foi exercitado com modelo real.** Os testes simulam o Worker e o Improver. O Improver real e a adoção de lições precisam do ensaio.

## Como saber se ajuda (fazer antes de confiar)

1. Rode o ensaio real **sem** a melhoria (`docs/ENSAIO-REAL.md`) e guarde `lerOnda` e `lerCusto`: é a linha de base.
2. Ligue `SUPER_FACTORY_MELHORIA=sim` e rode **os mesmos cards** de novo (num fork limpo ou em issues novas iguais).
3. Compare por card: pontuação (o card mostra "Melhoria: antes → depois"), critérios PASS, tokens. A melhoria vale a pena se a pontuação sobe de forma consistente por um custo em tokens que você aceita. Se só gasta, desligue.

## O que fica de fora, por desenho

- A Factory **não aprova** lição, **não mescla** e **não altera suas próprias travas** (teto, orçamento de PR, gate do merge, redação de segredos). Isso exigiria RSI forte, sem pessoa no circuito.
- O Improver não escreve código e não tem ferramenta.
