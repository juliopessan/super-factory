# Integrações: gestão completa do GitHub

Decisões da pessoa que opera a Factory (21/11/2026):

1. **Só GitHub.** O Azure DevOps não entra agora. Por isso não há camada neutra de provedor: seria complexidade sem uso.
2. **Um token só para todas as funções**, com as permissões que cada função pede (`GITHUB_TOKEN`; o Project usa o mesmo se não houver `GITHUB_PROJECT_TOKEN`).
3. **O Chief pode fechar e comentar issues** quando a pessoa pedir.

Continua valendo, por desenho: merge, aprovar PR, force-push, excluir repositório, branch ou issue, release, alterar proteção de branch, secrets e colaboradores são decisões de uma pessoa. Nenhuma ferramenta faz isso.

## Fases

| Fase | Entrega | Estado |
|---|---|---|
| 1. Ver (leitura) | `lerIssueGithub`, `buscarIssuesGithub`, `listarPullRequestsGithub`, `listarMilestonesGithub`, `lerChecksGithub`, `lerProtecaoDeBranchGithub`, `lerAlertasGithub`, `listarProjetosGithub`, `verificarTokenGithub` | feita |
| 2. Fechar o ciclo da demanda | PR referenciando a issue de origem; comentário automático na issue quando o PR abre | a fazer |
| 3. Organizar (escrita reversível) | `editarIssueGithub` (inclui fechar e reabrir com motivo), `comentarIssueGithub`, `gerenciarLabelsGithub`, `definirCampoDoProjeto`, pedir revisão, marcar PR pronto | a fazer |
| 4. Infraestrutura | Webhook com assinatura HMAC no lugar da varredura; ciclo de feedback de revisão (comentário humano vira correção do construtor) | a fazer |

## Um token para tudo: o que ele precisa

Rode `verificarTokenGithub` no chat do Chief (opcionalmente com `owner/repo`): ele diz o que o token já alcança e o que falta, sem mostrar o token.

| Função | Token clássico | Token fine-grained |
|---|---|---|
| Ler repositório, issues, PRs, milestones | `repo` | Contents, Issues, Pull requests: Read |
| Escrever em issues (criar, comentar, fechar, milestone, responsável, labels) | `repo` | Issues: Read and write |
| Ler o CI e o log de falha | `repo` | Actions e Checks: Read |
| Ler alertas de segurança | `security_events` | Dependabot alerts / Code scanning / Secret scanning alerts: Read |
| Ler proteção de branch | administração do repositório (a proteção clássica); os rulesets só pedem leitura | Administration: Read |
| Project de **usuário** | `project` | não cobre (só Project de organização) |
