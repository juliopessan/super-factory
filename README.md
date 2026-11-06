# Super Factory

https://github.com/juliopessan/super-factory

A raiz é a apresentação. O Studio, em `/studio`, é a mesa. Um pedido vira card, passa por triagem, especificação, plano, verificação e revisão, e só segue quando uma pessoa libera os três portões: implementação, merge e release. O ciclo não faz merge, não faz push em `main` ou `master` e não coloca nada em produção.

## Rodar

É preciso Node `22.18` ou mais recente.

```bash
git clone https://github.com/juliopessan/super-factory.git
cd super-factory
npm install
npm run dev
```

Se a pasta `super-factory` já existe, não clone de novo. Atualize a branch e instale:

```bash
cd super-factory
git fetch origin
git checkout -B main origin/main
npm install
npm run dev
```

O servidor sobe na porta `4721`. Abra a landing em `/` e a mesa em `/studio`. `npm run check` confere tipos e a checagem da fábrica. `npm run build` gera o servidor, e `npm start` sobe essa versão. `npm install` gera o `package-lock.json` quando ele ainda não está no clone.

## Cofre local no Windows

O cofre requer PowerShell 7 (`pwsh`) e protege credenciais com o DPAPI do Windows, vinculadas ao usuário e ao computador atuais. Os arquivos criptografados ficam em `%LOCALAPPDATA%\SuperFactory\cofre`, fora do repositório. Ele é para uso local; não compartilha segredos entre usuários, máquinas ou implantações.

No PowerShell, cadastre uma credencial sem exibi-la na tela ou passá-la como argumento:

```powershell
npm run cofre -- definir GITHUB_TOKEN
```

O comando solicita o valor de forma oculta. Os nomes aceitos são `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GITHUB_TOKEN` e `AZURE_DEVOPS_PAT`. Use `npm run cofre -- listar` para verificar quais estão salvos e `npm run cofre -- remover GITHUB_TOKEN` para excluir um deles.

Para carregar o cofre, inicie o Studio com `npm run dev:cofre`. Reinicie o Studio depois de cadastrar, alterar ou remover credenciais. O `GITHUB_TOKEN` salvo no cofre tem precedência sobre a variável herdada; para as outras credenciais, variáveis de ambiente já definidas têm precedência. `AZURE_DEVOPS_ORG` continua sendo configurada como variável de ambiente. Os segredos carregados ficam disponíveis ao processo do Studio e aos processos que ele iniciar. O Studio não oferece autenticação e escuta em todas as interfaces, portanto use-o somente em uma rede confiável.

`npm run check:cofre` verifica o cofre com uma credencial fictícia, sem modificar as credenciais salvas.

## Onde está o código

| Caminho | O que guarda |
| --- | --- |
| `src/super-factory/` | Landing, marca SF, agentes, ferramentas e o workflow `sdlc` |
| `src/factory/` | Quadro, portões, trilha, GitHub e Azure DevOps |
| `src/scripts/check.ts` | Checagem do ciclo, sem shell e sem suíte de produto |
| `factory.json` | Manifesto: estágios, três portões, oito papéis, evidência |

O comando de desenvolvimento aponta para `src/super-factory`. A pasta antiga `src/mastra` não faz parte deste repositório.

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
