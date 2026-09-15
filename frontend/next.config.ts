import type { NextConfig } from "next";

// CSP (Content-Security-Policy):
// - default-src 'self': origem padrão restrita à própria aplicação.
// - script-src: 'unsafe-eval' necessário para HMR do Next.js em dev;
//   'unsafe-inline' necessário para scripts injetados pelo React/Next.js.
// - style-src: 'unsafe-inline' necessário para estilos injetados pelo React/Next.js.
// - connect-src: Google APIs (Firebase Auth: identitytoolkit, securetoken),
//   Firebase RTDB, e WebSocket do dev server (HMR). A API Go é same-origin
//   (proxy/reverse em produção — NEXT_PUBLIC_API_URL vazio). Se a API for
//   cross-origin, adicione o domínio em connect-src.
// - frame-src: YouTube embeds em treinos (TodayWorkout).
// - frame-ancestors 'none': substitui X-Frame-Options DENY (mais moderno).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com ws://localhost:* wss://localhost:*",
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