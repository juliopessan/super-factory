#!/usr/bin/env bash
# Liga o login da própria Factory (GitHub OAuth + waitlist) e tira o login básico do Traefik, que esconderia
# a landing e a lista de espera. Modo Traefik (container). Reversível: bash deploy/ativar-login.sh --desfazer
#
# Antes de rodar, no .env da VPS (/opt/super-factory/.env):
#   SUPER_FACTORY_AUTH=github
#   GITHUB_OAUTH_CLIENT_ID=...          (GitHub > Settings > Developer settings > OAuth Apps)
#   GITHUB_OAUTH_CLIENT_SECRET=...
#   SUPER_FACTORY_PUBLIC_URL=https://factory.seu-dominio
#   SUPER_FACTORY_ADMINS=seu-usuario-github[,outro]
# Callback URL do OAuth App: <SUPER_FACTORY_PUBLIC_URL>/auth/retorno
set -euo pipefail
PASTA="${PASTA:-/opt/super-factory}"
COMPOSE="${COMPOSE:-/docker/super-factory/docker-compose.yml}"
[ "$(id -u)" = 0 ] || { echo "Rode como root: sudo bash $PASTA/deploy/ativar-login.sh"; exit 1; }
cd "$PASTA"
[ -f .env ] || { echo "✗ Não achei $PASTA/.env"; exit 1; }
[ -f "$COMPOSE" ] || { echo "✗ Este script cobre o modo Traefik ($COMPOSE não existe). No modo Caddy, tire o bloco basic_auth do Caddyfile e rode o atualizar.sh."; exit 1; }
COPIA="$COMPOSE.com-basicauth"

definir() { # definir CHAVE valor: troca ou acrescenta no .env
  if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else printf '\n%s=%s\n' "$1" "$2" >> .env; fi
}

if [ "${1:-}" = "--desfazer" ]; then
  [ -f "$COPIA" ] || { echo "✗ Sem cópia do compose original ($COPIA). Nada a desfazer."; exit 1; }
  cp "$COPIA" "$COMPOSE"
  definir SUPER_FACTORY_AUTH off
  docker compose -f "$COMPOSE" up -d --force-recreate
  echo "✓ Voltou ao login básico do Traefik e SUPER_FACTORY_AUTH=off."
  exit 0
fi

faltando=()
for v in SUPER_FACTORY_AUTH GITHUB_OAUTH_CLIENT_ID GITHUB_OAUTH_CLIENT_SECRET SUPER_FACTORY_PUBLIC_URL SUPER_FACTORY_ADMINS; do
  grep -qE "^$v=.+" .env || faltando+=("$v")
done
grep -qE '^SUPER_FACTORY_AUTH=github' .env || faltando+=("SUPER_FACTORY_AUTH=github")
if [ "${#faltando[@]}" -gt 0 ]; then
  echo "✗ Falta no $PASTA/.env: ${faltando[*]}"
  echo "  Nada foi alterado. O login básico do Traefik continua protegendo tudo."
  exit 1
fi

[ -f "$COPIA" ] || cp "$COMPOSE" "$COPIA"
sed -i '/traefik.http.middlewares.super-factory-auth.basicauth.users=/d' "$COMPOSE"
sed -i 's/middlewares=super-factory-auth,super-factory-hsts/middlewares=super-factory-hsts/' "$COMPOSE"
docker compose -f "$COMPOSE" up -d --force-recreate

for _ in $(seq 1 60); do
  if docker exec super-factory curl -fsS -o /dev/null http://127.0.0.1:4721/ 2>/dev/null; then break; fi
  sleep 3
done
studio="$(docker exec super-factory curl -s -o /dev/null -w '%{http_code}' -H 'Accept: text/html' http://127.0.0.1:4721/studio || true)"
api="$(docker exec super-factory curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4721/api/agents || true)"
if [ "$studio" = "302" ] && [ "$api" = "401" ]; then
  echo "✓ Login ligado. Studio sem sessão: $studio (vai para /login) · API sem sessão: $api."
  echo "  Teste agora em uma janela anônima: abra o endereço da Factory e entre com o GitHub."
  echo "  Para voltar: sudo bash $PASTA/deploy/ativar-login.sh --desfazer"
else
  echo "✗ O Studio NÃO ficou protegido (Studio=$studio, API=$api). Voltando ao login do Traefik."
  cp "$COPIA" "$COMPOSE"
  docker compose -f "$COMPOSE" up -d --force-recreate
  echo "  Veja: docker logs --tail 40 super-factory"
  exit 1
fi
