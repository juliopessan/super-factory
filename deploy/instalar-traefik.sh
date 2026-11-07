#!/usr/bin/env bash
# Instala a Super Factory atrás do Traefik que já roda na VPS (modelo Docker da Hostinger).
# Chamado por instalar-vps.sh quando encontra um Traefik. Pode rodar de novo à vontade.
# A Factory vira um container com labels, como as outras aplicações: o Traefik não é alterado.
set -euo pipefail

PASTA="${PASTA:-/opt/super-factory}"
DESTINO="${DESTINO:-/docker/super-factory}"
ARQ="$DESTINO/docker-compose.yml"

passo() { printf '\n\033[1;33m✻ %s\033[0m\n' "$1"; }
aviso() { printf '\033[1;33m! %s\033[0m\n' "$1"; }
falha() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" = 0 ] || falha "Rode como root: sudo bash instalar-vps.sh"
[ -f "$PASTA/deploy/docker-compose.traefik.yml" ] || falha "Não achei $PASTA/deploy. Rode antes o instalar-vps.sh."
cd "$PASTA"

IP="${IP:-$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')}"
DOMINIO="${DOMINIO:-factory.$(hostname -s).hstgr.cloud}"
[[ "$DOMINIO" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || falha "Domínio inválido: $DOMINIO"

passo "Docker e Compose"
command -v docker >/dev/null || falha "O Docker não está instalado."
if ! docker compose version >/dev/null 2>&1; then
  apt-get update -q
  apt-get install -y -q docker-compose-plugin || falha "Não consegui instalar o docker compose. Instale o plugin e rode de novo."
fi
docker compose version

passo "Endereço: https://$DOMINIO"
RESOLVIDO="$(getent hosts "$DOMINIO" | awk '{print $1; exit}' || true)"
if [ -z "$RESOLVIDO" ]; then
  aviso "O nome $DOMINIO ainda não aponta para lugar nenhum. Crie um registro A (ou um wildcard *.$(hostname -s).hstgr.cloud) para $IP."
  aviso "Sem isso o Let's Encrypt não emite o certificado. O Traefik tenta de novo sozinho quando o nome passar a existir."
elif [ "$RESOLVIDO" != "$IP" ]; then
  aviso "$DOMINIO aponta para $RESOLVIDO, e esta VPS é $IP. O certificado só sai se o nome apontar para cá."
else
  echo "O nome aponta para $IP."
fi

passo "Arquivo .env (chaves do modo autônomo)"
[ -f .env ] || cp .env.example .env
chmod 600 .env

passo "Login da Factory"
AUTH=""
if [ -f "$ARQ" ] && [ -z "${REFAZER_LOGIN:-}" ]; then
  AUTH="$(grep -oP 'basicauth\.users=\K\S+' "$ARQ" | head -1 || true)"
  [ -z "$AUTH" ] || echo "Mantendo o login já configurado (${AUTH%%:*}). Para trocar: REFAZER_LOGIN=1 sudo -E bash instalar-vps.sh"
fi
if [ -z "$AUTH" ]; then
  read -r -p "Usuário para entrar na Factory: " LOGIN </dev/tty
  [[ "$LOGIN" =~ ^[A-Za-z0-9._-]{3,32}$ ]] || falha "O usuário usa de 3 a 32 letras, números, ponto, hífen ou sublinhado."
  read -r -s -p "Senha (não aparece enquanto você digita): " SENHA </dev/tty; echo
  read -r -s -p "Repita a senha: " SENHA2 </dev/tty; echo
  [ "$SENHA" = "$SENHA2" ] || falha "As senhas não são iguais."
  [ "${#SENHA}" -ge 10 ] || falha "Use uma senha com pelo menos 10 caracteres."
  # O hash bcrypt sai de um container descartável. A senha viaja por stdin, nunca como argumento.
  HASH="$(printf '%s\n' "$SENHA" | docker run --rm -i httpd:2.4-alpine htpasswd -n -i -B -C 10 "$LOGIN")"
  unset SENHA SENHA2
  case "$HASH" in "$LOGIN":'$2y$'*) ;; *) falha "Não consegui gerar o hash da senha." ;; esac
  AUTH="${HASH//\$/\$\$}"   # no Compose, cada $ do hash precisa ser $$
fi

passo "Tirando a instalação anterior (serviço no host e Caddy)"
if [ -f /etc/systemd/system/super-factory.service ]; then
  systemctl disable --now super-factory 2>/dev/null || true
  rm -f /etc/systemd/system/super-factory.service
  systemctl daemon-reload
  echo "Serviço super-factory do host removido."
fi
# Só mexe no Caddy se ele foi instalado por este kit (o Caddyfile aponta para a Factory).
if [ -f /etc/caddy/Caddyfile ] && grep -q "reverse_proxy 127.0.0.1:4721" /etc/caddy/Caddyfile; then
  systemctl disable --now caddy 2>/dev/null || true
  apt-get purge -y -q caddy >/dev/null 2>&1 || true
  rm -f /etc/caddy/Caddyfile /etc/caddy/super-factory.login
  rm -f /etc/apt/sources.list.d/caddy-stable.list /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  echo "Caddy removido."
fi
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw delete allow 8443/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

passo "Compose em $ARQ"
mkdir -p "$DESTINO"
sed -e "s|__HOST__|$DOMINIO|g" -e "s|__AUTH__|$AUTH|g" deploy/docker-compose.traefik.yml > "$ARQ"
chmod 600 "$ARQ"
docker compose -f "$ARQ" config -q || falha "O compose gerado não passou na validação. Veja $ARQ"

passo "Construindo e subindo a Factory (alguns minutos na primeira vez)"
docker compose -f "$ARQ" up -d --build

passo "Esperando a Factory responder"
for _ in $(seq 1 60); do
  docker exec super-factory curl -fsS -o /dev/null http://127.0.0.1:4721/ 2>/dev/null && break
  sleep 3
done
if ! docker exec super-factory curl -fsS -o /dev/null http://127.0.0.1:4721/ 2>/dev/null; then
  docker logs --tail 40 super-factory 2>&1 | sed 's/^/  | /'
  falha "A Factory não respondeu. As linhas acima são o fim do log."
fi

passo "Conferindo a rota no Traefik"
CODIGO=000
for _ in $(seq 1 20); do
  CODIGO="$(curl -ks -o /dev/null -w '%{http_code}' --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/" || true)"
  [ "$CODIGO" = 401 ] && break
  sleep 3
done
if [ "$CODIGO" = 401 ]; then
  echo "O Traefik está encaminhando e pedindo login (401)."
else
  aviso "O Traefik respondeu $CODIGO em vez de 401. Veja: docker logs traefik-traefik-1 --tail 40"
fi

passo "Pronto"
cat <<FIM

  A Factory está em https://$DOMINIO  (Studio em https://$DOMINIO/studio)
  Entre com o usuário e a senha que você acabou de escolher.
  Se o navegador avisar sobre o certificado logo na primeira vez, espere
  cerca de um minuto (o Let's Encrypt está emitindo) e recarregue.

  Modo autônomo: coloque as chaves no .env e recrie o container:
    nano $PASTA/.env
    docker compose -f $ARQ up -d --force-recreate

  Atualizar depois:  sudo bash $PASTA/deploy/atualizar.sh
  Log:               docker logs -f super-factory
FIM
