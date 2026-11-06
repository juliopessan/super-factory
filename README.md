# Super Factory

https://github.com/juliopessan/super-factory

O Studio é a mesa. Um pedido vira card, passa por triagem, especificação, plano, verificação e revisão, e só segue quando uma pessoa libera os três portões: implementação, merge e release. O ciclo não faz merge, não faz push em `main` ou `master` e não coloca nada em produção.

## Clonar

É preciso Node `22.18` ou mais recente.

```bash
git clone https://github.com/juliopessan/super-factory.git
cd super-factory
npm install
npm run dev
```

O Studio sobe na porta `4721`. `npm run check` confere tipos e a checagem da fábrica. `npm run build` gera o servidor, e `npm start` sobe essa versão.

O quadro usa as colunas `backlog`, `ready`, `build`, `qa`, `review`, `blocked` e `done`. Pedido claro ou bug com critério observável entra em `ready`. Pedido vago, segredo ou force-push para em `blocked`.

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

## O que cada modo faz

Sem `GITHUB_TOKEN`, listar ou abrir issue no GitHub devolve a amostra e a nota `Simulado`. Com o token, a chamada vai para `https://api.github.com`. O pull request, quando a branch de origem existe e não é a base, sai como rascunho. Não há endpoint de merge nem de push.

Sem `AZURE_DEVOPS_ORG` e `AZURE_DEVOPS_PAT` juntos, o Azure DevOps fica simulado. Com os dois, work items usam a API em `https://dev.azure.com`. Pull request rascunho só quando o campo vem como `projeto/repositorio`.

Os identificadores passam por uma lista fechada de caracteres. O token não entra na URL e não é copiado para o relatório.

## Agentes

Fale com o Chief of Staff para ver o quadro, abrir um card ou ler a trilha. Um card aberto pelo agente não atravessa os portões: isso só acontece no workflow `sdlc`.

Security responde em leitura. Se o pedido for escrever, ele recusa.

Sem chave de modelo, a mesa local encaminha a frase para a ferramenta certa. Com `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` ou `GOOGLE_API_KEY`, os agentes usam o provedor correspondente. `FACTORY_MODEL` troca o modelo, no formato `provedor/modelo`.

## O que fica de fora de propósito

- Copiar os textos da Agent Factory. O manifesto em `factory.json` reescreve o núcleo: estágios, três portões humanos, oito papéis, evidência e escritas disjuntas.
- O quadro e a triagem (claro, nebuloso, bug) seguem o modelo operacional do super-board, sob a licença MIT, Copyright 2026 Eric Tech.
- Gerar código no repositório, executar a suíte, fazer merge, force-push ou deploy. O plano aponta donos e caminhos (`src/ui/`, `src/api/`, `src/integrations/`, `docs/`). Se dois donos cobrem o mesmo caminho, o card para.
