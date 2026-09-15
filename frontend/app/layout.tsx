import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./base.css";
import "./dashboard.css";
import "./student.css";
import Providers from "@/components/Providers";

// Tipografia self-hosted com next/font: os arquivos são baixados no build e
// servidos junto com os assets do app — sem requisição externa ao Google
// Fonts (melhor para privacidade, performance e modo offline do PWA).
// Pesos idênticos aos que o <link> antigo carregava, para não mudar o layout.
// As variáveis --font-head/--font-body são referenciadas no CSS em
// base.css/dashboard.css (--d-head/--d-body).
const fontHead = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-head",
  display: "swap",
});

const fontBody = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Treino Ciclo 2 — Louise Lima",
  description: "Planilha de treino hipertrofia — Ciclo 2 · Louise Lima",
  manifest: "/manifest.json",
  icons: { apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Treino", statusBarStyle: "default" },
};

// Zoom liberado (acessibilidade — WCAG 1.4.4): sem maximumScale/userScalable.
export const viewport: Viewport = {
  themeColor: "#0B6B52",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fontHead.variable} ${fontBody.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}