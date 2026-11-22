<p align="center">
  <a href="docs/motion/super-factory-hero.mp4" title="Assistir ao vídeo completo (45 s)">
    <img src="docs/motion/super-factory-hero.webp" alt="Vídeo de apresentação da Super Factory: Programming is dead. Engineering is not. Um card vira pull request, com evidência, e você decide o merge." width="100%" />
  </a>
  <br />
  <sub><a href="docs/motion/super-factory-hero.mp4">▶ Assistir ao vídeo completo (45 s, com som)</a> · <a href="docs/img/landing.png">ver a página inicial</a></sub>
</p>

# Super Factory

**A programação morreu. A engenharia não.**

*A factory que constrói factory: do Azure DevOps ou do GitHub ao pull request. Você decide o merge.*

A Super Factory lê a demanda (uma issue do GitHub que você etiquetou, um work item do Azure DevOps ou um pedido no chat), organiza o trabalho no GitHub (milestone, responsável, labels e Project), implementa num container Docker descartável, roda os testes do seu repositório e abre o pull request pronto para revisão. O PR volta para a issue de origem, um agente revisor comenta nele e **uma pessoa revisa e faz o merge**. A Factory não faz merge, não aprova nem fecha pull request, não faz push em `main` ou `master` e não coloca nada em produção.

A gestão do dia a dia (ler, organizar, comentar e fechar issues, milestones, labels e Projects) é do GitHub. O Azure DevOps cobre ler e criar work item e abrir o pull request do modo autônomo.

Para quem prefere aprovar a entrega antes de abrir o pull request, o workflow `sdlc` segue disponível, com um só gate humano: o do merge.

[Comece em 7 passos](#7-passos-para-ver-com-os-próprios-olhos) · [Modo autônomo](#modo-autônomo-do-pedido-ao-pull-request) · [Siga um pedido](#um-pedido-do-começo-ao-fim) · [Uma semana com a Factory](#uma-semana-com-a-factory) · [O que ela recusa](#o-que-a-factory-se-recusa-a-fazer)

---

## O que a Factory faz hoje

| Etapa | O que a Factory faz | Detalhes |
| --- | --- | --- |
| **Escolher** | Importa as issues que você etiquetou e cria um card para cada uma. Sem critério observável, o card nasce bloqueado, com o motivo. | [Gatilho de issues](#gatilho-de-issues) |
| **Organizar** | Cria milestone, atribui responsável, mexe em labels, cria o Project e seus campos (Prioridade, Estimativa, Prazo). Comenta e fecha issues quando você pede. | [Gestão do GitHub](#gestão-do-github) |
| **Conferir** | Lê issues, pull requests, o CI (com o passo que falhou e o fim do log), a proteção de branch, os alertas de segurança e o alcance do token. | [Ler o GitHub](#ler-o-github-um-token-só-para-tudo) |
| **Implementar** | Um container por card (Node ou Python), baseline, testes, lint, typecheck e build do seu repositório, vermelho→verde em bug, épicos em PRs empilhados, até 5 cards ao mesmo tempo. | [Modo autônomo](#modo-autônomo-do-pedido-ao-pull-request) |
| **Entregar** | O PR referencia a issue de origem e a Factory avisa nela. O PR Review comenta o PR: só comenta, nunca aprova. | [O ciclo fechado](#da-issue-ao-pull-request-o-ciclo-fechado) · [Revisão](#revisão-automática-de-pull-request) |
| **Decidir** | **Merge, deploy, fechar ou aprovar PR: uma pessoa.** | [O que a Factory se recusa a fazer](#o-que-a-factory-se-recusa-a-fazer) |
| **Acompanhar** | Quadro por coluna, métricas de entrega, time animado e o motivo de cada parada. | [Acompanhar o trabalho](#acompanhar-o-trabalho) |
| **Conversar** | Menu `/` e `@`, verbos e segundos enquanto o agente trabalha e a próxima etapa sugerida no campo de texto (Tab). | [Conversar com o time](#conversar-com-o-time) |

---

## Manifesto

- **A programação morreu.** Escrever código virou a parte barata. Um agente faz em minutos o que levava dias.
- **A engenharia não.** Critério de aceite, arquitetura, risco e evidência continuam sendo trabalho de gente. É isso que a Factory protege.
- **Evidência antes de confiança.** Cada pull request traz o teste que rodou, o código de saída e o que ficou de fora.
- **Você decide o merge.** A Factory abre o pull request. Quem responde pelo que entra no produto é uma pessoa.

## O problema

Agentes de código ficaram rápidos. Em minutos eles leem o pedido, escrevem a mudança e abrem o pull request. A pergunta que sobra é outra: **quem decidiu que aquilo podia ir para a branch principal?**

Na maioria dos fluxos, a resposta é ninguém. Um teste que nunca rodou vira "passou". Um token colado no pedido acaba num log. Um "pode mandar" vago vira merge. A velocidade é real, e o julgamento some junto com o atrito.

## A virada: o gate

A Super Factory parte de uma regra simples: **evidência antes de confiança.**

Os agentes fazem o trabalho que dá para observar: triagem, especificação, plano, checks internos, issue e pull request em rascunho. Mas há uma decisão que é sempre de uma pessoa: o merge. O gate só abre com o nome dela, a decisão e uma nota:

```json
{ "aprovado": true, "aprovador": "Joana", "nota": "Pode seguir, sem merge." }
```

Nenhum agente preenche isso. Nenhum papel aprova gate. O que entra no repositório passa por uma pessoa, no merge. Tudo antes dele os agentes fazem sozinhos, sem pedir permissão a cada passo.

## Um pedido, do começo ao fim

Segunda-feira de manhã. A Joana abre a Factory com um problema concreto:

> **Filtro de datas com hora.** O filtro da API de pedidos quebra quando a data vem só com o dia. Precisa aceitar intervalo com hora e recusar fim anterior ao início.
>
> *Critério:* o endpoint devolve 400 quando o fim do intervalo é anterior ao início.

**1. Triagem.** O Chief of Staff, único papel que abre card, lê o pedido. Tem critério observável, então o card entra em `ready`. Se o pedido fosse vago, trouxesse um segredo ou pedisse force-push, iria direto para `blocked`.

**2. Especificação.** O pedido vira especificação registrada. Nada no repositório muda.

**3. Primeiro gate: implementação.** O ciclo suspende. A Joana lê a especificação e libera.

**4. Plano.** O Architect separa donos e caminhos: Frontend escreve em `src/ui/`, Backend em `src/api/`. Se duas fatias cobrissem o mesmo lugar, o card pararia.

**5. Verificação e revisão.** Os checks internos registram o que foi observado. O teste do produto fica `NOT_RUN`, porque a Factory não executa shell, build nem suíte, e não finge que executou. Security, somente leitura, procura segredo, push protegido e gate furado.

**6. Segundo gate: merge.** O ciclo suspende de novo. A Joana libera o acompanhamento, e não um merge: a Factory não tem endpoint de merge.

**7. Entrega.** A Factory abre a issue no GitHub ou o work item no Azure DevOps e, se existir uma branch de trabalho, um pull request **em rascunho**.

**8. Terceiro gate: release.** A Joana aceita o release. O desfecho é `aceito-com-ressalvas`: o release foi aceito e os testes do produto continuam com quem opera o repositório. Se ela recusasse, o card ficaria `retido` e nada seria publicado.

No fim, o relatório fecha com contexto, critérios, donos, evidência, gates e o próximo passo. Cada passo deixou uma linha na trilha.

### O quadro

| Coluna | Quando o card está aqui |
| --- | --- |
| `backlog` | Ainda não foi triado |
| `ready` | Pedido claro ou bug com critério observável |
| `build` · `qa` · `review` | Em andamento no ciclo |
| `blocked` | Pedido vago, segredo, force-push ou gate recusado |
| `done` | Ciclo fechado |

Cada onda leva no máximo 5 cards prontos, sem dois mexendo no mesmo lugar.

### Os oito papéis

O ciclo `sdlc` tem oito papéis. O modo autônomo acrescenta dois agentes: o **Construtor**, que escreve o código no container, e o **PR Review**, que comenta o pull request.

| Papel | O que faz | Onde atua |
| --- | --- | --- |
| Chief of Staff | Abre o card, importa issues, organiza o GitHub (milestone, responsável, labels, Project), comenta e fecha issues quando você pede, dispara a onda | Quadro e GitHub |
| Architect | Separa donos e caminhos | Plano |
| Frontend | Dono da fatia de UI: lê e opina; quem escreve o código é o Construtor | `src/ui/` |
| Backend | Dono da fatia de API: lê e opina; quem escreve o código é o Construtor | `src/api/` |
| Integrations | Lê e organiza o GitHub e o Azure DevOps, abre issue ou work item; não faz merge | GitHub, Azure DevOps |
| QA | Lê a evidência e o CI; não transforma `NOT_RUN` em `PASS` | Só lê |
| Security | Procura segredo, push protegido e gate furado; lê os alertas de segurança e a proteção da branch | Só lê |
| Docs | Diz o que foi observado e o que ficou de fora | Relatório |
| Construtor (autônomo) | Escreve o código e os testes no container do card | Só o sandbox |
| PR Review (autônomo) | Lê o PR e o CI e deixa uma revisão como comentário; nunca aprova | Só comenta |

## Uma semana com a Factory

A história da Joana acima mostra o ciclo com gates (`sdlc`). Na prática, a maior parte do trabalho segue o modo autônomo, a partir das issues que o time já tem no GitHub. Esta é uma terça-feira típica, do backlog ao merge. Cada passo existe como ferramenta do Chief of Staff; as seções de referência, mais abaixo, explicam cada uma.

**1. Ela escolhe o que entra.** A Joana etiqueta três issues de um projeto Python de edição de vídeo com `super-factory` no GitHub. Etiquetar exige permissão de triagem no repositório: é a decisão dela. Quem só abriu a issue não faz a Factory trabalhar.

**2. O backlog vira cards.** No chat do Chief: "importe as issues etiquetadas de acme/editor-de-video". Cada issue vira um card. A que tem critério observável vai para `ready`; a que não tem nasce `blocked`, com o motivo. Nada roda ainda: o texto da issue é dado de terceiros, e iniciar o trabalho é um pedido dela.

**3. Ela organiza o trabalho.** "Crie o milestone Beta, vencendo em 15/12, ponha as três issues nele e atribua a mim. Crie o Project Backlog com o campo Prioridade (P1, P2, P3) e coloque as P1 em Todo." O Chief cria o milestone e o Project sem duplicar o que já existe, atribui (acrescenta, sem tirar ninguém) e preenche os campos. Enquanto ele trabalha, uma linha acima do campo de texto mostra `✻ Criando o Project… (8s)`, e a resposta termina com o tempo gasto.

**4. Ela confere o terreno antes de rodar.** "A branch principal exige pull request? O CI está verde? Há algum alerta de segurança aberto?" O Chief lê a proteção da branch, o CI (com o passo que falhou e o fim do log) e os alertas. Se uma leitura ou uma escrita falhar por permissão, `verificarTokenGithub` diz qual permissão falta no token, que é um só para tudo.

**5. A onda.** "Inicie a onda com #2, #3 e #4; a #4 depende da #2; peça a revisão." (Quando o Chief oferece a onda, o campo de texto já sugere essa resposta em cinza, e Tab preenche.) Cada card ganha um container descartável, uma branch e um pull request. A #2 e a #3 rodam ao mesmo tempo; a #4 espera a #2 e abre o PR empilhado sobre a branch dela. Repositórios Python rodam na imagem de sandbox com Python (`unittest` ou `pytest`).

**6. Cada PR volta para a issue.** O PR referencia a demanda: `Closes #2` quando os testes passaram, `Refs #4` quando é rascunho ou empilhado. A Factory comenta na issue, uma vez só, com o link do PR e o resultado dos testes. O PR Review comenta em cada PR: resumo, achados por severidade e a situação de cada critério de aceite. Só comenta: nunca aprova.

**7. Algo falha, e a causa aparece.** O PR da #3 saiu como rascunho. "Por que o CI da #3 falhou?" O Chief mostra o passo `npm test` e o fim do log. Se o sandbox não tiver uma ferramenta (`pip`, `ffmpeg`), o card diz que a imagem do sandbox é que precisa de ajuste, e como.

**8. Ela decide.** A Joana pede a revisão de um colega (só aos logins que ela cita), tira o rascunho quando o CI fica verde e faz o merge **ela mesma**, de baixo para cima. O merge da #2 fecha a issue, por causa do `Closes`. A issue que não vai entrar, ela pede ao Chief que feche como `not_planned`, com um comentário explicando.

**9. Ela acompanha.** O Quadro, no Studio, mostra os cards por coluna, a onda, o desfecho e o link de cada PR. A faixa de métricas traz execuções, pull requests abertos, tempo mediano até o PR e tokens por card.

Em nenhum momento a Factory fez merge, aprovou ou fechou um pull request, apagou issue ou branch, mexeu em proteção de branch ou colocou algo em produção. Isso continua sendo de uma pessoa.

> **Estado de validação.** Este roteiro está coberto por testes com GitHub e sandbox simulados (`npm run check` e `npm run e2e`). A primeira execução real do modo autônomo com a imagem de sandbox com Python e as ferramentas de escrita do GitHub, contra o GitHub de verdade, acontece na sua VPS. Se algo vier diferente do que está descrito aqui, é defeito do código, e o conserto vem antes de a descrição mudar.

## Modo autônomo: do pedido ao pull request

Os dois workflows têm uma só decisão humana, o merge. O `sdlc` para uma vez, antes de abrir o pull request. O `autonomo` segue sozinho até o pull request, e a pessoa decide ao revisar:

1. **Triagem.** A mesma regra do `sdlc`: pedido vago, segredo ou force-push param o card antes de qualquer código.
2. **Sandbox.** A Factory abre um container Docker descartável para o card e clona o repositório do GitHub ou do Azure DevOps na branch base. A branch de trabalho é `factory/<card>-<título>`, nunca `main` nem `master`.
3. **Implementação.** O agente construtor (Claude) lê o código, escreve a mudança e os testes, e roda o teste do próprio repositório (`npm`, `pnpm`, `yarn`, `dotnet`, `go`, Python com `unittest` ou `pytest`, ou `make`). Se o teste falhar, ele tenta mais uma vez com a falha na mão.
4. **Evidência.** O check `testes-no-sandbox` guarda o comando, o código de saída e o fim da saída. É PASS ou FAIL observado, não relato.
5. **Pull request.** Antes do push, a Factory confere se o diff não traz segredo. Com testes passando, o PR sai pronto para revisão; com falha, sai como rascunho, com a falha na descrição. Se o pedido veio de uma issue, o PR a referencia (`Closes #N` ou `Refs #N`) e a Factory comenta nela.
6. **Revisão (opcional).** Com `revisar: true`, o agente PR Review comenta cada PR da onda. Só comenta: nunca aprova.
7. **Merge.** Fica com uma pessoa, pelo processo normal do repositório. A Factory não tem endpoint de merge nem de deploy.

**Segurança do sandbox.** Um container por card, destruído no fim. Sem privilégios extras (`cap-drop ALL`, `no-new-privileges`), com limite de processos, de memória e de tempo por comando. O token do repositório não fica no container: entra só no clone e no push, e nenhuma saída o mostra. O agente não tem `git push`, não lê credencial e não executa script baixado direto no shell.

**Para rodar.** Docker ativo (Docker Desktop, Colima ou Docker Engine), `ANTHROPIC_API_KEY`, e `GITHUB_TOKEN` ou `AZURE_DEVOPS_ORG` com `AZURE_DEVOPS_PAT`, com permissão de escrita em branch. No Studio, abra o workflow `autonomo` e preencha os mesmos campos do `sdlc`; no Azure DevOps, o repositório vai como `projeto/repositorio`. Sem chave, o workflow para e diz o que falta. Para repositórios Python, construa a imagem de sandbox com Python (`sudo bash deploy/construir-sandbox.sh`; veja [Credenciais](#credenciais)).

## Harness evolutivo

Agente é modelo mais harness: o que entrega o contexto certo a cada passo e o que impede o erro caro. Na Super Factory, o harness mora no repositório e evolui pelo mesmo caminho do produto:

- **Skills versionadas.** Como construir, revisar e desenhar fica escrito em `skills/`, como a `factory-ui`. Um jeito melhor vira pull request na skill.
- **Regras do cliente, com autor.** A base do projeto guarda o que uma pessoa do cliente ditou, com o nome dela. Nenhum agente inventa regra.
- **Política no código, não no prompt.** Aprovação nas escritas externas, retry, limite de contexto, guarda na saída e varredura de segredo valem em toda chamada (veja [O harness dos agentes](#o-harness-dos-agentes)).
- **A factory que constrói factory.** Este repositório foi feito assim: pedido, agente, pull request, `npm run check` e `npm run e2e`, e o merge decidido por uma pessoa. Mudança no harness passa pelo mesmo gate.

## O que a Factory se recusa a fazer

| A Factory faz | Fica com uma pessoa |
| --- | --- |
| Triagem, especificação e plano | Merge: a branch protegida não recebe push |
| Checks internos, com evidência | Deploy: o release não publica nada |
| Issue ou work item no provedor | Force-push e commit direto em `main` |
| Pull request em rascunho (`sdlc`) ou pronto para revisão (`autonomo`) | Revisar o pull request e decidir o merge |
| Código e testes só dentro do container do card (`autonomo`) | Rodar fora do sandbox, em produção |
| Importar as issues etiquetadas e criar cards; organizar milestone, responsável, labels e Project | Etiquetar o que entra e iniciar a onda |
| Comentar e fechar issues quando você pede; avisar na issue que o PR abriu | Fechar, aprovar ou editar pull request |
| Revisar o PR com um comentário (PR Review) | Aprovar, pedir mudanças formalmente e decidir o merge |
| Pedir revisão e tirar o PR do rascunho (só com o CI verde) quando você pede | Excluir issue, label, branch ou repositório; alterar proteção de branch; release |

**Segredos não ficam guardados.** Todo corpo JSON que entra na API passa por uma redação antes de chegar ao Mastra: o token vira `[segredo:token-github]`. O valor não entra no snapshot do workflow, na memória nem nos spans, e a triagem continua bloqueando o card pelo marcador. Para limpar um `factory.db` antigo, rode `npm run limpar-segredos`.

## 7 passos para ver com os próprios olhos

Um passo de cada vez. Os passos 1 a 6 ligam a Factory; o 7 libera o modo autônomo. Se o Terminal mostrar uma linha vermelha, copie e cole no chat da Factory: a conversa continua do passo em que você parou e explica o conserto. Não cole chave, token ou senha. A página inicial tem o botão **Guia-me**, que percorre os mesmos passos.

1. **Node.** Instale o Node 22.18 ou mais novo, pelo site nodejs.org. `node -v` precisa mostrar `v22.18` ou um número maior.
2. **Terminal e git.** No Mac, Command + espaço e escreva Terminal; no Windows, procure PowerShell no Iniciar. Confira o git com `git --version`. No Mac, se ele pedir, aceite instalar as ferramentas de linha de comando.
3. **Projeto.** Na primeira vez:
   ```bash
   git clone https://github.com/juliopessan/super-factory.git
   ```
   Se a pasta `super-factory` já existe, não clone de novo. Entre nela e atualize:
   ```bash
   cd ~/super-factory
   ```
   ```bash
   git pull --ff-only
   ```
   Se o `git pull` reclamar de um `package-lock.json` que seria sobrescrito, apague o arquivo local com `rm package-lock.json` e repita.
4. **Peças.** Dentro da pasta, e de novo a cada atualização:
   ```bash
   npm install
   ```
5. **Ligar.** Deixe esta janela aberta. A linha saudável mostra `Studio: http://localhost:4721/studio`.
   ```bash
   npm run dev
   ```
6. **Abrir.** `http://localhost:4721` é a apresentação. `http://localhost:4721/studio` é a Factory. Sem chave, ela já funciona e avisa quando a resposta é uma amostra.
7. **Modo autônomo: Docker e chaves.**
   - **Docker.** Docker Desktop, ou o Colima, que é gratuito:
     ```bash
     brew install colima docker
     ```
     ```bash
     colima start
     ```
     Confira com `docker info`: a resposta precisa trazer `Server Version`. Com o Colima, a Factory precisa saber onde fica o Docker: no `.env`, acrescente `DOCKER_HOST=unix:///Users/SEU_USUARIO/.colima/default/docker.sock`, trocando `SEU_USUARIO` pelo resultado de `whoami`. Com o Docker Desktop, não precisa.
   - **Chaves.** Na pasta `super-factory`:
     ```bash
     cp .env.example .env
     ```
     Abra o `.env` e preencha `ANTHROPIC_API_KEY` e o acesso ao repositório: `GITHUB_TOKEN`, para o GitHub, e `AZURE_DEVOPS_ORG` com `AZURE_DEVOPS_PAT`, para o Azure DevOps. As permissões de cada um estão em [Credenciais](#credenciais). Comece por um repositório de teste, não por um de produção.
   - **Religar.** O `.env` só é lido quando a Factory sobe: pare com Control + C e rode `npm run dev` de novo.

### Rode o ciclo da Joana no Studio

Abra o workflow `sdlc` e preencha:

| Campo | Exemplo |
| --- | --- |
| titulo | Filtro de datas com hora |
| descricao | O filtro da API de pedidos quebra quando a data vem só com o dia. Precisa aceitar intervalo com hora e recusar fim anterior ao início. |
| criterios | Uma condição por linha, por exemplo `O endpoint devolve 400 quando o fim do intervalo é anterior ao início.` |
| provedor | `github` ou `azure-devops` |
| repositorio | GitHub: `owner/repo`. Azure: `projeto` ou `projeto/repositorio`. O endereço copiado do navegador (`https://github.com/acme/pedidos`, `https://dev.azure.com/org/Projeto/_git/repo`) também serve. |
| branchBase | `main` |
| branchHead | Uma branch que já existe, se quiser um pull request rascunho. Vazio só abre o item de acompanhamento. |

O workflow suspende três vezes. Em cada uma, retome com o JSON do gate. `aprovado: false` recusa: na implementação ou no merge, o card fecha bloqueado; no release, fica retido.

---

## Da demanda ao pull request

Do card ao PR: o que roda dentro do container, como uma issue vira card, como o PR volta para a issue, como tarefas que dependem uma da outra viram pull requests em pilha e quem revisa. Uma só decisão humana: o merge.

### Modo autônomo, fase por fase

No Studio, em **Workflows → autonomo**, o canvas acende uma fase de cada vez: triar o card, abrir o sandbox, clonar e preparar, construir e testar, revisar e enviar, abrir o pull request. Um painel sobre o canvas mostra a fase atual com um verbo girando (Clonando…, Rodando os testes…, Procurando segredo…), e o nó que está rodando ganha contorno e a mesma etiqueta.

Se o card parar, o nó da fase fica vermelho com o motivo, e as fases seguintes não começam. O estado do card continua salvo no quadro.

Para conhecer o fluxo sem tocar repositório, marque **ensaio** no formulário: as mesmas fases rodam com um sandbox de mentira, sem rede e sem chave.

### Verificação de verdade

Confiança em agente vem de verificação, não de prompt. Além de rodar o teste do repositório, o modo autônomo observa:

- **Baseline.** Antes de mudar qualquer coisa, a Factory roda os testes, o lint, o typecheck e o build. Assim uma falha que já existia não é culpa do card, e uma regressão não passa por falha antiga.
- **Lint, typecheck e build como checks separados** (a partir dos scripts do `package.json`, de `go vet`/`go build` e de `dotnet build`), cada um com a evidência. Uma regressão deixa o PR em rascunho, com o motivo; uma falha que já existia no baseline vira só uma nota.
- **Vermelho→verde, em card de bug.** O teste que a mudança trouxe precisa **falhar sem a correção e passar com ela**: a Factory guarda o código da correção (stash), roda os testes de novo, devolve o código e confere que tudo voltou. Se o teste passa sem a correção, ele não prova o conserto e o PR sai em rascunho. Bug sem teste novo vira aviso no PR.
- **Convenções do repositório.** `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` e as regras do Cursor, lidos do repositório clonado (com segredo redigido), entram no pedido do construtor junto com as regras do cliente. São texto do projeto: não mudam as regras de segurança do construtor.
- **Trilha e ancoragem.** O que o construtor leu, escreveu e rodou fica no card (redigido). A Factory compara isso com o que ele afirma e deixa notas no PR (**Pontos de atenção**): escreveu sem ler nada, citou um arquivo que nunca abriu, disse que os testes passam sem tê-los rodado. Só nota: quem decide é a pessoa.
- **Revisor com modelo de mais raciocínio.** Um juiz do mesmo modelo que escreveu o código tende a concordar com ele. O PR Review usa `claude-opus-5-5` quando há `ANTHROPIC_API_KEY` (`SUPER_FACTORY_REVIEWER_MODEL` troca; `mesmo` usa o do chat).

- **Mapa do repositório.** Do que foi clonado, a Factory monta um mapa (pastas, telas, rotas de API, entradas, onde ficam os testes) e o entrega ao construtor, para ele achar onde mexer sem varrer tudo. O mapa fica guardado em `data/mapas/` e só é reescrito quando a lista de arquivos muda. O chat o lê com `lerMapaDoRepositorio`.
- **Prontidão do repositório.** Antes de ligar a autonomia num repositório novo, `diagnosticarProntidaoGithub` diz o que falta para a Factory provar o que faz: comando e arquivos de teste, lint, typecheck, build, AGENTS.md, CI, lockfile, README e a proteção da branch principal (o merge precisa continuar sendo de uma pessoa). No modo autônomo, o que falta de teste ou de CI aparece nos Pontos de atenção do PR.
- **O app aberto de verdade (opcional).** Com a imagem do sandbox construída com `--com-browser` (Chromium + Playwright), a Factory sobe o app do card antes e depois da mudança, abre no navegador e lê o que aconteceu: status, erros do console, requisições que falharam, e guarda a captura de tela em `data/capturas/`. Um app que abria limpo antes e agora dá erro deixa o PR em rascunho; sem baseline, o erro é só um ponto de atenção. Repositório sem script `start`, `dev`, `serve` ou `preview` não é falha: o check fica NOT_RUN. Vem desligado.

- **Medir o time, não só o PR.** Dois conjuntos de ouro nascem no Studio (Datasets): *cards de ouro* (a rota e o lint esperados de cada pedido) e *diffs de ouro* (mudanças com um defeito plantado: segredo, teste removido, fora do escopo, entrada sem validação), com os scorers `triagem` e `revisao` para rodar um Experiment. Para comparar modelos como revisores, `npm run evals` monta a matriz (cada modelo contra cada diff) com um juiz de **outro provedor** e uma rubrica; sem `--executar` só mostra o plano e o número de chamadas, e passou do teto (`--teto`, padrão 40) nada roda.
- **O PR é o sinal.** `medirResultadoDosPrs` olha no GitHub o que as pessoas fizeram: mesclou como veio (*aceito*), mesclou depois de commits ou pedidos de mudança (*ajustado*), fechou sem mesclar (*recusado*). O quadro passa a mostrar quantos PRs foram mesclados sem ajuste e os **tokens por PR mesclado** (o custo inclui o que foi recusado). Dinheiro não é calculado: o preço depende do seu contrato.
- **Comentou duas vezes? Vira regra.** `proporRegrasDeComentarios` lê os comentários de pessoas nos PRs da Factory e agrupa os que se repetem em PRs diferentes. Só propõe: a regra entra na base do projeto (`registrarRegraProjeto`) com o texto que uma pessoa aprovar, em nome dela.

- **PR pequeno.** Mudança acima do orçamento (400 linhas ou 15 arquivos, ajustável em `SUPER_FACTORY_PR_MAX_LINHAS` e `SUPER_FACTORY_PR_MAX_ARQUIVOS`, `0` desliga) leva um aviso e uma **proposta de divisão em PRs empilhados**: o teste vai junto do código que cobre, dependências e configuração ficam embaixo, interface e documentação em cima. É sugestão, não bloqueio: a Factory não corta a mudança sozinha.
- **Webhook em vez de varredura.** `POST /factory/webhook/github` (defina `SUPER_FACTORY_WEBHOOK_SECRET` e o mesmo segredo no webhook do GitHub; eventos *Issues* e *Pull requests*). Toda entrega precisa da assinatura HMAC-SHA256 sobre o corpo exato, comparada em tempo constante; sem segredo o webhook fica desligado, a mesma entrega não roda duas vezes e o corpo tem teto de 1 MB. Issue etiquetada `super-factory` vira card na hora (só cria o card: quem manda rodar é uma pessoa); PR fechado tem o resultado medido. `SUPER_FACTORY_WEBHOOK_REPOS` restringe a quais repositórios ele responde.
- **Triagem de bug por reprodução.** Com `SUPER_FACTORY_TRIAGEM_BUGS=sim`, uma issue com as etiquetas `super-factory` e `bug` é triada sozinha (ou peça ao chat: `triarBugGithub`). Um agente escreve **só um teste** que falha por causa do bug (a Factory desfaz qualquer mudança em código de produção) e a conclusão vai para a issue, uma vez: **reproduzido**, **provavelmente já corrigido na main** (o teste falha na versão da época da issue e passa na atual), **não reproduzido** ou **inconclusivo** (sem comando de teste, suíte já quebrada). Não abre PR, não corrige, não fecha a issue; uma por vez por issue e no máximo `SUPER_FACTORY_TRIAGEM_MAX_POR_HORA` (5) por hora.

- **Do card em Ready à execução, sem copiar nada.** O Chief lê o card pelo ID (`lerCard`: critérios, issue de origem, duplicatas, execução mais recente, e por que pode ou não iniciar), planeja (`planejarOnda` com `escolher`, `excluir` e `reservar`; pula o que já está reservado e o que é o mesmo trabalho de um card em build, qa, review ou done) e inicia com `iniciarOnda` passando `cardIds`: a execução **parte do card que já existe** (mesmo ID, mesma issue de origem) e nenhum card novo é aberto. `editarCard` corrige critérios e metadados de um card em backlog, ready ou blocked (a triagem roda de novo), e `moverCard` leva entre backlog, ready e blocked (para ready a triagem precisa passar). Build, qa, review e done não se movem por aqui: são da execução e do merge humano.
- **O sandbox é conferido antes de gastar a execução.** `iniciarOnda` (e `validarSandbox`, no chat) compara o que o repositório pede na raiz (`package.json`, `requirements.txt`, `go.mod`, `.sln`) com o que a imagem do sandbox tem (git, Node/npm, Python/pip, Go, .NET). Falta algo? O card volta como **BLOCKED**, com o conserto (por exemplo `construir-sandbox.sh`), e não clona nem instala. Não deu para conferir (sem Docker, repositório ilegível)? Segue com aviso, como NOT_RUN. No ensaio não confere.
- **Regras aprovadas são gravadas.** `registrarRegraProjeto` agora está nas ferramentas do Chief: depois que uma pessoa aprova o texto que `proporRegrasDeComentarios` propôs, ele grava em nome dela.

- **Resultado por critério de aceite.** O construtor termina dizendo qual teste cobre cada critério (`CRITERIO 1: tests/filtro.test.js`); a Factory confere o que dá para conferir: o arquivo apontado está no diff? a suíte rodou e passou? (em bug) o teste novo falha sem a correção? Cada critério sai **PASS**, **FAIL**, **NOT_RUN** ou **BLOCKED**, com a evidência, no card, no PR (seção *Resultado por critério*) e em `lerCard`. PASS quer dizer *teste apontado existe no diff e a suíte passou*: se o teste prova mesmo o critério continua sendo julgamento da revisão humana, e a evidência diz isso. Sem mapa (CLI externa) ou com teste que não está no diff, o critério fica NOT_RUN: nada vira PASS por palpite.
- **A onda numa tela só.** `lerOnda` mostra cada card da onda (reservada por `planejarOnda` e mantida por `iniciarOnda`) com o andamento (aguardando, em execução, parado, PR aberto, mesclado, recusado), a execução, o PR, o CI de cada PR (`comCI`, só leitura), o resultado por critério e os tokens da onda.

- **Teto de custo, em tokens.** O construtor, a triagem de bug e a revisão automática gastam modelo, e nada disso corria sem freio. Agora há três tetos (tokens de entrada + saída; o dinheiro depende do modelo e do contrato, por isso não é calculado): **por card** (600 mil), **por onda** (2 milhões) e **por dia, UTC** (6 milhões). Ao chegar no que ainda cabe, a Factory **interrompe o agente no meio da geração**, o card para com o motivo e o que fazer (subir a variável no `.env`, `0` desliga), e nenhum PR sai pela metade. Antes de cada tentativa ela confere o que resta; uma onda não inicia mais cards depois do teto da onda; e com o teto do dia estourado nada novo começa (o ensaio não conta). `lerCusto` mostra o gasto de hoje, o que ainda cabe, de onde veio (cards, triagens, revisões) e os cards mais caros. Limite: uma CLI externa configurada como implementador (`SUPER_FACTORY_IMPLEMENTADOR=comando`) não informa tokens, então o gasto dela não é medido.

- **Projeto em subpasta e Python de verdade.** Muito repositório tem o app em `backend/` ou `src-maf/`, com a raiz só de infraestrutura. Sem manifesto na raiz, a Factory procura em **um** nível de pasta (`package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `.sln`, `Makefile`) e roda instalar, testes, lint e build **dentro dela**; mais de um candidato, escolhe um e avisa os outros. No Python, instala o extra `[dev]` quando existe e roda `ruff check` se o projeto o declara. O preflight confere a **versão** do Python (`requires-python >= 3.13` contra o 3.11 do Debian) e dá BLOCKED com o conserto: `construir-sandbox.sh --python 3.13`. Roteiro para validar tudo num repositório real: [docs/ENSAIO-REAL.md](docs/ENSAIO-REAL.md).

- **Melhoria recursiva, com gente no circuito.** Dentro do card, um **Improver** (modelo do revisor, sem ferramentas) avalia a tentativa medida e propõe uma mudança de abordagem; o construtor refaz uma vez; e a Factory **só fica com o resultado se a pontuação objetiva subir** com os testes ainda verdes, senão volta ao código anterior (liga com `SUPER_FACTORY_MELHORIA=sim`; o PR mostra cada rodada). Entre cards, `proporLicoes` sugere **lições** para o construtor a partir de sinais observados, com a evidência; **uma pessoa aprova** (`decidirLicao`, em nome dela), e `lerLicoes` mostra a pontuação antes e depois e recomenda retirar a que piorou. Lição nunca mexe em guarda (merge, aprovação, deploy, segredo, teste). É a versão *fraca* da técnica, de propósito: sem pessoa decidindo seria RSI forte, e a Factory não faz isso. Detalhes, limites e como medir se ajuda: [docs/RSI.md](docs/RSI.md).

Tudo isso custa tempo de execução: `SUPER_FACTORY_VERIFICACAO=minima` volta ao teste único para suítes muito longas. Plano e o que vem depois (navegador no sandbox, mapa de funcionalidades, evals): [docs/ROADMAP-VERIFICACAO.md](docs/ROADMAP-VERIFICACAO.md).

### Gatilho de issues

No chat do Chief: "importe as issues etiquetadas de acme/pedidos". A ferramenta `importarIssuesGithub` traz as issues abertas com a etiqueta `super-factory` (ou outra, se você pedir) e cria um card para cada uma, sem repetir as que já viraram card. Os critérios saem da seção "Critérios" da issue ou da lista de tarefas (`- [ ] ...`); sem critério observável o card nasce **bloqueado**, com o motivo, e uma pessoa completa.

Duas travas de segurança: só entra issue **etiquetada** (etiquetar exige permissão de triagem no repositório: é a decisão da pessoa; quem só abriu a issue não faz a Factory trabalhar), e importar **só cria o card**. Iniciar a onda continua sendo um pedido seu, porque o texto da issue é dado de terceiros. Segredo na issue é redigido, @menção é neutralizada e a origem fica marcada no card. Precisa de `GITHUB_TOKEN`; sem ele nada é importado. A varredura é sob demanda (até 10 issues por vez): ainda não há agendamento automático.

### Da issue ao pull request: o ciclo fechado

Quando uma onda nasce de issues importadas, o Chief passa `issue: N` em cada pedido. O card guarda a origem (`issue:owner/repo#N`), o **PR passa a referenciar a issue** (`Closes #N` quando os testes passaram e o PR vai direto para a branch principal, para o merge, que é de uma pessoa, fechar a issue; `Refs #N` quando é rascunho ou empilhado) e a Factory **comenta na issue, uma vez só**, quando o PR abre: link do PR, resultado dos testes e "o merge é de uma pessoa". Falhar nesse aviso não derruba o card (o PR já está aberto e a falha entra na trilha), o ensaio nunca comenta em issue de verdade, e rodar de novo não duplica o comentário (marca oculta por PR).

### Épicos e PRs em pilha

Tarefas que dependem uma da outra rodam na mesma **onda** (workflow `onda` ou a ferramenta `iniciarOnda` do Chief of Staff). Dê uma `chave` a cada card e `dependeDe` (a chave de **um** pai) ao que vem depois:

```json
{ "pedidos": [
  { "chave": "api", "titulo": "API de filtro por data", "...": "..." },
  { "chave": "ui",  "titulo": "Tela do filtro", "dependeDe": "api", "...": "..." },
  { "titulo": "Documentação do filtro", "dependeDe": "ui", "...": "..." }
] }
```

- O filho **espera o pai**, clona a **branch que o pai enviou** e abre o pull request **contra ela**: PRs em pilha, em vez de um diff gigante.
- O corpo do PR do filho avisa que está empilhado. O resumo da onda traz a **ordem de merge**: de baixo para cima (primeiro o PR da base; depois confira se o próximo passou a apontar para a branch principal).
- Se o pai não chega ao pull request, o filho e os netos ficam **bloqueados** e nunca rodam. Os cards independentes seguem.
- Até 8 cards por onda, 5 ao mesmo tempo (`SUPER_FACTORY_PARALELISMO`). Chave repetida, pai que não existe e ciclo são recusados **antes** de rodar qualquer coisa. Um só pai por card: juntar duas branches de pais diferentes seria um merge escondido, e o merge é de uma pessoa.

### Paralelismo

- **Vários cards ao mesmo tempo:** o workflow **onda** (ou a ferramenta `iniciarOnda` do Chief of Staff) roda de 1 a 8 cards por onda, até 5 independentes juntos, cada um com sandbox, branch e pull request próprios. `SUPER_FACTORY_PARALELISMO` (padrão 3) limita quantos rodam simultâneos, porque cada card abre um container e chama o modelo. Um card que para não derruba os outros. Em ensaio, 3 cards levam o tempo de 1.
- **Dentro de um card** as fases seguem em ordem de propósito: clonar, instalar, escrever, testar, enviar e abrir o PR dependem uma da anterior.
- **Agentes:** leituras independentes do mesmo passo rodam juntas (até 4). `compararBranchesGithub` resume até 20 branches numa chamada, no lugar de ler branch por branch.
- **Escrita no GitHub Project** é sempre uma por vez no mesmo Project, como o GitHub recomenda.
- **Logs** do Studio mostram uma linha por fase do autônomo, por card da onda e por chamada das ferramentas de GitHub.

### Revisão automática de pull request

O agente **PR Review** (`reviewer`) lê o PR (título, corpo com os critérios e a evidência do sandbox, arquivos e trechos do diff) e deixa **uma revisão como comentário**: resumo, achados por severidade (com comentário na linha, quando a linha está no diff) e a situação de cada critério de aceite. Converse com ele no Studio ("revise o PR 12 de acme/app") ou peça na onda: `revisar: true` faz o revisor comentar em cada PR que a onda abrir.

- **Só comenta.** O evento da revisão é fixo no código (`COMMENT`): a ferramenta não tem como aprovar, pedir mudanças ou fazer merge, e o agente é instruído a nunca dizer que o PR pode ser mesclado. O merge continua sendo de uma pessoa.
- **O texto final é montado pela Factory**, não pelo agente. `@menções` são neutralizadas (a revisão não chama ninguém) e segredos são redigidos.
- **O PR é dado de terceiros.** O revisor não segue instruções que estejam no diff, no corpo ou nos comentários.
- Sem `GITHUB_TOKEN` a revisão é simulada. Escrita com erro nunca é repetida (poderia duplicar a revisão); só o caso "linha fora do diff" (422) é refeito, sem os comentários no código.
- Na onda, o resultado de cada card diz se a revisão foi `comentada` ou `nao-feita` (sem modelo, sem token ou falha); isso não derruba a onda.

### Uma decisão humana: o merge

Tudo antes do merge os agentes fazem sozinhos, sem pedir permissão a cada passo: ler, planejar, abrir issue, organizar o Project, implementar e testar no container. O que continua de uma pessoa é o merge. Merge, deploy e force-push seguem fora do alcance dos agentes, e nenhum papel aprova o gate.

## Gestão do GitHub

O Chief of Staff **executa** o que não exige mudar código, em vez de só relatar que não consegue: lê, organiza, comenta e fecha, tudo com um token só. A leitura é aberta a todos os agentes; a escrita é só do Chief e do Integrations, e só quando você pede. Plano e o que falta (webhook do GitHub no lugar da varredura e o ciclo de feedback de revisão): [docs/ROADMAP-INTEGRACOES.md](docs/ROADMAP-INTEGRACOES.md).

### Ler o GitHub (um token só para tudo)

Leitura para gestão, no chat do Chief e dos agentes (só leem): `lerIssueGithub` (corpo, labels, milestone, responsáveis e os comentários mais recentes), `buscarIssuesGithub` (estado, labels, milestone, responsável e "@me", com páginas de até 30), `listarPullRequestsGithub`, `listarMilestonesGithub` (com progresso em %), `lerChecksGithub` (o CI de uma branch, commit ou número de PR: o que falhou, **em qual passo** e o fim do log), `lerProtecaoDeBranchGithub` (a principal exige pull request e aprovação? lê também os rulesets), `lerAlertasGithub` (dependências, código e segredos expostos; **o valor do segredo nunca é lido**) e `listarProjetosGithub`. O que vem do GitHub é dado de terceiros: segredo sai redigido e @menção é neutralizada. Só GET; o log é buscado sem mandar o token ao host de download, e só em hosts conhecidos.

O token é **um só** (`GITHUB_TOKEN`). Se algo falhar por permissão, peça ao Chief para rodar `verificarTokenGithub` (com `owner/repo`): ele diz, para o repositório, de quem é o token, se é clássico ou fine-grained, o que já alcança e qual permissão falta, sem nunca mostrar o token. A tabela de permissões por função está em `docs/ROADMAP-INTEGRACOES.md`. O MCP da Factory expõe só a leitura de issues, PRs, milestones e CI; alertas de segurança, proteção de branch, Projects e o diagnóstico do token ficam de fora. Testado com um GitHub simulado, não contra o GitHub real.

### Gerir issues, labels, revisão e campos do Project

Escrita reversível, só no Chief e no Integrations, quando a pessoa pede: `comentarIssueGithub`, `editarIssueGithub` (título, corpo, **fechar** com motivo `completed` ou `not_planned`, **reabrir**), `gerenciarLabelsGithub` (criar sem duplicar, aplicar acrescentando, remover; aplicar label que não existe é recusado para o GitHub não criar outra por erro de digitação), `pedirRevisaoGithub` (a logins que a pessoa citou), `marcarPrProntoGithub` (tira do rascunho; **recusa se o CI falhou ou ainda roda**), `criarCampoDoProjetoGithub` e `definirCampoDoProjetoGithub` (Prioridade, Estimativa, Prazo, Sprint: seleção única pelo nome da opção, número, texto, data AAAA-MM-DD e iteração). Travas: comentário sai com a marca de automação, segredo redigido e @menção neutralizada; **pull request nunca é fechado nem editado** por `editarIssueGithub` (é decisão de uma pessoa); não existe merge, aprovação, exclusão de issue, label, branch ou repositório; escrita não é repetida em falha de rede; criação de label, campo e milestone não duplica nem com dois pedidos ao mesmo tempo; a resposta do GitHub é conferida (ele ignora em silêncio revisor ou responsável sem acesso). Fora do MCP. Testado com um GitHub simulado, não contra o GitHub real.

### Milestone e responsável (assignee)

No chat do Chief: "crie o milestone Beta interno em acme/pedidos, vencendo em 2026-12-15, coloque as issues #2, #3 e #4 nele e atribua a mim". Duas ferramentas, só do Chief e do Integrations: `criarMilestoneGithub` (não duplica: se já existe um milestone aberto com o mesmo título, usa esse; a criação nunca é repetida em falha de rede e dois pedidos simultâneos criam um só) e `atribuirIssuesGithub` (até 40 issues por vez, milestone por número ou título, responsáveis por login; **"@me" é o dono do token**). O responsável é **acrescentado**, nunca substitui os que já existem, e a resposta do GitHub é conferida: ele ignora em silêncio quem não tem acesso ao repositório, e a Factory avisa em vez de dizer que deu certo. Uma issue que falha não derruba as outras. Atribuir notifica quem recebe, então o Chief só atribui a quem a pessoa citou. Precisa de `GITHUB_TOKEN` com escrita em Issues (clássico com `repo`, ou fine-grained com Issues: Read and write). Não fecha issue, não comenta e não faz merge; as ferramentas não ficam no MCP da Factory (são escrita). Testado com um GitHub simulado, não contra o GitHub real.

### Criar o GitHub Project

No chat do Chief: "crie o Project Backlog Super Factory em juliopessan". A ferramenta `criarProjetoGithub` cria o Project v2 (usuário ou organização) com o campo Status (Todo, In Progress, Done) e devolve a referência `dono/número`; em seguida o Chief adiciona as issues e ordena com `organizarProjetoGithub`. Se já existe um Project aberto com o mesmo título, devolve esse e **não cria outro**; a escrita nunca é repetida. Opcionalmente liga o Project a um repositório. A API do GitHub não escolhe o modelo nem o layout: para ver em colunas, troque a visão para **Board** na tela do Project. Precisa de `GITHUB_PROJECT_TOKEN` (ou `GITHUB_TOKEN`) clássico com os escopos `project` e `repo` para Project de usuário.

### Ler uma branch e organizar o GitHub Project

O Chief of Staff **executa** o que não exige mudar código, em vez de só relatar que não consegue. Peça no chat, por exemplo: "analise a branch `trabalho-backlog` do repositório X e organize tudo no Project `https://github.com/users/dono/projects/3`".

- **Ler o repositório:** `listarBranchesGithub`, `listarArquivosGithub` e `lerArquivoGithub`. Só leitura, sem token em repositório público, com `GITHUB_TOKEN` no privado. Segredos dentro dos arquivos são redigidos, e o conteúdo vem marcado como dado de terceiros: uma instrução escrita num arquivo nunca vira ordem para o agente.
- **Ler o Project:** `lerProjetoGithub` devolve as colunas do campo de status e os itens de cada uma, com o id de cada item.
- **Organizar o Project:** `organizarProjetoGithub` move itens entre colunas, adiciona issues, pull requests e rascunhos, e ordena, em lotes de até 40 ações. Não exclui nada, e uma ação que falha não derruba as outras.
- **Token do Project:** Project de **usuário** só aceita token **clássico** com os escopos `repo` e `project`; token fine-grained cobre apenas Project de organização. Cole em **Settings → Chaves e acessos → GitHub: token do Project**. O painel testa o token e avisa se faltar o escopo. Sem essa chave, vale o `GITHUB_TOKEN`.
- Os papéis Architect, QA, Docs e Security só **leem** (repositório e Project). Quem escreve no Project é o Chief of Staff e o Integrations.
- A conversa com o agente tem até 30 passos por vez para o Chief of Staff, o bastante para organizar um quadro inteiro.

## Acompanhar o trabalho

Para saber em que pé está cada card sem abrir o GitHub: o quadro, as métricas de entrega e o time trabalhando.

### Quadro no Studio

Na tela **Agents** do Studio, logo abaixo do desenho do time, aparece o **Quadro**: as sete colunas (backlog, pronto, construindo, QA, revisão, bloqueado, concluído) com os cards, a onda, o desfecho e o link do pull request. Card de um épico em pilha mostra "sobre C-1". A tela atualiza sozinha a cada 8 s e também abre em tela cheia em `/quadro`. É somente leitura (`GET /factory/quadro`) e fica atrás do mesmo login do Studio.

Acima das colunas fica a faixa de **métricas de entrega**, calculada do que a Factory já guarda: execuções (e as dos últimos 7 dias), pull requests abertos, parte das execuções que chega ao PR, tempo mediano até o PR e bloqueadas. O agente construtor também registra os **tokens** gastos (entrada e saída, somados entre as tentativas): a faixa mostra tokens por card, ou "não medido" quando não há registro (ensaio e execuções antigas). **Dinheiro não é calculado**: o preço depende do modelo e do contrato; use os tokens com a sua tabela.

### Time de agentes animado

Na tela **Agents** do Studio, o espaço abaixo dos cards mostra **Como o time trabalha**: o Chief of Staff no topo delegando para o time (Architect, Frontend, Backend, Construtor, QA, Security, PR Review, Docs, Integrations) e, embaixo, o **merge**, o único nó humano. Um pulso percorre o ciclo a cada 12 s e cada agente acende na sua vez; o merge pulsa em âmbar esperando uma pessoa. Passe o mouse para ver o papel e clique para abrir o chat do agente. Aparece nas visões em cards e em lista, acompanha o tema claro/escuro e fica parado com `prefers-reduced-motion`. O desenho é fixo no código (`src/super-factory/time-animado.ts`): ao criar um agente novo, inclua-o lá.

### Métricas, logs e datasets no Studio

- **Metrics e Logs** usam um arquivo **DuckDB** (`SUPER_FACTORY_OBS_DB`; no container, `/data/observabilidade.duckdb`, no mesmo volume). O banco principal (agentes, memória, workflows) continua no LibSQL. Se o DuckDB não abrir, a Factory sobe sem métricas e avisa no log. Os traces antigos ficavam no LibSQL e não aparecem mais no Studio; os novos passam a valer daqui para a frente.
- **Datasets** abre com o conjunto **Critérios de aceite (triagem)**: casos do lint com o veredito esperado. É criado uma vez e não é sobrescrito se você editar. **Experiments** e **Review Queue** começam vazios de propósito: Experiments nasce quando você roda um conjunto contra um agente ou workflow (gasta chamadas de modelo, por isso nada roda sozinho), e a Review Queue recebe o que for marcado para revisão.

## Conversar com o time

O chat do Studio tenta ser tão direto quanto o do Claude Code: o menu escreve o pedido por você, uma linha mostra o que o agente está fazendo e há quanto tempo, e o campo de texto sugere o próximo passo.

### Menu `/` e `@` no chat

No chat de qualquer agente, digite **`/`** no começo da mensagem para ver workflows, atalhos e skills, ou **`@`** em qualquer ponto para referenciar um card, um pull request ou o repositório usado por último. Setas navegam, **Enter** ou **Tab** escolhem, **Esc** fecha.

- **`/` só preenche a mensagem** com um modelo. Quem executa é o agente, com as mesmas ferramentas e travas de sempre; merge e deploy não aparecem no menu. No Chief, `/autonomo` e `/onda` viram pedidos para `iniciarOnda`; nos outros agentes, os workflows abrem a tela do workflow no Studio.
- **`@` coloca só o identificador** (`C-12`), nunca o título do card, que é texto de terceiros.
- O menu lê as skills e os cards do servidor (`/factory/menu`, só leitura): skill nova aparece sozinha.
- `SUPER_FACTORY_MENU=0` desliga o menu sem mexer no resto.

Para o beta interno, veja [docs/BETA.md](docs/BETA.md): checklist de pré-voo, roteiro de demo, limites conhecidos e como voltar atrás.

### Conversa com o agente

O Studio abre uma conversa nova toda vez que você volta para o agente, e a anterior fica na lista de threads. A Factory lembra a última conversa de cada agente (neste navegador) e a reabre quando você volta pelo menu ou pela lista. O trabalho do agente continua no servidor enquanto você está em outra tela: ao voltar, a conversa mostra a pergunta, o botão de parar indica que ainda está rodando e a resposta aparece quando termina. **New Thread** continua começando uma conversa nova.

### Verbos e segundos no chat do Studio

Enquanto um agente trabalha, uma linha acima do campo de texto mostra um verbo do projeto e os segundos, como no Claude Code: `✻ Conferindo evidência… (12s)`. Cada agente tem o próprio vocabulário (o QA fala de evidência e `NOT_RUN`, o Security de segredo e gate, o PR Review de diff e critérios, o Chief de quadro e onda), e quando a mensagem já mostra o nome de uma ferramenta o verbo diz o que ela faz (`Importando as issues etiquetadas…`, `Criando o Project…`). Quando o agente termina, a mensagem ganha `✻ Trabalhou por 1m 15s`; a nota volta quando a conversa é reaberta no mesmo navegador. O Studio só mostra um ponto pulsando nessa hora, então a linha é da Factory (`src/super-factory/tempo.ts`). O tempo é guardado só no navegador de quem usou, e o ícone não gira para quem pede menos movimento.

### Sugestões com Tab

Para quem não é técnico e não sabe o que escrever, os campos do Studio mostram uma **sugestão em cinza** quando estão vazios, no estilo do Claude Code. Aperte **Tab** para preencher e **Esc** para ignorar. Com teclado não há dica na tela: o texto em cinza basta. No celular, que não tem Tab, aparece um botão sobre o campo e tocar nele preenche.

- **Formulário dos workflows:** título, descrição e critérios vêm de exemplos prontos, escritos para passar na triagem da Factory. O repositório, o branch de trabalho e o aprovador repetem o que a própria pessoa usou da última vez. O branch base sugere `main`.
- **Chat de cada agente:** a sugestão é a próxima pergunta útil para aquele papel, e muda a cada mensagem enviada. Depois de uma resposta do agente, ela passa a ler a conversa: veja [Próxima etapa sugerida no campo de texto (Tab)](#próxima-etapa-sugerida-no-campo-de-texto-tab).
- **Nada é inventado:** repositório e aprovador só sugerem o que você já digitou. A nota de aprovação de um gate **nunca** é sugerida, para ninguém aprovar sem ler.
- **O histórico fica no navegador** (`localStorage`), não vai para o servidor.

### Próxima etapa sugerida no campo de texto (Tab)

O campo de texto do chat sugere em cinza o que fazer a seguir, e **Tab** preenche (Enter envia; Esc ignora). A sugestão agora lê a última mensagem do agente: se ele terminou oferecendo algo ("Você quer que eu inicie a onda com #2, #3 e #4?"), o campo sugere a resposta natural ("Sim, inicie a onda com #2, #3 e #4."). Sem oferta, a sugestão segue o passo seguinte do ciclo pela ferramenta que o agente usou (depois de importar issues: "Inicie a onda com os cards novos que não estão bloqueados"; depois de criar o Project: "Adicione as issues abertas ao Project e ordene por prioridade"). Sem nenhum dos dois, vale a lista fixa do agente. Só sugere: nada é enviado sem a pessoa apertar Enter, e a nota de aprovação do gate nunca é sugerida. A lógica está em `src/super-factory/ferramentas-no-chat.ts`, testada com o mesmo código que roda no navegador.

### Ferramentas (MCP) que o time instala

As chaves ficam em **Settings → Chaves e acessos**. As ferramentas (MCP) abrem pelo botão **+** das páginas **Tools** e **MCP Servers** do Studio. Cada pessoa conecta aos agentes da Factory as ferramentas que ajudam no processo, sem SSH e sem mexer em arquivo.

- **Catálogo curado, versões fixas:** Microsoft Learn (documentação do Azure, sem chave), Context7 (documentação de bibliotecas), GitHub (leitura de repositórios, issues e PRs), Azure DevOps (work items, repositórios, builds) e Raciocínio em etapas.
- **Servidor remoto:** qualquer MCP publicado em https. A URL precisa ser pública; endereço da rede interna, IP e nome interno são recusados. O token vai criptografado, nunca na URL.
- **Comando no servidor:** só para o administrador, com `SUPER_FACTORY_MCP_COMANDO=1` no `.env`. Rodar um comando é executar código dentro da Factory, por isso a tela não liga isso sozinha.
- **Testa antes de gravar:** a Factory conecta, lista as ferramentas e só então instala. Credencial recusada nunca instala. Na primeira vez, o `npx` baixa o pacote e pode levar até um minuto.
- **Cada ferramenta liga e desliga** na própria tela, com um selo: *somente leitura*, *pede aprovação* ou *bloqueada*.

O que protege o processo:

- **Merge, deploy, publicação e aprovação nunca chegam a um agente.** Uma ferramenta com esse jeito, como `merge_pull_request`, fica bloqueada mesmo que o servidor a ofereça.
- **O que não é declarado somente leitura pede a sua aprovação a cada uso.** O papel Security só recebe ferramentas de leitura.
- **As chaves da Factory não vazam para o MCP.** O subprocesso só enxerga as variáveis dele; o token do MCP mora no cofre criptografado e só sai dali para conectar.
- **Um MCP quebrado não derruba nada.** Cada um tem a própria conexão; o que falha fica de fora, com o motivo na tela.

Vale para os agentes do Studio. O modo autônomo continua só com o sandbox: o agente construtor não usa MCP.

#### Colar a configuração do Cursor, do Claude Desktop ou do VS Code

No botão **+** (Tools ou MCP Servers), a seção **Colar configuração** aceita o trecho do `mcp.json`:

```json
{ "mcpServers": { "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] } } }
```

Clique em **Analisar** para ver o que será instalado e em **Instalar** para confirmar. A Factory não confia no que foi colado:

- **Reconhecido** (hoje: Context7 e Raciocínio em etapas) vira o item do catálogo, na versão revisada e com o endereço oficial. O `npx` colado não roda.
- **URL** (`url` e `headers`) passa pela checagem de rede: só https e só endereço público.
- **Comando** fora do catálogo só com `SUPER_FACTORY_MCP_COMANDO=1`, como antes. Sem versão fixa (`@1.2.3`), a tela avisa.
- Valores de `env` e de `headers` vão para o cofre criptografado e nunca voltam à tela nem ao arquivo de definição.
- `autoApprove` não existe aqui: ferramenta que altera algo continua pedindo a sua aprovação. Merge e deploy seguem bloqueados.
- Até 5 servidores por colagem; aceita `mcpServers`, `servers`, o servidor solto e vírgula sobrando.

## Operar a Factory

Instalar, publicar e proteger o acesso.

### Deploy numa VPS

Um kit em `deploy/` instala a Super Factory numa VPS Ubuntu 22.04 ou 24.04, com o modo autônomo ligado. O instalador olha o que a VPS já tem e escolhe o caminho sozinho:

- **Com Traefik** (modelo Docker da Hostinger, Coolify e afins). A Factory vira um container em `/docker/super-factory/`, com labels, igual às outras aplicações. O Traefik não é alterado: ele ganha uma rota nova em `factory.<hostname>.hstgr.cloud`, com certificado do Let's Encrypt, HTTPS e login com usuário e senha (hash bcrypt) antes de qualquer página.
- **Sem proxy.** Instala Node 22, Docker, Caddy (HTTPS e login) e um serviço `systemd`, e fecha o firewall em 22, 80 e 443. Sem domínio, o certificado é do próprio Caddy e o navegador avisa uma vez.

Na VPS, como root:

```bash
curl -fsSL https://raw.githubusercontent.com/juliopessan/super-factory/main/deploy/instalar-vps.sh -o instalar-vps.sh
```

```bash
sudo bash instalar-vps.sh
```

O script pergunta o usuário e a senha de acesso à Factory (mínimo de 10 caracteres; use uma senha só para ela) e, no fim, mostra o endereço. Com Traefik, o nome padrão é `factory.<hostname>.hstgr.cloud`; para outro, `DOMINIO=factory.suaempresa.com sudo -E bash instalar-vps.sh`. O nome precisa apontar para o IP da VPS. Depois, preencha as chaves do modo autônomo e recrie o container:

```bash
nano /opt/super-factory/.env
```

```bash
docker compose -f /docker/super-factory/docker-compose.yml up -d --force-recreate
```

Para atualizar com o que entrou no `main` (nos dois caminhos):

```bash
sudo bash /opt/super-factory/deploy/atualizar.sh
```

**Segurança.** O container da Factory monta o socket do Docker para abrir um container por card no modo autônomo. Quem alcança esse socket controla o Docker da VPS, por isso o login na frente é obrigatório. Para desligar o modo autônomo na VPS, apague a linha do `docker.sock` em `/docker/super-factory/docker-compose.yml`. O banco e o estado ficam no volume `factory-data`. Para trocar a senha de acesso: `REFAZER_LOGIN=1 sudo -E bash instalar-vps.sh`. Para ver o log: `docker logs -f super-factory`.

**Acesso à VPS.** Prefira chave SSH a senha de root: crie a chave no seu computador com `ssh-keygen -t ed25519`, cadastre a chave pública no painel da hospedagem e desligue `PasswordAuthentication` no `/etc/ssh/sshd_config`.

### Chaves pelo painel

Para o time não precisar de SSH nem de editor de texto, o Studio tem o botão **Chaves e acessos** (canto inferior direito). Ele abre um popup para colar `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PAT` e, se quiser, `OPENAI_API_KEY` e `GOOGLE_API_KEY`. A mesma tela abre direto em `/configuracoes`.

- **Testa antes de salvar.** A Factory confere a chave no provedor (Anthropic, OpenAI, Google, GitHub, Azure DevOps). Uma chave recusada não é salva. Se o provedor não responder, dá para salvar mesmo assim.
- **O valor nunca volta para a tela.** O painel mostra só "configurada", de onde veio (painel ou `.env`), quando e por quem.
- **Criptografada em disco** (AES-256-GCM, arquivo só do dono), com a chave mestra `SUPER_FACTORY_MASTER_KEY` do `.env`; o instalador da VPS gera uma. Sem ela, a Factory cria um arquivo de chave ao lado do cofre e o painel avisa.
- **Vale na hora**, sem reiniciar. O que o painel salva tem prioridade sobre o `.env`; remover do painel devolve o valor do `.env`.
- **Rota protegida.** Fica atrás do login da Factory, confere a origem do pedido, limita tentativas, aceita só os nomes da lista e não registra o valor em log nem em trace.

Quem entra na Factory com o login pode trocar estas chaves: use contas e tokens com o mínimo de permissão.

### Login e lista de espera

A Factory tem login próprio (GitHub OAuth) e uma lista de espera com qualificação, gravada no nosso banco (LibSQL, o mesmo `SUPER_FACTORY_DB`).

- **Páginas públicas:** a landing, `/waitlist` (formulário), `/login` e `/auth/*`. **Todo o resto** (Studio, `/api`, `/configuracoes`, MCP, `/admin`) exige login.
- **Quem entra:** só quem a waitlist aprovou (pelo usuário do GitHub informado ou por **e-mail verificado** do GitHub) ou quem está em `SUPER_FACTORY_ADMINS`. Recusar alguém na waitlist tira o acesso em até 30 s, mesmo com a sessão aberta.
- **Waitlist:** pessoa ou empresa, nome, e-mail, empresa e cargo, tamanho da equipe, quantas pessoas usariam, uso principal, ferramentas, o que quer automatizar, usuário do GitHub e consentimento. Um cadastro por e-mail; reenviar atualiza as respostas e nunca muda a decisão. Anti-abuso: isca para robô, limite de 5 envios por hora por IP, CSRF e tamanho máximo.
- **Admin:** `/admin/waitlist` (só admins) lista, filtra, aprova, recusa e exporta CSV. Pela linha de comando: `docker exec -it super-factory node --experimental-strip-types src/scripts/waitlist.ts listar pendente` (também `aprovar <email|id>` e `recusar`).
- **Segurança:** sessão em cookie assinado (`HttpOnly`, `SameSite=Lax`, `__Host-` e `Secure` em https), PKCE e `state` no OAuth, o token do GitHub nunca chega ao navegador, redirecionamento só para caminhos da própria Factory. Ligado com configuração incompleta, a Factory **fecha** tudo que não é público (503), nunca abre. A trilha de auditoria do cofre passa a registrar o usuário do GitHub.
- **Automação:** `SUPER_FACTORY_API_TOKEN` (32+ caracteres) libera só `/api`, com `Authorization: Bearer`.

**Jeito mais curto (VPS com Traefik):** `sudo bash /opt/super-factory/deploy/atualizar.sh` e depois `sudo bash /opt/super-factory/deploy/configurar-login.sh`. O assistente mostra o que preencher no GitHub (inclusive a callback exata), pergunta o Client ID, o Client Secret (digitado sem aparecer, nunca vai para chat ou histórico), e o seu usuário do GitHub, grava no `.env` com cópia de segurança e liga o login. Se algo falhar, `docker logs --tail 80 super-factory | grep "\[auth\]"` mostra o motivo.

**Passo a passo manual (equivalente):**
1. No GitHub: *Settings → Developer settings → OAuth Apps → New*. Callback: `https://SEU-DOMINIO/auth/retorno`.
2. No `/opt/super-factory/.env`: `SUPER_FACTORY_AUTH=github`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `SUPER_FACTORY_PUBLIC_URL` e `SUPER_FACTORY_ADMINS` (veja `.env.example`).
3. `sudo bash /opt/super-factory/deploy/atualizar.sh`, depois `sudo bash /opt/super-factory/deploy/ativar-login.sh`.

O instalador antigo põe um login básico do Traefik na frente de tudo, o que esconderia a landing e a lista de espera. O `ativar-login.sh` confere o `.env`, tira esse login do Traefik, sobe de novo e **testa**: se o Studio não ficar protegido (302 sem sessão, 401 na API), volta sozinho ao que estava. Para desfazer à mão: `bash deploy/ativar-login.sh --desfazer`. Emergência sem script: `SUPER_FACTORY_AUTH=off` no `.env` e recriar o container.

Por que GitHub e não Composio: o Composio guarda credenciais de agentes em apps de terceiros (agir no GitHub ou no Gmail em nome de alguém); não é um provedor de login do seu produto. Para empresas que não usam GitHub, o próximo provedor natural é Microsoft Entra ou Google.

## A página inicial

A landing é a porta de entrada pública: vídeo de apresentação, FAQ e SEO.

### Vídeo da landing: o som

O vídeo de apresentação (45 s) tem áudio. Na landing ele começa **mudo**, porque os navegadores bloqueiam som sem um gesto da pessoa, e o botão **Ativar som** (**Turn sound on** em `/en`), no canto do vídeo, liga e desliga o som. Quem pede menos movimento recebe os controles nativos do navegador. Um teste confere que o arquivo tem faixa de áudio e que o botão existe nas duas línguas, para o vídeo não voltar a ficar mudo por esquecimento.

### SEO e perguntas frequentes

A landing traz o FAQ visível, dados estruturados (schema.org: `WebSite`, `SoftwareApplication` e `FAQPage`, com o mesmo texto da página), Open Graph/Twitter, `robots.txt`, `sitemap.xml` e `llms.txt`. Canonical, hreflang, `og:image` e o sitemap só saem com `SUPER_FACTORY_PUBLIC_URL` definida (a Factory não inventa endereço). O FAQ vive em `src/super-factory/seo.ts`.

---

## Por dentro

### Onde está o código

| Caminho | O que guarda |
| --- | --- |
| `src/super-factory/` | Landing, marca SF, agentes, ferramentas e o workflow `sdlc` |
| `src/factory/` | Quadro, gates, trilha, guardas de segredo, GitHub (leitura, escrita e gatilho de issues), Azure DevOps e métricas |
| `deploy/` | Instalador, atualizador, login e a imagem do sandbox com Python |
| `src/scripts/check.ts` | Checagem do ciclo, sem shell e sem suíte de produto |
| `src/scripts/e2e.ts` | Teste de ponta a ponta, pela API e no navegador |
| `factory.json` | Manifesto: estágios, o gate do merge, oito papéis, evidência |

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe a Factory em `localhost:4721` |
| `npm run check` | Typecheck e checagem do ciclo |
| `npm run e2e` | Sobe a Factory sem chave e sem token, conduz o `sdlc` pelo gate do merge, testa recusas, triagem e redação de segredo, e abre a landing e o Studio no navegador, inclusive em larguras de celular |
| `npm run limpar-segredos` | Troca segredos já gravados no `factory.db` por marcadores e roda `VACUUM` |
| `npm run build` · `npm start` | Gera o servidor e sobe essa versão |

`E2E_PROD=1 npm run e2e` roda o mesmo teste no build de produção (`npm run build` e `npm start`), que é o que roda na VPS e no container.

O `npm run e2e` precisa da porta 4721 livre (ou `E2E_REUSE=1` para usar o servidor aberto) e do Playwright: `npm i -D playwright` e `npx playwright install chromium`.

### Credenciais

Copie `.env.example` para `.env` só na sua máquina. O `.env` não entra no repositório.

- **GitHub.** Sem `GITHUB_TOKEN`, listar ou abrir issue devolve a amostra e a nota `Simulado`. Com o token, a chamada vai para `https://api.github.com`. No `sdlc`, o pull request sai como rascunho; no `autonomo`, sai pronto para revisão. Não há endpoint de merge. Para o modo autônomo, use um *fine-grained token* só nos repositórios que a Factory pode tocar, com **Contents: Read and write**, **Pull requests: Read and write** e **Issues: Read and write**. O token é **um só para todas as funções**: as permissões de cada uma (leitura, escrita em issues, CI, alertas de segurança, proteção de branch, Project) estão na tabela de [docs/ROADMAP-INTEGRACOES.md](docs/ROADMAP-INTEGRACOES.md), e `verificarTokenGithub` diz o que falta.
- **Azure DevOps.** Sem `AZURE_DEVOPS_ORG` e `AZURE_DEVOPS_PAT` juntos, fica simulado. Com os dois, work items e pull requests usam `https://dev.azure.com`. O repositório vai no campo do ciclo como `projeto/repositorio`. Para o modo autônomo, crie o PAT só na organização, com validade curta, e os escopos **Code: Read & write** (clone, push e pull request) e **Work Items: Read & write**.
- **Anthropic.** `ANTHROPIC_API_KEY` é obrigatória no modo autônomo: é o agente construtor que escreve o código. `SUPER_FACTORY_BUILDER_MODEL` troca o modelo dele.
- **Implementador neutro.** O padrão é o agente construtor da Factory (`SUPER_FACTORY_IMPLEMENTADOR=agente`). Com `SUPER_FACTORY_IMPLEMENTADOR=comando` e `SUPER_FACTORY_IMPLEMENTADOR_COMANDO`, quem escreve o código é uma CLI de agente externa, dentro do container do card. O pedido (título, descrição, critérios e a falha da tentativa anterior) fica no arquivo `$SF_PEDIDO`, fora do repositório: o texto do card nunca entra no comando de shell. `SUPER_FACTORY_IMPLEMENTADOR_ENV` lista as variáveis que vão para o container (nunca `GITHUB_TOKEN`, `AZURE_DEVOPS_PAT`, `SUPER_FACTORY_*` nem `FACTORY_*`). A imagem do sandbox precisa ter a CLI e a rede precisa alcançar o serviço dela. Só o operador escolhe, pelo `.env`: o chat e os agentes não. Nada muda no resto: testes no sandbox, PR, revisão e merge humano. O gasto de tokens de um agente externo não é medido. Configuração inválida para o card com a mensagem do que corrigir. Esta troca **não foi testada com uma CLI real** nesta VPS: os testes usam um sandbox de mentira.
- **Python no sandbox.** A imagem padrão (`node:22-bookworm`) não tem `pip` nem `python`: um repositório Python trava em `pip: command not found`. Na VPS, rode `sudo bash /opt/super-factory/deploy/construir-sandbox.sh` (com `--com-ffmpeg` se os testes usarem FFmpeg): ele constrói `super-factory-sandbox` a partir de `deploy/sandbox.Dockerfile` (Node, git, Python 3, pip, venv e o comando `python`; o pip vem liberado do bloqueio PEP 668, porque o container é descartável), confere por dentro que tudo roda, grava `SUPER_FACTORY_SANDBOX_IMAGE` no `.env` (com cópia do anterior) e recria só o container da Factory. Não toca nos outros projetos da VPS. A Factory detecta Python sozinha: `pip install -r requirements.txt` e, nos testes, `python -m unittest discover`, ou `python -m pytest -q` quando o projeto declara pytest. Se a imagem não tiver uma ferramenta, o card para dizendo isso (e o que fazer), e não só "command not found". Esta imagem foi escrita e testada por revisão, não construída no ambiente de desenvolvimento (sem Docker); a primeira construção é na VPS.
- **Sandbox.** `SUPER_FACTORY_SANDBOX_IMAGE` troca a imagem do container (padrão `node:22-bookworm`) e `SUPER_FACTORY_SANDBOX_NETWORK` põe o container numa rede Docker própria, por exemplo com proxy corporativo.
- **Modelo.** Sem chave, a Factory local encaminha a frase para a ferramenta certa. Com `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY`, os agentes usam o provedor correspondente. `SUPER_FACTORY_MODEL` troca o modelo, no formato `provedor/modelo`; `FACTORY_MODEL` vale quando o primeiro está vazio.
- **Rede.** Por padrão, a Factory só abre neste computador (`localhost`), porque o Studio não tem login: quem alcança a porta 4721 roda agentes e workflows. Para abrir para outras máquinas de propósito, use `SUPER_FACTORY_HOST=0.0.0.0`.

Os identificadores passam por uma lista fechada de caracteres. O token não entra na URL e não é copiado para o relatório.

### Base do projeto

Cada repositório tem a própria base, com as regras que uma pessoa daquele cliente ditou: escrita, pastas, branch, evidência, glossário. `lerBaseProjeto` lê; `registrarRegraProjeto` grava, e o autor é o nome dessa pessoa, nunca um papel da Factory. Base vazia continua vazia: o ciclo segue e ninguém inventa regra de cliente.

`lerPoliticaProjeto` lê a política. Sem página gravada, a autonomia já é entrega humana. `definirPoliticaProjeto` registra a branch protegida e os checks que o cliente nomeou; a Factory não executa esses checks e não aceita merge automático. `relatarMerge` guarda interpretação, premissas e confiança (`confiante` ou `entrega`). Confiança não aprova o gate `beforeMerge`.

### Agentes, MCP e Studio

Fale com o Chief of Staff para ver o quadro, abrir um card ou ler a trilha. Um card aberto pelo agente não atravessa os gates: isso só acontece no workflow `sdlc`. Security responde em leitura e recusa pedido de escrita.

O Studio mostra o servidor MCP `super-factory` e a Factory, com um modo para cada papel. O servidor fica em `/api/mcp/super-factory/mcp` e expõe as ferramentas, os oito agentes e o workflow `sdlc`. A Factory não tem `submit_plan` nem subagente: uma tarefa concluída nela não é um gate. Clientes de fora podem falar com esse endereço; um servidor HTTP adicional entra pelo Studio, na área de MCP, quando alguém cola a URL.

### O harness dos agentes

Em volta do modelo, cada agente tem camadas que valem em toda chamada, escritas no código e não no prompt:

- **Escrita externa com travas no código, sem aprovação a cada uso.** Só o merge é decisão humana, então ferramentas como `criarIssueGithub`, `comentarIssueGithub`, `editarIssueGithub` e `gerenciarLabelsGithub` rodam quando o agente as chama a pedido da pessoa. Em troca, validam tudo antes de falar com a rede, nunca repetem uma escrita, não duplicam (milestone, label, campo, comentário), conferem a resposta do GitHub e redigem segredo e @menção. Ficam fora do servidor MCP, que não passa pelo login do Studio.
- **Falhas transitórias.** A chamada ao modelo tenta de novo até 2 vezes. O modelo é um só, para o Studio continuar mostrando o seletor de provedor e modelo no chat. Leituras no GitHub e no Azure DevOps repetem em erro de rede, 429 ou 5xx, respeitando o `Retry-After` até 5 s. Escritas tentam uma vez só, para não abrir a mesma issue duas vezes.
- **Contexto.** Na entrada, dados pessoais e segredos saem do texto e o histórico é cortado em 32 mil tokens.
- **Guarda na saída.** Se um agente escrever que fez merge, deploy ou aprovou um gate, a frase é trocada por um aviso. Negações como "nenhum merge foi feito" passam intactas.

### Skills

As skills ficam em `skills/`, em leitura. A skill `super-factory` é o contrato desta Factory: os verbos do quadro viram ferramenta ou workflow `sdlc`. Script, shell, merge, force-push e deploy continuam de fora.

## Créditos e escolhas

- O quadro e a triagem (claro, nebuloso, bug) seguem o modelo operacional do super-board, licença MIT, Copyright 2026 Eric Tech, copiada em `skills/UPSTREAM-LICENSE`.
- O manifesto em `factory.json` reescreve o núcleo (estágios, o gate humano do merge, oito papéis, evidência e escritas disjuntas) em vez de copiar os textos da Agent Factory.
- A Factory é construída sobre o [Mastra](https://mastra.ai). O nome aparece nos pacotes `@mastra/*` e no comando `mastra dev`; na tela, a marca é Super Factory.
- Gerar código no repositório, executar a suíte, fazer merge, force-push ou deploy ficam de fora de propósito.
