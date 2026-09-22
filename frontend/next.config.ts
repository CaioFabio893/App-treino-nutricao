import type { NextConfig } from "next";

// CSP (Content-Security-Policy):
// - default-src 'self': origem padrão restrita à própria aplicação.
// - script-src: 'unsafe-eval' NÃO é incluído em produção (o build do Next.js
//   não usa eval); 'unsafe-inline' necessário para scripts injetados pelo
//   React/Next.js.
// - style-src: 'unsafe-inline' necessário para estilos injetados pelo React/Next.js.
// - connect-src: Google APIs (Firebase Auth: identitytoolkit, securetoken),
//   Firebase RTDB, domínio do Cloud Run onde a API Go é publicada
//   (https://*.a.run.app — NEXT_PUBLIC_API_URL aponta pra lá em produção),
//   e WebSocket do dev server (HMR).
// A URL exata da API também entra no connect-src: o wildcard *.a.run.app
// cobre apenas UM nível de subdomínio, e na região southamerica-east1 o
// Cloud Run gera URLs com dois níveis (SERVICE-PROJ.southamerica-east1.run.app).
// Sem esta origem explícita o navegador bloquearia o fetch para a API.
// - frame-src: YouTube embeds em treinos (TodayWorkout).
// - frame-ancestors 'none': substitui X-Frame-Options DENY (mais moderno).
const isProd = process.env.NODE_ENV === "production";
// 'unsafe-eval' apenas em dev (HMR do Next.js/webpack).
const scriptSrc = isProd ? "'self' 'unsafe-inline'" : "'self' 'unsafe-eval' 'unsafe-inline'";
// Em dev, o browser acessa emuladores locais (Auth :9099, Firestore :8080,
// API :8081) e o HMR websocket por 127.0.0.1/localhost — origens que não
// existem em produção. Só são liberadas fora de produção (nunca em prod).
const devConnectSrc = isProd ? "" : " http://127.0.0.1:* http://localhost:* ws://127.0.0.1:*";
const CSP = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.a.run.app ws://localhost:* wss://localhost:*" +
    ((process.env.NEXT_PUBLIC_API_URL || "").trim() ? ` ${(process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "")}` : "") +
    devConnectSrc,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Modo servidor (standalone): permite rotas dinâmicas reais como
  // /nutritionist/students/[studentId]. Deploy: Cloud Run (mesma ideia da API Go).
  // LOCAL (dev): `npm run dev` — igual como sempre funcionou.
  // BUILD: `npm run build` gera `.next/standalone` (servidor Node autocontido).
  output: "standalone",
  trailingSlash: false,
  images: { unoptimized: true },

  // E2E local (dev): o Playwright acessa o app por `127.0.0.1`, mas a origem
  // canônica do `next dev` é `localhost`. O Next 16 bloqueia, por padrão,
  // recursos dev de origens diferentes (ex.: o websocket do HMR) — sem isso a
  // página carrega como SSR estático e o cliente não hidrata (bug "Carregando").
  // Só afeta desenvolvimento; produção ignora `allowedDevOrigins`.
  allowedDevOrigins: ["127.0.0.1"],

  // Hardening (política de segurança do projeto): proteção contra
  // clickjacking (X-Frame-Options), MIME sniffing (X-Content-Type-Options),
  // vazamento de referrer e abuso de APIs de hardware (Permissions-Policy).

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
      // PWA: o service worker precisa ser revalidado a cada visita (para pegar
      // novas versões) e poder controlar o escopo "/".
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // Manifest também revalidado: atualizações (ícones/screenshots) chegam logo.
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      // Ícones são imutáveis: cache longo no navegador e pelo SW.
      {
        source: "/icon-192.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/icon-512.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/icon-maskable-512.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/apple-touch-icon.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;