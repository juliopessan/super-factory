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
| Evals com rubrica, juiz de outro modelo e matriz de modelos | Lote C |
| "Comentou duas vezes? Vire regra dura" | Lote C |
| Resultado do PR como sinal; custo por PR aceito | Lote C |
| Triagem automática de bug (reproduz e diz "já corrigido na main") | Lote D |
| PRs pequenos e atômicos | Lote D |
| Webhook no lugar da varredura (Fase 4 do plano das integrações) | Lote D |

## Estado

| Lote | Entrega | Estado |
|---|---|---|
| A | Baseline, extras, vermelho→verde, convenções, trilha e ancoragem, revisor com modelo próprio | feito |
| B | Control glass (navegador no sandbox), feature map, prontidão do repositório | feito |
| C | Evals, minerador de regras, resultado do PR | a fazer |
| D | Webhook, triagem automática de bug, orçamento de PR | a fazer |
