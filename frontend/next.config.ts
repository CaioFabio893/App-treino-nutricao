import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exportação estática: gera a pasta out/ para o Firebase Hosting.
  // O app usa login e API via cliente — não precisa de servidor Node.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;