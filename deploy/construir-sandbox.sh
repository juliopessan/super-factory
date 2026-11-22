#!/usr/bin/env bash
# Constrói a imagem do sandbox dos cards (com Python e pip) e liga a Factory a ela.
#   sudo bash /opt/super-factory/deploy/construir-sandbox.sh [--com-ffmpeg] [--com-browser] [--python 3.13]
# Faz: constrói a imagem, confere que python3, pip e git funcionam dentro dela, grava
# SUPER_FACTORY_SANDBOX_IMAGE no .env (com cópia do anterior) e recria o container da Factory.
# Não mexe em nenhum outro projeto da VPS.
set -euo pipefail
PASTA="${PASTA:-/opt/super-factory}"
COMPOSE="${COMPOSE:-/docker/super-factory/docker-compose.yml}"
IMAGEM="${IMAGEM:-super-factory-sandbox:latest}"
COM_FFMPEG=0
COM_BROWSER=0
PYTHON_NOVO=
PROXIMO_E_PYTHON=0
for arg in "$@"; do
  if [ "$PROXIMO_E_PYTHON" = 1 ]; then
    case "$arg" in [0-9].[0-9]|[0-9].[0-9][0-9]) PYTHON_NOVO="$arg" ;; *) echo "--python pede uma versão como 3.13"; exit 2 ;; esac
    PROXIMO_E_PYTHON=0
    continue
  fi
  case "$arg" in
    --python) PROXIMO_E_PYTHON=1 ;;
    --com-ffmpeg) COM_FFMPEG=1 ;;
    --com-browser) COM_BROWSER=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $arg"; exit 2 ;;
  esac
done
[ "$(id -u)" = 0 ] || { echo "Rode como root: sudo bash $PASTA/deploy/construir-sandbox.sh"; exit 1; }
command -v docker >/dev/null || { echo "✗ Docker não encontrado."; exit 1; }
cd "$PASTA"
[ -f .env ] || { echo "✗ Não achei $PASTA/.env"; exit 1; }
[ -f deploy/sandbox.Dockerfile ] || { echo "✗ Não achei deploy/sandbox.Dockerfile. Rode antes: sudo bash $PASTA/deploy/atualizar.sh"; exit 1; }

echo "→ Construindo $IMAGEM (Python 3 + pip$([ "$COM_FFMPEG" = 1 ] && echo ' + FFmpeg')$([ "$COM_BROWSER" = 1 ] && echo ' + navegador'))…"
docker build -f deploy/sandbox.Dockerfile --build-arg "COM_FFMPEG=$COM_FFMPEG" --build-arg "COM_BROWSER=$COM_BROWSER" --build-arg "PYTHON_VERSION=${PYTHON_NOVO:-3.13}" --build-arg "USAR_PYTHON_NOVO=$([ -n "$PYTHON_NOVO" ] && echo 1 || echo 0)" -t "$IMAGEM" deploy

echo "→ Conferindo a imagem por dentro…"
SAIDA="$(docker run --rm "$IMAGEM" bash -lc 'python3 --version && python --version && pip --version && git --version && node --version')" \
  || { echo "✗ A imagem foi construída, mas um destes falhou: python3, python, pip, git, node."; exit 1; }
echo "$SAIDA" | sed 's/^/   /'
if [ -n "$PYTHON_NOVO" ]; then
  echo "$SAIDA" | grep -q "Python $PYTHON_NOVO" || { echo "✗ A imagem foi construída, mas o python3 dela não é o $PYTHON_NOVO."; exit 1; }
fi
if [ "$COM_FFMPEG" = 1 ]; then
  docker run --rm "$IMAGEM" ffmpeg -version | head -1 | sed 's/^/   /'
fi

if [ "$COM_BROWSER" = 1 ]; then
  docker run --rm "$IMAGEM" bash -lc 'NODE_PATH="$(npm root -g)" node -e "const {chromium}=require(\"playwright\");chromium.launch({args:[\"--no-sandbox\"]}).then(b=>b.close()).then(()=>console.log(\"navegador ok\"))"' | sed 's/^/   /' \
    || { echo "✗ A imagem foi construída, mas o navegador não abriu."; exit 1; }
fi

COPIA=".env.antes-do-sandbox-$(date +%Y%m%d-%H%M%S)"
cp -p .env "$COPIA"
TMP="$(mktemp)"
grep -vE '^SUPER_FACTORY_SANDBOX_IMAGE=' .env > "$TMP" || true
printf 'SUPER_FACTORY_SANDBOX_IMAGE=%s\n' "$IMAGEM" >> "$TMP"
if [ "$COM_BROWSER" = 1 ]; then
  grep -vE '^SUPER_FACTORY_NAVEGADOR=' "$TMP" > "$TMP.2" || true
  printf 'SUPER_FACTORY_NAVEGADOR=sim\n' >> "$TMP.2"
  cat "$TMP.2" > "$TMP"; rm -f "$TMP.2"
fi
cat "$TMP" > .env
rm -f "$TMP"
chmod 600 .env
echo "✓ .env atualizado (cópia do anterior em $COPIA)."

if [ -f "$COMPOSE" ]; then
  # O env_file só é lido quando o container nasce: recria só a Factory.
  docker compose -f "$COMPOSE" up -d --force-recreate
  for _ in $(seq 1 60); do
    if docker exec super-factory curl -fsS -o /dev/null http://127.0.0.1:4721/ 2>/dev/null; then
      echo "✓ Pronto. Os próximos cards rodam em $IMAGEM."
      echo "  Para voltar à imagem padrão: apague a linha SUPER_FACTORY_SANDBOX_IMAGE do .env e recrie o container."
      exit 0
    fi
    sleep 3
  done
  echo "✗ A Factory não respondeu. Veja: docker logs --tail 80 super-factory"
  exit 1
fi
echo "✓ Imagem pronta e .env atualizado. Reinicie a Factory (systemctl restart super-factory) para valer."
