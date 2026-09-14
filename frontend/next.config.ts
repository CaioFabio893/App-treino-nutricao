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
    ];
  },
};

export default nextConfig;