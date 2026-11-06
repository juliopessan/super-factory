# Super Factory

https://github.com/juliopessan/super-factory

A raiz é a apresentação. O Studio, em `/studio`, é a mesa. Um pedido vira card, passa por triagem, especificação, plano, verificação e revisão, e só segue quando uma pessoa libera os três portões: implementação, merge e release. O ciclo não faz merge, não faz push em `main` ou `master` e não coloca nada em produção.

## Instalar

São sete passos, um de cada vez. A página inicial tem o botão Guia-me: ele aproxima cada passo da instalação e, depois, o portão, o ciclo, o quadro, os papéis e os limites. A parte Instalar diz a mesma coisa. Quando a mesa já estiver aberta, o chat continua do passo em que a pessoa parou: cole o que o Terminal mostrou. Um erro não volta ao começo. Não cole chave, token ou senha.

1. Instale o Node 22.18 ou mais novo, pelo site nodejs.org. No Terminal, `node -v` precisa começar com `v22` nessa faixa, ou com um número maior.
2. Abra o Terminal.
3. Primeira vez: `git clone https://github.com/juliopessan/super-factory.git` e entre na pasta. Se a pasta `super-factory` já existe, não clone de novo. Use `cd ~/super-factory`, `git fetch origin` e `git checkout -B main origin/main`.
4. `npm install`
5. `npm run dev` e deixe essa janela aberta. A linha saudável mostra `4721`.
6. No navegador, abra `http://localhost:4721` e a mesa em `http://localhost:4721/studio`.
7. Chave é opcional. Sem ela, a mesa responde em amostra. O arquivo `.env` fica só na máquina.

`npm run check` confere a fábrica. `npm run build` gera o servidor, e `npm start` sobe essa versão.

## Onde está o código

| Caminho | O que guarda |
| --- | --- |
| `src/super-factory/` | Landing, marca SF, agentes, ferramentas e o workflow `sdlc` |
| `src/factory/` | Quadro, portões, trilha, GitHub e Azure DevOps |
| `src/scripts/check.ts` | Checagem do ciclo, sem shell e sem suíte de produto |
| `factory.json` | Manifesto: estágios, três portões, oito papéis, evidência |

O comando de desenvolvimento aponta para `src/super-factory`.

## Quadro

As colunas são `backlog`, `ready`, `build`, `qa`, `review`, `blocked` e `done`. Pedido claro ou bug com critério observável entra em `ready`. Pedido vago, segredo ou force-push para em `blocked`.

Os oito papéis são Chief of Staff, Architect, Frontend, Backend, Integrations, QA, Security e Docs. Só o Chief of Staff abre card. Security é somente leitura. Nenhum agente registra aprovação.

GitHub e Azure DevOps entram de verdade quando há credencial. Sem credencial, a mesma operação responde em modo simulado e diz isso no resultado.

## Ciclo no Studio

Abra o workflow `sdlc` e preencha:

| Campo | Exemplo |
| --- | --- |
| titulo | Filtro de datas com hora |
| descricao | O filtro da API de pedidos quebra quando a data vem só com o dia. Precisa aceitar intervalo com hora e recusar fim anterior ao início. |
| criterios | Uma condição por linha. Ex.: `O endpoint devolve 400 quando o fim do intervalo é anterior ao início.` |
| provedor | `github` ou `azure-devops` |
| repositorio | GitHub: `owner/repo`. Azure: `projeto` ou `projeto/repositorio`. |
| branchBase | `main` |
| branchHead | Uma branch que já existe, se quiser um pull request rascunho. Vazio só abre o item de acompanhamento. |

O workflow suspende três vezes. Em cada uma, retome com:

```json
{ "aprovado": true, "aprovador": "Joana", "nota": "Pode seguir, sem merge." }
```

`aprovado: false` recusa. Na implementação ou no merge, o card fecha bloqueado. No release, o card fica retido: o item de acompanhamento pode existir, e nada é publicado.

O desfecho `aceito-com-ressalvas` significa que a pessoa aceitou o release e os testes do produto continuam `NOT_RUN`. A fábrica não executa comando de teste, de build nem de shell. Quem roda a suíte é uma pessoa, no repositório, e o resultado fica fora deste ciclo.

## Credenciais

Copie `.env.example` para `.env` só na sua máquina. O arquivo `.env` não entra no repositório.

Sem `GITHUB_TOKEN`, listar ou abrir issue no GitHub devolve a amostra e a nota `Simulado`. Com o token, a chamada vai para `https://api.github.com`. O pull request, quando a branch de origem existe e não é a base, sai como rascunho. Não há endpoint de merge nem de push.

Sem `AZURE_DEVOPS_ORG` e `AZURE_DEVOPS_PAT` juntos, o Azure DevOps fica simulado. Com os dois, work items usam a API em `https://dev.azure.com`. O projeto vem do campo do ciclo. Pull request rascunho só quando esse campo vem como `projeto/repositorio`.

Os identificadores passam por uma lista fechada de caracteres. O token não entra na URL e não é copiado para o relatório.

## Base do projeto

Cada repositório tem a própria base. Ela guarda a regra que uma pessoa daquele cliente ditou: escrita, pastas, branch, evidência, glossário. `lerBaseProjeto` lê. `registrarRegraProjeto` grava, e o autor é o nome dessa pessoa. Um papel da mesa não entra como autor. Base vazia continua vazia: o ciclo segue e ninguém inventa regra de cliente.

`lerPoliticaProjeto` lê a política. Sem página gravada, a autonomia já é entrega humana. `definirPoliticaProjeto` registra a branch protegida e os checks que o cliente nomeou. A fábrica não executa esses checks e não aceita merge automático. `relatarMerge` guarda interpretação, premissas e confiança (`confiante` ou `entrega`). Confiança não aprova o portão `beforeMerge`.

## Skills

As skills ficam em `skills/`, em leitura. O pacote veio do super-board, licença MIT, Copyright 2026 Eric Tech, copiada em `skills/UPSTREAM-LICENSE`. A skill `super-factory` é o contrato desta mesa: os verbos do quadro viram ferramenta ou workflow `sdlc`. Script, shell, merge, force-push e deploy continuam de fora.

## MCP e mesa

O Studio mostra o servidor MCP `super-factory` e a mesa `mesa`, com um modo para cada papel. O servidor fica em `/api/mcp/super-factory/mcp` e expõe as ferramentas, os oito agentes e o workflow `sdlc`. A mesa não tem `submit_plan` nem subagente: uma tarefa concluída nela não é um portão. O modo Security continua só com leitura.

Clientes de fora podem falar com esse endereço. A fábrica não sobe comando local para conectar em outro servidor. Um servidor HTTP adicional entra pelo Studio, na área de MCP, quando alguém cola a URL.

## Agentes

Fale com o Chief of Staff para ver o quadro, abrir um card ou ler a trilha. Um card aberto pelo agente não atravessa os portões: isso só acontece no workflow `sdlc`.

Security responde em leitura. Se o pedido for escrever, ele recusa.

Sem chave de modelo, a mesa local encaminha a frase para a ferramenta certa. Com `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY`, os agentes usam o provedor correspondente. `SUPER_FACTORY_MODEL` troca o modelo, no formato `provedor/modelo`. `FACTORY_MODEL` continua valendo quando o primeiro está vazio.

## O que fica de fora de propósito

- Copiar os textos da Agent Factory. O manifesto em `factory.json` reescreve o núcleo: estágios, três portões humanos, oito papéis, evidência e escritas disjuntas.
- O quadro e a triagem (claro, nebuloso, bug) seguem o modelo operacional do super-board, sob a licença MIT, Copyright 2026 Eric Tech.
- Gerar código no repositório, executar a suíte, fazer merge, force-push ou deploy. O plano aponta donos e caminhos (`src/ui/`, `src/api/`, `src/integrations/`, `docs/`). Se dois donos cobrem o mesmo caminho, o card para.
