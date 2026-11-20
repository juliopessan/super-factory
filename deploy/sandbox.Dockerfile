# Imagem do sandbox dos cards: o container descartável onde o construtor escreve o código e os testes rodam.
# A imagem da Factory em si (deploy/Dockerfile) é outra. Esta traz o que os repositórios dos clientes costumam pedir:
# Node (já vem), git, Python 3 com pip e venv, e o comando "python". FFmpeg é opcional (--build-arg COM_FFMPEG=1).
#
# Construir e ligar: sudo bash /opt/super-factory/deploy/construir-sandbox.sh
FROM node:22-bookworm

ARG COM_FFMPEG=0

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip python3-venv python-is-python3 \
 && if [ "$COM_FFMPEG" = "1" ]; then apt-get install -y --no-install-recommends ffmpeg; fi \
 && rm -rf /var/lib/apt/lists/*

# O Debian 12 marca o Python como "gerenciado pelo sistema" (PEP 668) e o pip recusa instalar. Este container é
# descartável (um por card, apagado no fim), então liberar o pip aqui não suja nada que dure.
ENV PIP_BREAK_SYSTEM_PACKAGES=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_INPUT=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /workspace
