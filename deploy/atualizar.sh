#!/usr/bin/env bash
# Atualiza a Super Factory na VPS para a versão do main e reinicia o serviço.
set -euo pipefail
PASTA="${PASTA:-/opt/super-factory}"
[ "$(id -u)" = 0 ] || { echo "Rode como root: sudo bash $PASTA/deploy/atualizar.sh"; exit 1; }
cd "$PASTA"
sudo -u factory git pull --ff-only
sudo -u factory npm ci --no-audit --no-fund
sudo -u factory npm run build
install -m 0644 deploy/super-factory.service /etc/systemd/system/super-factory.service
systemctl daemon-reload
systemctl restart super-factory
sleep 3
systemctl is-active --quiet super-factory && echo "✓ Atualizada: $(git log --oneline -1)" || { echo "✗ Não subiu. Veja: journalctl -u super-factory -n 80"; exit 1; }
