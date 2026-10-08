FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY client ./client
COPY public ./public
COPY vite.config.js ./
RUN npm run build

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils fonts-liberation clamav ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /app/storage && chown node:node /app/storage
COPY --from=build /app/dist ./dist
COPY server ./server
COPY database ./database
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
