# Ensaio real: `juliopessan/src-amf-python`

Roteiro para rodar a Factory de ponta a ponta, uma vez, contra um repositório de verdade. Até aqui GitHub, Docker, navegador e modelo foram **simulados** nos testes. Este ensaio troca as simulações pela realidade e responde: o ciclo inteiro funciona, e o que quebra?

Escrito em 22/11/2026 a partir do que foi lido no repositório (commit `5edd332`, só leitura) e do que rodei de verdade num clone limpo: `ruff check` passa e os **39 testes passam em 1,4 s, offline**, com Python 3.13.

## O que este repositório tem de particular (e o que a Factory precisou aprender)

| Fato do repositório | Problema para a Factory | Correção (Lote H) |
|---|---|---|
| O app está em `src-maf/`; a raiz só tem `.github`, `.azure` e `docs` | A Factory procurava `pyproject.toml` só na raiz: "nenhum comando de teste", nada rodava | Procura o manifesto também em **uma** subpasta e roda instalar, testes e lint dentro dela |
| `requires-python = ">=3.13"` | O sandbox traz o Python 3.11 do Debian: `pip install` falha depois de clonar e esperar | O preflight compara a versão e dá **BLOCKED** com o conserto; `construir-sandbox.sh --python 3.13` |
| `pytest` e `ruff` estão no extra `[dev]` | `pip install -e .` não instalaria nenhum dos dois | Instala `.[dev]` quando o extra existe; roda `ruff check` como check de lint |
| CI próprio: `ruff`, `pytest`, `bandit`, `pip-audit`, imagem Docker, frontend | A Factory não roda `bandit` nem `pip-audit` | Não muda: o CI do GitHub roda no PR e é um segundo juiz. Uma falha ali é **achado do ensaio**, não bug da Factory |

## Antes de começar: o cuidado com este repositório

A Factory **nunca faz merge, deploy nem fecha PR**. Ela cria a branch `factory/c-N-…`, abre PRs e comenta nas issues de origem. Mesmo assim, o repositório parece ser trabalho de verdade. Duas formas seguras:

1. **Recomendada: um fork** (`juliopessan/src-amf-python-ensaio`). Rode tudo nele; se der errado, apague o fork.
2. Neste repositório mesmo: use só issues e PRs de ensaio com o prefixo `ENSAIO REAL:`, e ao final feche os PRs sem mesclar e apague as branches `factory/*` (passo 7).

Antes de tudo, confirme que a `main` exige pull request (o passo 1 mostra).

## 0. Preparação na VPS (você)

```bash
sudo bash /opt/super-factory/deploy/atualizar.sh
```

Publica os Lotes F, G e H (a VPS está no Lote E). Depois, no `.env` (`/opt/super-factory/.env`), **tetos baixos para o ensaio** (o padrão é largo demais para uma primeira vez):

```bash
SUPER_FACTORY_MAX_TOKENS_CARD=250000
SUPER_FACTORY_MAX_TOKENS_ONDA=600000
SUPER_FACTORY_MAX_TOKENS_DIA=1000000
```

Precisa também de `ANTHROPIC_API_KEY` e `GITHUB_TOKEN` (Settings → Chaves e acessos, no Studio). O token precisa de: Contents (leitura e escrita), Pull requests (leitura e escrita), Issues (leitura e escrita), Metadata (leitura) e, para o diagnóstico completo, Administration (leitura) e Actions/Checks (leitura).

## 1. Diagnóstico que não gasta nada (no chat do Studio, com o Chief)

Cole cada linha e anote o resultado.

| Peça ao Chief | Esperado | Se não for |
|---|---|---|
| `Confira o que o token alcança em juliopessan/src-amf-python` (`verificarTokenGithub`) | Escrita em issues, PRs e conteúdo: ok | A mensagem diz qual permissão falta |
| `Diagnostique a prontidão de juliopessan/src-amf-python` (`diagnosticarProntidaoGithub`) | "Projeto em src-maf/", testes e lint ok; sem typecheck, build e AGENTS.md (nota **parcial**). Mostra se a `main` exige PR | Se disser "sem comando de teste", a subpasta não foi detectada: **bug do Lote H** |
| `Valide o sandbox para juliopessan/src-amf-python` (`validarSandbox`) | **BLOCKED**: a imagem tem Python 3.11 e o projeto exige >= 3.13, com o conserto `--python 3.13` | Se der PASS antes de reconstruir a imagem, a comparação de versão falhou |

O BLOCKED é o resultado certo aqui: prova que a Factory **não gasta uma execução** num ambiente que não serve.

## 2. Construir o sandbox com Python 3.13 (você, na VPS)

```bash
sudo bash /opt/super-factory/deploy/construir-sandbox.sh --python 3.13
```

O script confere `Python 3.13` por dentro da imagem, grava `SUPER_FACTORY_SANDBOX_IMAGE` e recria o container da Factory. A imagem copia o Python oficial 3.13 (mesma base Debian) para `/usr/local`. **Esse caminho de build ainda não foi exercitado**: se o `docker build` falhar, guarde a saída. Depois repita `validarSandbox`: agora **PASS**.

## 3. Os cards do ensaio

Crie estas issues no GitHub (a label `super-factory` é o gatilho; peça ao Chief para criá-la se não existir). Os cards foram escolhidos para ser pequenos, testáveis offline e não tocar em segredo, Azure nem na pasta `functions/`.

**Issue A: bug (reprodução e vermelho→verde).** Título: `ENSAIO REAL: capitalize_partner ignora espaços em volta do nome`. Labels: `super-factory`, `bug`.

```markdown
Bug: `capitalize_partner(" aws ")` devolve "Aws" em vez de "AWS", e `capitalize_partner("  servicenow")`
devolve "Servicenow" em vez de "ServiceNow". Espaços antes ou depois do nome quebram a busca nas listas
de parceiros em maiúsculas e de marcas (src-maf/app/core/text.py).

## Critérios
- `capitalize_partner(" aws ")` retorna "AWS"
- `capitalize_partner("  servicenow")` retorna "ServiceNow"
- `capitalize_partner("acme corp")` continua retornando "Acme Corp" e `capitalize_partner("")` continua retornando ""
```

**Issue B: feature pequena em outro arquivo.** Título: `ENSAIO REAL: Rota de readiness em /api/v1/health/ready`. Label: `super-factory`.

```markdown
Adicionar `GET /api/v1/health/ready` ao router de health (src-maf/app/api/routers/health.py), no mesmo
estilo da rota `/live`, para o orquestrador saber quando o serviço pode receber tráfego.

## Critérios
- `GET /api/v1/health/ready` retorna 200 com o campo `status` igual a "Ready"
- A resposta inclui `timestampUtc` em ISO 8601 UTC, como a rota `/live`
- A resposta traz o header `X-Operation-Id`
```

**Issue C: deve ser barrada na triagem (custo zero).** Título: `ENSAIO REAL: Melhorar a performance da API`. Label: `super-factory`.

```markdown
Deixar a API mais rápida e agradável de usar.

## Critérios
- a definir
```

**Issue D (guarda do teto, usada no passo 6):** `ENSAIO REAL: Documentar as rotas de health no README`, critério: "O README de src-maf lista as rotas /live, /version e /ready com uma linha de descrição cada".

## 4. Onda 1: do card ao PR

Peça ao Chief, nesta ordem:

1. `Importe as issues etiquetadas super-factory de juliopessan/src-amf-python`. **Esperado:** 4 cards; o da issue C bloqueado na triagem ("a definir"), sem gastar nada.
2. `Leia o card C-<n>` para A e B (`lerCard`). **Esperado:** critérios, issue de origem, `podeIniciar: true`.
3. `Planeje uma onda do repositório juliopessan/src-amf-python-ensaio escolhendo exatamente os cards C-<A> e C-<B> e reserve` (`planejarOnda` com `repositorio`, `escolher`, `reservar`). **Esperado:** os dois IDs e um número de onda, sem aviso. O quadro é um só para todos os repositórios e costuma ter cards ready de outros projetos: sem `repositorio` o plano mistura (e avisa).
4. `Inicie a onda do repositório juliopessan/src-amf-python-ensaio com os cardIds C-<A> e C-<B> e peça a revisão dos PRs` (`iniciarOnda` por `cardIds`, com `repositorio`, `revisar: true`). Um card de outro repositório seria recusado e explicado. **Esperado:** "Onda N iniciada" e **nenhum card novo no quadro**. Anote o `runId`.
5. Acompanhe: `Mostre a onda N com o CI` (`lerOnda`, `comCI`) e `Quanto gastamos hoje?` (`lerCusto`). Cada execução leva alguns minutos.

## 5. O que conferir em cada PR (o coração do ensaio)

| Item | Onde ver | Esperado |
|---|---|---|
| Branch e base | PR | `factory/c-N-…` contra `main`; a Factory não empurrou na `main` |
| Rascunho ou pronto | PR | Pronto se tudo verde; rascunho com o motivo se não |
| Baseline | "Evidência do sandbox" | `testes → PASS (antes da mudança: PASS)` e `lint → PASS (antes: PASS)` |
| Comandos | Evidência | Começam com `cd 'src-maf' &&`: prova que rodou na subpasta |
| Vermelho→verde (só o bug A) | Evidência | PASS: o teste novo falha sem a correção. Se for FAIL/NOT_RUN, leia o motivo |
| Resultado por critério | "Resultado por critério" | PASS só com teste apontado no diff e suíte verde; o resto NOT_RUN com motivo. **Nenhum PASS sem teste** |
| Pontos de atenção | Fim do PR | Prontidão (sem AGENTS.md é normal) e, se houver, auditoria do construtor |
| Anti-slop | Evidência e Pontos de atenção | Se o diff mexer em teste, "Testes preservados → PASS". Qualquer nota de slop (erro engolido, print, TODO) é achado a registrar |
| Tamanho | PR | Bem abaixo de 400 linhas / 15 arquivos |
| Issue de origem | Issue | PR com `Closes #N` (verde) e comentário da Factory, uma vez |
| Revisão automática | Comentários do PR | Comentário do revisor (Opus), sem aprovar |
| CI do GitHub (`MAF CI`) | Checks do PR | `ruff`, `pytest` verdes. `bandit`, `pip-audit`, imagem e frontend podem falhar por motivos que a Factory não vê: **registre**, não é regressão dela |
| Tokens | `lerCusto` | Por card dentro do teto; anote a média para calibrar os tetos |

Cheque também o código: o PR do bug A deve mexer em `text.py` com um `strip()` (ou equivalente) e adicionar teste em `tests/test_text.py`; o do B, em `health.py` e `tests/test_health_and_errors.py`. Se a Factory tocar em `functions/`, `frontend/` ou segredo, é achado grave.

## 6. As guardas (provoque de propósito)

| Guarda | Como provocar | Esperado |
|---|---|---|
| **Teto de custo** | No `.env`, `SUPER_FACTORY_MAX_TOKENS_CARD=20000`; reinicie; inicie o card D | O card **para no meio** com "Teto de tokens do card atingido (… de 20.000)" e a variável a subir; **nenhum PR**. Depois restaure o teto |
| **Duplicata** | Com o PR do card A aberto, abra um card com o mesmo título e peça `planejarOnda` | O planejador **pula** o duplicado: "é o mesmo trabalho de C-… (review)" |
| **Sandbox BLOCKED** | Já feito no passo 1 | BLOCKED com conserto, sem execução |
| **Triagem** | Card C | Bloqueado em `blocked`, sem tokens |
| **Mover/editar** | `editarCard` no C com critérios observáveis, depois `moverCard` para `ready` | Edita, a triagem passa e só então vai para `ready` |
| **Resultado do PR** | Feche um PR sem mesclar, mescle outro; rode `medirResultadoDosPrs` | `recusado` e `aceito` (ou `ajustado`) por PR |

## 6b. Melhoria recursiva: comparar com e sem (depois do primeiro ensaio)

Só depois de ter a linha de base do passo 4 (os mesmos cards, sem melhoria):

1. No `.env`: `SUPER_FACTORY_MELHORIA=sim`. Reinicie.
2. Crie issues novas iguais às A e B (ou use um fork limpo) e rode a mesma onda.
3. Compare por card: a pontuação ("Melhoria (Improver): antes → depois" no PR), os critérios PASS e os tokens.
4. Depois de algumas execuções, peça ao Chief `Proponha lições a partir das execuções` (`proporLicoes`). Aprove **uma** com o seu nome (`decidirLicao`) e rode mais cards; `lerLicoes` mostra a pontuação antes e depois.

Esperado: a melhoria só roda quando há fraqueza medida (critério sem teste, bug sem prova); cada rodada aparece como adotada ou descartada; teste vermelho nunca é adotado; o custo extra cabe no teto. Se só gasta tokens sem subir a pontuação, desligue e me traga os números. Detalhes em [RSI.md](RSI.md).

## 7. Limpeza e o que me enviar

Limpeza (no fork, é só apagar o fork): feche os PRs `factory/*` **sem mesclar**, apague as branches `factory/*`, feche as issues de ensaio, restaure os tetos do `.env` e rode `medirResultadoDosPrs`.

Para eu ajustar a Factory com o que aconteceu, traga:

1. A saída de `lerOnda` e de `lerCusto`.
2. Os links dos PRs e das issues.
3. Para o que falhou: o motivo exibido no card e `docker logs --tail 200 super-factory`.
4. A saída do `construir-sandbox.sh --python 3.13`, se falhou.

## Critério de sucesso

O ensaio passou se **todas** forem verdade: (1) o preflight deu BLOCKED antes e PASS depois da imagem nova; (2) A e B chegaram a PR, rodando dentro de `src-maf/`; (3) o vermelho→verde do A foi PASS; (4) o resultado por critério ficou coerente com os testes (nenhum PASS sem teste); (5) nenhum card novo foi aberto ao iniciar por IDs; (6) o teto parou o card D sem PR; (7) a duplicata foi pulada.

Falha em qualquer item **é o resultado útil do ensaio**: o ponto é descobrir agora, num repositório descartável, e não na primeira onda de verdade.

## O que ainda não foi exercitado (riscos conhecidos)

- O build da imagem com `--python` (cópia do Python oficial para `/usr/local`) nunca rodou num Docker real.
- O callback `onStepFinish` do Mastra, que interrompe o agente no teto, só foi testado com agente simulado.
- O mapa de critérios depende de o modelo escrever as linhas `CRITERIO n: arquivo`; se vier mal formatado, os critérios ficam NOT_RUN (honesto, mas inútil). Se acontecer, ajusto o prompt.
- Projeto em subpasta cobre **um** nível. Repositório com projeto mais fundo, ou com vários projetos de peso igual na raiz, escolhe um e avisa os outros.
