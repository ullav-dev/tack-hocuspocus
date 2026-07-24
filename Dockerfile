# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Build (TypeScript -> dist/)
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runner — prod-only dependencies, compiled JS only.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

RUN addgroup --system --gid 1001 hocuspocus && \
    adduser --system --uid 1001 hocuspocus

COPY --from=builder --chown=hocuspocus:hocuspocus /app/dist ./dist

USER hocuspocus
EXPOSE 8088

CMD ["node", "dist/index.js"]
