import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Treino Ciclo 2 — Louise Lima",
  description: "Planilha de treino hipertrofia — Ciclo 2 · Louise Lima",
  manifest: "/manifest.json",
  icons: { apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Treino", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#c0622a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}