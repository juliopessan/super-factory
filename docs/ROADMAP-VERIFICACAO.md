# Verificação e ciclo de feedback

Origem: uma palestra sobre confiar em agentes de código. A tese: confiança vem de **verificação**, não de prompt. Um agente só ganha autonomia quando consegue rodar o app de verdade, observar o resultado e ser medido. Este documento mapeia cada técnica contra a Factory e registra o estado.

Decisões da pessoa que opera a Factory (21/11/2026): navegador no sandbox, **sim**; revisor com modelo de mais raciocínio que o do construtor; implementar o Lote A primeiro e seguir até o fim.

**O que não entra, por desenho:** o merge automático que a palestra descreve como ponto final. Na Factory o merge é de uma pessoa. A alternativa que aproveita a mesma ideia é o **pacote de evidência** por PR (baseline, vermelho→verde, CI, lint, tamanho do diff) para a revisão humana ser rápida.

## Técnica por técnica

| Técnica | Estado |
|---|---|
| Fechar o ciclo: o agente roda o código e observa | Lote A: baseline antes da mudança; lint, typecheck e build como checks; vermelho→verde em bug |
| Convenções do projeto (AGENTS.md) como restrição | Lote A: o repositório clonado é lido e entra no pedido do construtor |
| "Todo modo de falha vira skill": o agente afirma sem ter lido | Lote A: trilha do construtor (o que leu, escreveu e rodou) e auditoria "afirmou sem ler" |
| Juiz de outro modelo | Lote A: o revisor usa `claude-opus-5-5` (ou `SUPER_FACTORY_REVIEWER_MODEL`) |
| Control glass: skill que dirige o app e captura traces e screenshots | Lote B: sobe o app no sandbox, abre no Chromium, lê status/console/requisições e guarda a captura de tela. Ainda não grava trace nem navega por fluxos |
| Feature map: o agente aprende a chegar em cada funcionalidade | Lote B: mapa de pastas, telas, rotas e testes, guardado por repositório e atualizado quando os arquivos mudam. Ainda estático (não aprende com o uso) |
| Prontidão do repositório: guarda-corpos antes de ligar a autonomia | Lote B: `diagnosticarProntidaoGithub` e pontos de atenção no PR |
| Evals com rubrica, juiz de outro modelo e matriz de modelos | Lote C: cards e diffs de ouro no Studio, scorers `triagem` e `revisao`, `npm run evals` com juiz de outro provedor e teto de chamadas. A matriz com modelos reais ainda não foi rodada |
| "Comentou duas vezes? Vire regra dura" | Lote C: `proporRegrasDeComentarios` (só propõe; uma pessoa aprova) |
| Resultado do PR como sinal; custo por PR aceito | Lote C: aceito/ajustado/recusado por PR e tokens por PR mesclado |
| Triagem automática de bug (reproduz e diz "já corrigido na main") | Lote D: reprodução por teste no sandbox, veredito comentado na issue. "Já corrigido" é provável: compara o commit da época da issue com o atual |
| PRs pequenos e atômicos | Lote D: orçamento de linhas e arquivos e proposta de divisão em PRs empilhados (sugestão; não corta sozinha) |
| Webhook no lugar da varredura (Fase 4 do plano das integrações) | Lote D: assinatura HMAC, entrega única, importa issue etiquetada e mede PR fechado. O ciclo de feedback de revisão (comentário humano vira correção do construtor) continua pendente |

## Estado

| Lote | Entrega | Estado |
|---|---|---|
| A | Baseline, extras, vermelho→verde, convenções, trilha e ancoragem, revisor com modelo próprio | feito |
| B | Control glass (navegador no sandbox), feature map, prontidão do repositório | feito |
| C | Evals, minerador de regras, resultado do PR | feito |
| D | Webhook, triagem automática de bug, orçamento de PR | feito |
| E | Cards existentes por ID (ler, editar, mover, duplicatas, reservar, iniciar) e pré-validação do sandbox | feito |
| F | Resultado por critério de aceite e visão por onda | feito |
| G | Teto de custo em tokens (card, onda, dia) | feito |
| H | Projeto em subpasta, Python (`.[dev]`, ruff, versão) e imagem do sandbox com Python 3.13 | feito; ensaio real em [ENSAIO-REAL.md](ENSAIO-REAL.md) |

## Ainda aberto (relato do Chief, 22/11/2026)

- (feito, Lote F) Resultado por critério de aceite e visão por onda. O mapeamento teste→critério é declarado pelo construtor e conferido contra o diff e a suíte; provar que o teste cobre o critério continua com a revisão humana.
- Sincronizar o quadro da Factory com **GitHub Project** e issues (ligar um rascunho do Project a um card executável).
- Paridade com **Azure DevOps** (leituras, transições, vínculos e acompanhamento de PR/CI).
