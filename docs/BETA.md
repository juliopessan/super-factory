# Beta interno: checklist e roteiro

Para a apresentação ao time e a primeira semana de uso. Tudo aqui foi escrito com base no que foi testado; o que **não** foi testado de ponta a ponta está marcado.

## 1. Antes de apresentar (≈15 min, na véspera)

1. Atualize a VPS e confirme a versão:
   ```bash
   sudo bash /opt/super-factory/deploy/atualizar.sh
   ```
   O script termina com `✓ Atualizada: <commit>`. Se não responder: `docker logs --tail 80 super-factory`.
2. Abra o Studio e confira, nesta ordem:
   - **Agents**: o desenho "Como o time trabalha" aparece abaixo dos cards.
   - **Settings → Chaves e acessos**: as chaves que você vai usar estão como configuradas (ao menos a do modelo; para o modo autônomo de verdade, `ANTHROPIC_API_KEY` e `GITHUB_TOKEN`).
   - **Metrics** e **Logs**: abrem sem a mensagem "not available with your current storage".
   - No chat do Chief, digite `/`: o menu abre. Digite `/quadro` + Enter e envie.
3. **Ensaio completo**: Workflows → `autonomo` → marque *ensaio* e rode. As seis fases acendem, o card ganha o prefixo `[ENSAIO]` e nenhum repositório é tocado.
4. **Um teste real, uma vez, num repositório descartável.** O modo autônomo de verdade (container Docker + agente construtor + pull request) **nunca foi validado de ponta a ponta nesta VPS**. Faça um card pequeno hoje, para não descobrir amanhã na frente do time.

## 2. Roteiro de demo (≈10 min)

| Min | O que mostrar | Ponto a destacar |
|---|---|---|
| 0–1 | Landing e o vídeo | O que é: do pedido ao pull request |
| 1–2 | **Agents** e o time animado | Hierarquia; o único ponto humano é o merge |
| 2–4 | Chat do Chief: `/quadro`, depois `/branches` | Menu `/` e `@`; o agente executa com ferramentas |
| 4–6 | `/autonomo` em **ensaio**, ao vivo no canvas | Seis fases acendendo; sandbox por card |
| 6–7 | Workflow `onda` com 3 cards em ensaio | Paralelismo: 3 cards levam o tempo de 1 |
| 7–8 | **Settings → Chaves** e o **+** em MCP Servers: colar o `mcp.json` | Segredo no cofre, versão revisada do catálogo |
| 8–9 | **Metrics / Logs / Traces** | Observabilidade do que acabou de rodar |
| 9–10 | Onde o merge acontece | Nada é mergeado pela Factory |

Dica: se o modelo de chat estiver lento, comece o ensaio antes de falar e volte depois; a conversa e o trabalho continuam em segundo plano.

## 3. Limites conhecidos (diga antes que perguntem)

- **Modo autônomo real**: não validado de ponta a ponta (veja 1.4). O ensaio e os testes com sandbox de mentira passam.
- **MCPs do catálogo remoto** (Context7, GitHub, Microsoft Learn): a interpretação e a segurança estão testadas, mas a conexão real não foi testada daqui. Teste um antes.
- **GitHub Project**: ler e organizar foi validado na VPS (3 de 3 ações). Project de **usuário** exige token clássico com `repo` e `project`.
- **Voltar ao agente**: a conversa reabre sozinha, mas a resposta em andamento só aparece quando termina (limite do Studio).
- **O desenho do time é fixo no código**: agente novo precisa ser incluído em `src/super-factory/time-animado.ts`.
- **Login**: por padrão a Factory continua como estava (o login básico do Traefik, se o instalador o colocou). O login com GitHub e a lista de espera já existem, mas só ficam ativos quando você roda o `deploy/ativar-login.sh`. Veja a seção 7. Quem entra pode trocar as chaves.
- **Um modelo para todos os agentes**: o provedor é escolhido no chat. Custos de modelo sobem com o paralelismo (cada card chama o modelo).

## 4. Chaves de segurança (sem deploy de código)

No `.env` da VPS, depois `docker compose ... up -d`:

| Variável | Efeito |
|---|---|
| `SUPER_FACTORY_MENU=0` | Desliga o menu `/` e `@` do chat |
| `SUPER_FACTORY_PARALELISMO=1` | A onda roda um card por vez (padrão 3, máximo 5) |
| `SUPER_FACTORY_MCP_COMANDO` ausente | Comando personalizado de MCP continua desligado (padrão) |

Em qualquer dúvida na hora: use **ensaio**.

## 5. Voltar atrás

Versões conhecidas boas no `main`: `98f28e7` (menu e beta), `03af920` (time animado) e `b074987` (anterior). Para voltar:

```bash
cd /opt/super-factory
sudo -u "$(stat -c %U .)" git checkout b074987
sudo docker compose -f /docker/super-factory/docker-compose.yml up -d --build
```

Para seguir de novo no `main`: `git checkout main && git pull --ff-only`, depois `atualizar.sh`. O `atualizar.sh` falha em cabeça solta; volte ao `main` antes.

Os dados ficam em `/data` (volume): estado, cofre de chaves, MCPs e observabilidade sobrevivem a qualquer rollback.

## 6. Coletar feedback no beta

- **Traces e Logs** do Studio mostram o que cada agente fez e quanto levou.
- A trilha do card (ledger) registra o que foi observado e o que foi só relatado.
- Peça ao time que anote: tarefa tentada, o que esperava, o que aconteceu, e se precisou do ensaio.

## 7. Ligar o login e a lista de espera (faça com calma, não minutos antes da demo)

1. Crie o OAuth App no GitHub (callback `https://SEU-DOMINIO/auth/retorno`) e preencha o `.env` (README, seção *Login e lista de espera*).
2. `sudo bash /opt/super-factory/deploy/atualizar.sh`, depois `sudo bash /opt/super-factory/deploy/ativar-login.sh`. O script só segue com o `.env` completo, testa que o Studio ficou protegido e volta sozinho se não ficou.
3. Em **janela anônima**: abra o endereço, confira que cai em `/login`, entre com o seu GitHub (admin), abra `/admin/waitlist`, e cadastre-se na `/waitlist` com outro e-mail para ver o fluxo.
4. Convide o time: peça que preencham `/waitlist` (com o usuário do GitHub) e aprove em `/admin/waitlist`.

Se algo falhar: `sudo bash /opt/super-factory/deploy/ativar-login.sh --desfazer` volta ao login básico do Traefik.
