// Pipeline interno do E2E — roda DENTRO do `firebase emulators:exec`:
// 1. Sobe a API Go apontando para os emuladores (sem credenciais reais).
// 2. Espera o /health responder.
// 3. Roda o seed determinístico (backend/cmd/e2eseed).
// 4. Roda o Playwright (o webServer do config sobe o Next em :3100).
// 5. Mata o backend ao final — mesmo se os testes falharem.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontendDir = fileURLToPath(new URL("..", import.meta.url));
const backendDir = fileURLToPath(new URL("../../backend", import.meta.url));
const isWin = process.platform === "win32";

const backendEnv = {
  ...process.env,
  GO_ENV: "development",
  PORT: "8081",
  // Origem exata do Next dev — sem isso o CORS do front falha (nunca "*").
  ALLOWED_ORIGIN: "http://127.0.0.1:3100",
  // Projeto fixo do emulador: o Admin SDK lê estes hosts e ignora credenciais.
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099",
  GCLOUD_PROJECT: "treino-louise",
  GOOGLE_CLOUD_PROJECT: "treino-louise",
};
delete backendEnv.GOOGLE_APPLICATION_CREDENTIALS;

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (isWin) {
      spawnSync("cmd.exe", ["/d", "/c", `taskkill /PID ${child.pid} /T /F`], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    /* processo já morreu */
  }
}

async function waitForHealth(url, attempts = 90) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let backend = null;
let exitCode = 1;

try {
  console.log("→ subindo API Go em :8081 (emuladores)…");
  backend = spawn("go", ["run", "."], {
    cwd: backendDir,
    env: backendEnv,
    stdio: "inherit",
    detached: !isWin,
  });

  const up = await waitForHealth("http://127.0.0.1:8081/health");
  if (!up) {
    console.error("✗ backend não respondeu /health em 90s");
    exitCode = 1;
  } else {
    console.log("→ backend no ar · seed determinístico…");
    const seed = spawnSync("go", ["run", "./cmd/e2eseed"], {
      cwd: backendDir,
      env: backendEnv,
      stdio: "inherit",
    });
    if ((seed.status ?? 1) !== 0) {
      console.error("✗ seed falhou");
      exitCode = seed.status ?? 1;
    } else {
      console.log("→ playwright test…");
      const pw = spawnSync("npx", ["playwright", "test"], {
        cwd: frontendDir,
        env: backendEnv,
        stdio: "inherit",
        shell: isWin,
      });
      exitCode = pw.status ?? 1;
    }
  }
} finally {
  killTree(backend);
}

process.exit(exitCode);