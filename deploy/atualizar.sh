#!/usr/bin/env bash
# Atualiza a Super Factory na VPS para a versão do main. Funciona nos dois modos:
# atrás do Traefik (container) ou atrás do Caddy (serviço no host).
set -euo pipefail
PASTA="${PASTA:-/opt/super-factory}"
COMPOSE="${COMPOSE:-/docker/super-factory/docker-compose.yml}"
[ "$(id -u)" = 0 ] || { echo "Rode como root: sudo bash $PASTA/deploy/atualizar.sh"; exit 1; }
cd "$PASTA"
DONO="$(stat -c %U "$PASTA")"

if [ -f "$COMPOSE" ]; then
  sudo -u "$DONO" git pull --ff-only
  docker compose -f "$COMPOSE" up -d --build
  for _ in $(seq 1 60); do
    if docker exec super-factory curl -fsS -o /dev/null http://127.0.0.1:4721/ 2>/dev/null; then
      echo "✓ Atualizada: $(git log --oneline -1)"
      exit 0
    fi
    sleep 3
  done
  echo "✗ Não respondeu. Veja: docker logs --tail 80 super-factory"
  exit 1
fi

sudo -u factory git pull --ff-only
sudo -u factory npm ci --no-audit --no-fund
sudo -u factory npm run build
install -m 0644 deploy/super-factory.service /etc/systemd/system/super-factory.service
systemctl daemon-reload
systemctl restart super-factory
sleep 3
if systemctl is-active --quiet super-factory; then
  echo "✓ Atualizada: $(git log --oneline -1)"
else
  echo "✗ Não subiu. Veja: journalctl -u super-factory -n 80"
  exit 1
fi
