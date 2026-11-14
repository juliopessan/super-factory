# Lessons Learned — skills da Super Factory

_Última atualização: 2026-11-14_
_Lições totais: 3 | Resolvidas: 3 | Regressões: 0_

Como usar: leia este arquivo no começo de uma sessão que mexa em `skills/`, `src/scripts/e2e.ts` ou na landing. Depois de uma correção, acrescente uma lição com este formato. Uma lição sem regra concreta não entra.

---

## Lesson 001 [2026-11-08]: e2e conferia a mensagem antes dela aparecer
**Erro:** `waitlist: formulário vazio é recusado com mensagem` falhava de forma intermitente. O teste clicava em `#enviar` e lia `#msg` na hora.
**Causa Raiz:** A mensagem chega depois de uma chamada assíncrona. A leitura corria contra a renderização.
**Regra:** Em e2e, depois de uma ação que dispara rede, espere o elemento ou o texto esperado (`locator(...).waitFor`) antes de conferir. Nunca leia o resultado logo após o clique.
**Aplica-se a:** `src/scripts/e2e.ts` e qualquer teste de navegador. Commit `5441339`.

## Lesson 002 [2026-11-07]: scroll horizontal da landing no celular
**Erro:** A landing rolava na horizontal em 390px (grade esticada a 635px) e os botões do topo não cabiam em 320px.
**Causa Raiz:** Um bloco `<pre>` com JSON largo dentro de um item de grid. Item de grid tem `min-width: auto` e cresce com o conteúdo. Os três botões do topo não tinham regra para tela estreita.
**Regra:** Filho direto de grid que contenha `<pre>` ou texto sem quebra leva `min-width: 0`. Toda tela nova passa pela checagem de 320px antes de ser entregue (já listada em `factory-ui`).
**Aplica-se a:** `src/super-factory/landing.ts`, `landing-en.ts` e qualquer página nova. Commit `d02062a`.

## Lesson 003 [2026-11-14]: pasta `undefined/` versionada na raiz
**Erro:** `undefined/logo4x.png` foi commitado e nada no repo o referencia.
**Causa Raiz:** Entrou junto do commit `5690d40` (modo autônomo, ensaio e marca branca). O nome literal `undefined` indica caminho montado com variável vazia. A origem exata não foi confirmada.
**Regra:** Antes de commitar, olhe `git status` por pastas com nome `undefined`, `null` ou `[object Object]`. O `git-sync` já exige listar o que ficou fora do commit. Apague o arquivo só depois de confirmar com quem o criou.
**Aplica-se a:** qualquer script que grave arquivo a partir de caminho dinâmico.
**Pendente:** decidir se `undefined/logo4x.png` sai do repo. Nada foi apagado.

---
