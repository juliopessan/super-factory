# Roadmap da Super Factory

Levantamento de novembro de 2026, a partir da documentação do Mastra (docs, models, integrations, reference e Mastra platform) e do Mastra Factory, o produto oficial de "software factory" do Mastra.

## Onde a Super Factory está

| Já tem | Como |
| --- | --- |
| Ciclo governado | Workflow `sdlc`: triagem, especificação, plano, verificação, revisão, entrega, com 3 gates humanos com nome, decisão e nota |
| Oito papéis | Agentes com caminhos de escrita separados; Security só lê |
| Evidência honesta | Testes do produto ficam `NOT_RUN`; PASS só com observação |
| Provedores | GitHub e Azure DevOps, ao vivo com credencial e simulados sem ela; PR só em rascunho |
| Harness | Aprovação nas escritas externas, retry, limite de contexto, guarda na saída, segredo fora do banco |
| Base do projeto | Regras do cliente com autor humano; política de entrega humana |
| Studio, MCP e skills | Studio com marca própria, servidor MCP, 12 skills, incluindo `factory-ui` |
| Qualidade | `npm run check` e `npm run e2e` (29 checagens) |

## Comparação com o Mastra Factory

| Mastra Factory | Super Factory |
| --- | --- |
| Intake automático de issues do GitHub, Linear, Jira, GitLab e incident.io | Card aberto à mão, pelo chat ou pelo workflow |
| Board de Work e board de Review separados; PR ganha card próprio | Um card só, sem review de PR |
| Agente implementa num sandbox, roda os checks e abre o PR | Não executa comando nem escreve código, de propósito |
| Gates: aceitar a tarefa, aprovar o plano e o merge pelo processo do repositório | Gates de implementação, merge e release, com aprovador e nota |
| Sessão por item, com conversa, ferramentas e arquivos | Trilha por card e chat por agente |
| Roda no Mastra platform, com login, banco e sandbox gerenciados | Roda local, sem login, com libSQL em arquivo |

A diferença de fundo é escolha, não atraso: a Super Factory governa e documenta, e uma pessoa roda o código. O roadmap mantém essa linha e fecha o que falta para uso em time.

## O que falta, por prioridade

Tamanho: P (até 1 dia), M (alguns dias), G (uma semana ou mais).

### Agora

1. **CI no GitHub (P).** Nenhum PR roda checagem hoje. Um GitHub Actions com `npm ci`, `npm run check` e `npm run e2e` (Playwright) em todo PR para o `main`.
2. **Aviso de gate pendente (M).** Um gate parado ninguém vê. Ao suspender, avisar quem decide por webhook, e-mail ou Slack (no Mastra: Channels com SlackProvider, ou WebhookSignalProvider). O aviso leva card, gate e link para retomar.
3. **Intake de issues (M).** Importar issues abertas do GitHub e do Azure DevOps como cards no `backlog`, sem duplicar, já passando pela triagem. Linear e Jira depois, pelas integrações de project management do Mastra.

### Em seguida

4. **Review de PR, só leitura (M).** Card de Review separado, como no Mastra Factory: ler o diff e os checks do PR pela API; Security e QA registram achados; nenhum agente aprova. O gate de merge passa a considerar esses achados.
5. **Evals com datasets (M).** Um dataset de pedidos (claro, vago, com segredo, com force-push, bug) e os scorers prontos de Tool Call Accuracy e Trajectory Accuracy, além dos 3 próprios. Rodar no CI para pegar regressão de comportamento dos agentes.
6. **Login no Studio (M).** Pré-requisito para abrir a Factory para o time. O Mastra integra Better Auth, Clerk, WorkOS, Auth0, Okta, Supabase e JWT. Até lá, o padrão segue `localhost`.

### Depois

7. **Deploy e banco gerenciado (G).** `mastra deploy` no Mastra platform, ou um container próprio, com ambientes `staging` e `production`, e Postgres ou Turso no lugar do arquivo `factory.db`. Exportar traces com `MastraPlatformExporter` ou OpenTelemetry (Langfuse, Datadog, Sentry).
8. **Memória por projeto (M).** Working Memory ou Observational Memory para o Chief of Staff lembrar decisões e contexto de cada repositório, além das últimas 12 mensagens.
9. **Rotinas agendadas (P).** Com Schedules do Mastra: revisão diária do backlog e lembrete de gates parados há mais de um dia.
10. **ACP (P).** Expor o Chief of Staff pelo Agent Client Protocol, para conversar com a Factory de dentro do editor, ao lado do MCP que já existe.

## Decidido em novembro de 2026

- **Modo autônomo com sandbox Docker.** A Super Factory evolui (não adota o Mastra Factory, que não tem Azure DevOps) e ganha o workflow `autonomo`: triagem, container Docker por card, agente construtor com Claude, testes do repositório e pull request pronto para revisão. Uma pessoa decide só no merge. Roda no Mac (Docker Desktop ou Colima) e em servidor Linux.

## Fora, por decisão

- **Executar código fora do sandbox.** No modo autônomo, código e testes rodam só no container do card. Na máquina de quem opera e em produção, nada roda.
- **Merge automático e deploy automático.** Continuam com uma pessoa.
- **Troca automática de provedor de modelo.** Saiu porque o Studio esconde o seletor de provedor quando o modelo é uma lista. Volta se o Mastra passar a mostrar o seletor nesse caso.
