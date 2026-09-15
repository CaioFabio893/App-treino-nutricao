import type { NextConfig } from "next";

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