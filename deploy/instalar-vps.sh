#!/usr/bin/env bash
# Instala a Super Factory numa VPS Ubuntu 22.04 ou 24.04.
# Uso, como root, na VPS:
#   curl -fsSL https://raw.githubusercontent.com/juliopessan/super-factory/main/deploy/instalar-vps.sh -o instalar-vps.sh
#   sudo bash instalar-vps.sh
# Pode rodar de novo: o que já está instalado é mantido.
set -euo pipefail

REPO="${REPO:-https://github.com/juliopessan/super-factory.git}"
PASTA="${PASTA:-/opt/super-factory}"
USUARIO="factory"

passo() { printf '\n\033[1;33m✻ %s\033[0m\n' "$1"; }
falha() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" = 0 ] || falha "Rode como root: sudo bash instalar-vps.sh"
. /etc/os-release
[ "${ID:-}" = ubuntu ] && { [ "${VERSION_ID:-}" = 22.04 ] || [ "${VERSION_ID:-}" = 24.04 ]; } \
  || falha "Este kit é para Ubuntu 22.04 ou 24.04. Encontrei: ${PRETTY_NAME:-desconhecido}."
[ "$(free -m | awk '/^Mem:/ {print $2}')" -ge 3500 ] || echo "Aviso: menos de 4 GB de RAM. O modo autônomo pode ficar lento."

IP="${IP:-$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')}"
[ -n "$IP" ] || falha "Não descobri o IP público. Rode de novo com IP=seu.ip sudo -E bash instalar-vps.sh"

passo "Pacotes básicos"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl git gnupg ufw debian-keyring debian-archive-keyring apt-transport-https

passo "Node 22"
if ! node -v 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
node -v

passo "Docker Engine (sandbox do modo autônomo)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io
fi
systemctl enable --now docker
docker pull -q node:22-bookworm

passo "Caddy (HTTPS e login)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

passo "Usuário $USUARIO, sem login de shell"
id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$USUARIO" --shell /usr/sbin/nologin "$USUARIO"
# O grupo docker equivale a root no host: é o preço de abrir containers para o modo autônomo.
usermod -aG docker "$USUARIO"

passo "Código em $PASTA"
if [ -d "$PASTA/.git" ]; then
  sudo -u "$USUARIO" git -C "$PASTA" pull --ff-only
else
  git clone "$REPO" "$PASTA"
  chown -R "$USUARIO:$USUARIO" "$PASTA"
fi
cd "$PASTA"
sudo -u "$USUARIO" npm ci --no-audit --no-fund
sudo -u "$USUARIO" npm run build

passo "Arquivo .env"
if [ ! -f .env ]; then
  sudo -u "$USUARIO" cp .env.example .env
fi
chmod 600 .env
chown "$USUARIO:$USUARIO" .env

passo "Serviço super-factory"
install -m 0644 deploy/super-factory.service /etc/systemd/system/super-factory.service
systemctl daemon-reload
systemctl enable super-factory
systemctl restart super-factory

passo "Portas do proxy"
# Modelos de VPS com Docker, Coolify, Dokploy ou n8n já trazem um Traefik nas portas 80 e 443.
# Nesse caso a Factory não mexe nele: o Caddy usa a 8443.
dono_da_porta() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -v caddy || true; }
PORTA_HTTPS="${PORTA_HTTPS:-443}"
if [ "$PORTA_HTTPS" = 443 ] && [ -n "$(dono_da_porta 443)" ]; then
  echo "A porta 443 já é usada por outro serviço:"
  dono_da_porta 443
  PORTA_HTTPS=8443
fi
[ -z "$(dono_da_porta "$PORTA_HTTPS")" ] || falha "A porta $PORTA_HTTPS também está ocupada. Rode de novo com PORTA_HTTPS=outra_porta sudo -E bash instalar-vps.sh"
REDIRECIONAR_HTTP=sim
[ -z "$(dono_da_porta 80)" ] || REDIRECIONAR_HTTP=nao
echo "Caddy em https://$IP:$PORTA_HTTPS"

passo "Login do proxy"
# Refaz o Caddyfile na primeira vez, quando a porta muda ou quando o modelo do kit mudou (marca de versão).
if ! grep -qF "https://$IP:$PORTA_HTTPS {" /etc/caddy/Caddyfile 2>/dev/null || ! grep -qF "super-factory-caddyfile v2" /etc/caddy/Caddyfile; then
  if [ -f /etc/caddy/super-factory.login ]; then
    . /etc/caddy/super-factory.login
    echo "Usando o login já guardado ($LOGIN)."
  else
    read -r -p "Usuário para entrar na Factory: " LOGIN </dev/tty
    [ -n "$LOGIN" ] || falha "O usuário não pode ficar vazio."
    echo "Agora a senha (não aparece enquanto você digita):"
    HASH="$(caddy hash-password </dev/tty)"
    printf 'LOGIN=%q\nHASH=%q\n' "$LOGIN" "$HASH" > /etc/caddy/super-factory.login
    chmod 600 /etc/caddy/super-factory.login
  fi
  sed -e "s|__IP__|$IP|g" -e "s|__PORTA__|$PORTA_HTTPS|g" -e "s|__LOGIN__|$LOGIN|g" -e "s|__HASH__|$HASH|g" deploy/Caddyfile > /etc/caddy/Caddyfile
  if [ "$REDIRECIONAR_HTTP" = sim ] && [ "$PORTA_HTTPS" = 443 ]; then
    printf '\nhttp://%s {\n\tredir https://{host}{uri} permanent\n}\n' "$IP" >> /etc/caddy/Caddyfile
  fi
  chmod 640 /etc/caddy/Caddyfile
  chown root:caddy /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl enable caddy
systemctl restart caddy
sleep 2
if ! systemctl is-active --quiet caddy; then
  journalctl -u caddy -n 25 --no-pager | grep -iE 'error|bind|address|permission' | tail -8 || true
  falha "O Caddy não subiu. As linhas acima mostram o motivo; o log inteiro está em: journalctl -u caddy -n 40"
fi

passo "Firewall: só SSH, 80 e 443"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow "$PORTA_HTTPS"/tcp >/dev/null
ufw --force enable >/dev/null
ufw status

passo "Pronto"
for _ in $(seq 1 30); do curl -fsS -o /dev/null http://127.0.0.1:4721/ && break; sleep 2; done
systemctl is-active --quiet super-factory || falha "O serviço não subiu. Veja: journalctl -u super-factory -n 80"
curl -fsS -o /dev/null http://127.0.0.1:4721/ || falha "A Factory não respondeu em 127.0.0.1:4721. Veja: journalctl -u super-factory -n 80"
CODIGO="$(curl -ks -o /dev/null -w '%{http_code}' "https://127.0.0.1:$PORTA_HTTPS/" -H "Host: $IP" || true)"
[ "$CODIGO" = 401 ] || echo "Aviso: o Caddy respondeu $CODIGO em https://$IP:$PORTA_HTTPS (esperado 401, o pedido de login)."
ENDERECO="https://$IP"; [ "$PORTA_HTTPS" = 443 ] || ENDERECO="https://$IP:$PORTA_HTTPS"
cat <<FIM

  A Factory está em $ENDERECO  (Studio em $ENDERECO/studio)
  O navegador vai avisar que o certificado não é conhecido: é o certificado
  do próprio Caddy, porque ainda não há domínio. Aceite uma vez.

  Para o modo autônomo, edite as chaves e reinicie:
    sudo -u $USUARIO nano $PASTA/.env
    sudo systemctl restart super-factory

  Para atualizar depois:  sudo bash $PASTA/deploy/atualizar.sh
FIM
