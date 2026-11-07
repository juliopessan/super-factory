# Imagem da Super Factory. O build do Mastra roda aqui dentro, então a VPS não precisa de Node.
FROM node:22-bookworm
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production \
    SUPER_FACTORY_HOST=0.0.0.0 \
    FACTORY_STATE_PATH=/data/state.json \
    SUPER_FACTORY_DB=file:/data/factory.db
VOLUME ["/data"]
EXPOSE 4721
CMD ["npm", "start"]
