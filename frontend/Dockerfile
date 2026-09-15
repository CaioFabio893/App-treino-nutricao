# Build do frontend (Next.js standalone)
# As variáveis NEXT_PUBLIC_* são embutidas no bundle durante o build.
# O .env.local não vai ao git e é excluído do contexto (.dockerignore), então
# o Cloud Build/Docker precisa fornecer os valores públicos via --build-arg.
# ⚠️ NUNCA passe secrets aqui: NEXT_PUBLIC_* é visível no bundle do navegador.
FROM node:20-alpine AS build
WORKDIR /app

# ── Build args públicos (fornecidos pelo gcloud builds submit / docker build) ──
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

# ── Expor os valores para o próximo estágio do build (npm run build) ──
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

# NEXT_PUBLIC_DEMO fica de fora de propósito: em produção o DEMO_MODE deve
# estar desligado, e o .env.local (que a ativa) é excluído do contexto docker.

COPY package*.json ./
RUN npm ci
COPY . .

# Sem .env.local: todas as NEXT_PUBLIC_* vêm dos build args acima.
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