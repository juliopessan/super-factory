# Imagem do sandbox dos cards: o container descartável onde o construtor escreve o código e os testes rodam.
# A imagem da Factory em si (deploy/Dockerfile) é outra. Esta traz o que os repositórios dos clientes costumam pedir:
# Node (já vem), git, Python 3 com pip e venv, e o comando "python". FFmpeg é opcional (--build-arg COM_FFMPEG=1).
#
# Construir e ligar: sudo bash /opt/super-factory/deploy/construir-sandbox.sh [--python 3.13]
#
# O Python do Debian 12 é o 3.11. Projeto que exige mais novo (requires-python >= 3.13) não instala nele. Com --python X.Y, o
# Python oficial dessa versão (mesma base Debian) é copiado para /usr/local e passa a ser o python3 e o pip do sandbox.
ARG PYTHON_VERSION=3.13
FROM python:${PYTHON_VERSION}-slim-bookworm AS python-novo

FROM node:22-bookworm
ARG USAR_PYTHON_NOVO=0

ARG COM_FFMPEG=0
# Navegador para a Factory abrir o app do card e ler o console (Playwright + Chromium). Pesa cerca de 600 MB: só com --com-browser.
ARG COM_BROWSER=0

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip python3-venv python-is-python3 \
 && if [ "$COM_FFMPEG" = "1" ]; then apt-get install -y --no-install-recommends ffmpeg; fi \
 && rm -rf /var/lib/apt/lists/*

RUN if [ "$COM_BROWSER" = "1" ]; then \
      npm install -g playwright@1.49.1 \
   && PLAYWRIGHT_BROWSERS_PATH=/ms-playwright npx playwright install --with-deps chromium \
   && rm -rf /var/lib/apt/lists/*; \
    fi
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=python-novo /usr/local /opt/python-novo
RUN if [ "$USAR_PYTHON_NOVO" = "1" ]; then cp -a /opt/python-novo/. /usr/local/ && ldconfig; fi && rm -rf /opt/python-novo

# O Debian 12 marca o Python como "gerenciado pelo sistema" (PEP 668) e o pip recusa instalar. Este container é
# descartável (um por card, apagado no fim), então liberar o pip aqui não suja nada que dure.
ENV PIP_BREAK_SYSTEM_PACKAGES=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_INPUT=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /workspace
