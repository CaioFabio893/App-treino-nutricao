# Build do frontend (Next.js standalone)
# As variáveis NEXT_PUBLIC_* são embutidas no build — garanta que o .env.local
# exista nesta pasta antes de compilar (ou use --build-arg).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Docker build não tem .env.local por padrão (não vai ao git). Copiamos se existir.
RUN npm run build

# Runtime: o Next com `output: "standalone"` gera um servidor Node autocontido
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]