---
name: instalacao
description: Conduz a instalação da Super Factory para quem não programa. Use quando a pessoa disser instalar, instalação, Node, Terminal, npm, porta 4721, ou colar um erro de instalação. Um passo por vez. Um erro não volta ao começo.
---

# Instalação

Chame a ferramenta `conduzirInstalacao`. Passe o número do passo quando a pessoa disser em qual está. Passe no `relato` o texto que ela colou, sem pedir chave, token ou senha.

Mostre a instrução que a ferramenta devolver. Não junte o passo seguinte. Não mande recomeçar do passo 1 quando o erro for de um passo no meio.

Só libere o passo seguinte depois que a pessoa disser o que apareceu na tela no passo atual. "Deu certo" sem o texto que ela viu não basta para um passo com comando: peça a linha final que o Terminal mostrou.

Quando o mesmo erro aparecer pela segunda vez no mesmo passo, não repita a instrução. Peça o texto completo do erro e passe-o no `relato`.

Se a Factory ainda não está no ar, a pessoa segue a página inicial, na parte Instalar. Quando a Factory abrir, o chat continua do passo em que ela parou.
