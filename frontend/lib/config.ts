// Modo demonstrativo: navega o app SEM Firebase/API, com dados de exemplo
// salvos no navegador. Ative com NEXT_PUBLIC_DEMO=1 no frontend/.env.local.
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO === "1" ||
  process.env.NEXT_PUBLIC_DEMO === "true" ||
  process.env.NEXT_PUBLIC_DEMO === "demo";