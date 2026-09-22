import { defineConfig, devices } from "@playwright/test";

// Testes E2E (Fase 3) rodam contra a stack local completa:
//   Firebase Auth Emulator (9099) + Firestore Emulator (8080) +
//   API Go (8081, com env de emulador) + Next dev (3100).
// A orquestração fica em e2e/run-e2e.mjs (sobe emuladores + backend + seed
// via `firebase emulators:exec`); este config cuida SÓ do app web.
const E2E_PORT = 3100;
const API_PORT = 8081;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // sessão de auth compartilhada pelo emulador: execução serial
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // O service worker do PWA chama clients.claim() no activate e o PWA.tsx
    // recarrega a página em "controllerchange" — isso causa reloads
    // imprevisíveis no meio dos testes. Em E2E o SW é bloqueado para manter
    // o teste determinístico (produção não é afetada).
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Sobrescreve o .env.local (que tem NEXT_PUBLIC_DEMO=1): processo externo
    // vence variáveis de arquivo no Next. A API aponta para o backend local
    // e o Firebase usa chaves fake + flag do Auth Emulator.
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO: "",
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
      NEXT_PUBLIC_FIREBASE_API_KEY: "e2e-fake-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "treino-louise.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "treino-louise",
      NEXT_PUBLIC_FIREBASE_APP_ID: "e2e-fake-app-id",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "treino-louise.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR: "1",
    },
  },
});