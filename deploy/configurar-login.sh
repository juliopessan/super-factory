#!/usr/bin/env bash
# Assistente do login com GitHub: pergunta o que falta, grava no .env com segurança e liga (chama ativar-login.sh).
# O Client Secret é digitado aqui, no terminal da VPS (não aparece na tela e não passa por chat nenhum).
#   sudo bash /opt/super-factory/deploy/configurar-login.sh
set -euo pipefail
PASTA="${PASTA:-/opt/super-factory}"
COMPOSE="${COMPOSE:-/docker/super-factory/docker-compose.yml}"
[ "$(id -u)" = 0 ] || [ "${SF_TESTE:-}" = 1 ] || { echo "Rode como root: sudo bash $PASTA/deploy/configurar-login.sh"; exit 1; }
cd "$PASTA"
[ -f .env ] || { echo "✗ Não achei $PASTA/.env"; exit 1; }

HOST="${SF_HOST:-}"
if [ -z "$HOST" ] && [ -f "$COMPOSE" ]; then
  HOST="$(grep -oE 'Host\(`[^`]+`\)' "$COMPOSE" | head -1 | sed -E 's/Host\(`([^`]+)`\)/\1/' || true)"
fi
[ -n "$HOST" ] || read -rp "Endereço da Factory (ex.: factory.seudominio.com): " HOST
HOST="${HOST#https://}"; HOST="${HOST%%/*}"
[[ "$HOST" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "✗ Endereço inválido: $HOST"; exit 1; }

cat <<MSG

1) No GitHub abra https://github.com/settings/developers → OAuth Apps → New OAuth App e preencha:
     Application name ........ Super Factory
     Homepage URL ............ https://$HOST
     Authorization callback .. https://$HOST/auth/retorno      (tem de ser exatamente este)
2) Depois de criar, copie o Client ID e gere um Client Secret ("Generate a new client secret").

MSG
read -rp "Client ID: " ID
read -rsp "Client Secret (não aparece enquanto digita): " SEC; echo
read -rp "Seu usuário do GitHub (vai ser o administrador): " ADM
ADM="${ADM#@}"
[[ "$ID" =~ ^[A-Za-z0-9._-]{8,60}$ ]] || { echo "✗ Client ID com formato estranho."; exit 1; }
[[ "$SEC" =~ ^[A-Za-z0-9._-]{16,120}$ ]] || { echo "✗ Client Secret com formato estranho (copie só o valor, sem espaços)."; exit 1; }
[[ "$ADM" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,38}$ ]] || { echo "✗ Usuário do GitHub inválido."; exit 1; }

COPIA=".env.antes-do-login-$(date +%Y%m%d-%H%M%S)"
cp -p .env "$COPIA"
TMP="$(mktemp)"
# Remove as linhas antigas dessas variáveis e acrescenta as novas (sem sed, para o segredo não virar expressão).
grep -vE '^(SUPER_FACTORY_AUTH|GITHUB_OAUTH_CLIENT_ID|GITHUB_OAUTH_CLIENT_SECRET|SUPER_FACTORY_PUBLIC_URL|SUPER_FACTORY_ADMINS)=' .env > "$TMP" || true
{
  printf '\n# Login com GitHub (configurar-login.sh)\n'
  printf 'SUPER_FACTORY_AUTH=github\n'
  printf 'GITHUB_OAUTH_CLIENT_ID=%s\n' "$ID"
  printf 'GITHUB_OAUTH_CLIENT_SECRET=%s\n' "$SEC"
  printf 'SUPER_FACTORY_PUBLIC_URL=https://%s\n' "$HOST"
  printf 'SUPER_FACTORY_ADMINS=%s\n' "$ADM"
} >> "$TMP"
cat "$TMP" > .env
rm -f "$TMP"
chmod 600 .env
echo "✓ .env atualizado (cópia do anterior em $COPIA)."

if [ "${SF_TESTE:-}" = 1 ]; then echo "(teste: não liguei)"; exit 0; fi
echo "Ligando o login e conferindo se o Studio ficou protegido…"
exec bash "$PASTA/deploy/ativar-login.sh"
