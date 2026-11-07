---
name: super-factory
description: Contrato da Super Factory sobre as skills do super-board. Use quando o pedido citar super-board, onboard, lint, status, run, stop, onda, quadro, QA ou review. Mapeia esses verbos para as ferramentas da Factory e recusa shell, merge, force-push e deploy.
---

# Super Factory

As skills em `skills/` vieram do repositório super-board, licença MIT, Copyright 2026 Eric Tech. O texto delas descreve um loop autônomo com workers, worktrees e scripts. Nesta Factory esse loop não roda.

## O que vale aqui

| Verbo do super-board | Nesta Factory |
| --- | --- |
| status | ferramenta `statusQuadro` |
| lint | ferramenta `lintarCriterios` |
| run | no máximo a onda de `planejarOnda` e o workflow `sdlc` |
| stop | leia a trilha com `lerLedger` e pare. Não mate processo. |
| onboard | leia o manifesto com `validarManifesto`. Não grave config de worker. |

O ciclo com pausa humana é só o workflow `sdlc`. Ele suspende em implementação, merge e release. Quem retoma é uma pessoa, com aprovado, aprovador e nota.

## O que não executa, sem shell

- Script, shell, `claude -p`, `codex exec`, worktree ou dispatcher.
- Merge, force-push, commit direto em `main` ou `master`, deploy.
- Transformar `NOT_RUN` em PASS. Teste de produto fica `NOT_RUN` até uma pessoa rodá-lo fora da Factory.
- Aprovação de gate por agente, inclusive no modo Security, que é somente leitura.

Se uma skill vendida pedir um desses passos, registre o limite e siga o contrato desta skill.
