import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modo servidor (standalone): permite rotas dinâmicas reais como
  // /nutritionist/students/[studentId]. Deploy: Cloud Run (mesma ideia da API Go).
  // LOCAL (dev): `npm run dev` — igual como sempre funcionou.
  // BUILD: `npm run build` gera `.next/standalone` (servidor Node autocontido).
  output: "standalone",
  trailingSlash: false,
  images: { unoptimized: true },
};

export default nextConfig;