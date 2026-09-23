import { test, expect } from "@playwright/test";

// Os demais specs rodam com `serviceWorkers: "block"` (playwright.config.ts)
// para manter a execução determinística. Aqui liberamos o SW para exercitar o
// PWA real: precache do shell, fallback offline e não-cache de dados sensíveis.
test.use({ serviceWorkers: "allow" });

type Page = import("@playwright/test").Page;

// O PWA.tsx registra o SW; no primeiro `controllerchange` (clients.claim) ele
// recarrega a página uma única vez. Esta helper espera esse ciclo terminar e
// re-navega para uma página controlada e ESTÁVEL (sem novos reloads).
async function settleServiceWorker(page: Page) {
  await page.waitForFunction(() => "serviceWorker" in navigator);
  await page.evaluate(() => navigator.serviceWorker.ready).catch(() => {});
  await page.waitForTimeout(1500);
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
}

async function waitForPrecache(page: Page) {
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    if (names.length === 0) return false;
    const c = await caches.open(names[0]);
    const reqs = await c.keys();
    return reqs.length > 0;
  });
}

async function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const all: string[] = [];
    for (const n of names) {
      const c = await caches.open(n);
      const reqs = await c.keys();
      for (const r of reqs) all.push(r.url);
    }
    return all;
  });
}

test.describe("PWA — service worker real", () => {
  test("registra o service worker e faz precache do shell", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("voce@email.com")).toBeVisible();
    await settleServiceWorker(page);
    await waitForPrecache(page);

    const urls = await cachedUrls(page);
    // O shell precacheado inclui a rota de login (app continua utilizável offline).
    expect(urls.some((u) => u.endsWith("/login") || u.endsWith("/"))).toBe(true);
  });

  test("navegação offline serve o shell a partir do cache", async ({ page, context }) => {
    await page.goto("/login");
    await settleServiceWorker(page);
    await waitForPrecache(page);

    await context.setOffline(true);
    // Com o SW controlando a origem, a navegação cai no cache (network-first).
    const resp = await page.goto("/login");
    expect(resp).not.toBeNull();
    expect(resp!.ok()).toBe(true);
  });

  test("não cacheia rotas /api/* nem requests autenticadas", async ({ page }) => {
    await page.goto("/login");
    await settleServiceWorker(page);

    // Dispara chamadas autenticadas e rotas /api para o SW ter a chance de
    // interceptar — o SW NÃO deve interceptá-las (e, portanto, não cachear).
    await page.evaluate(async () => {
      await fetch("/api/me", { headers: { Authorization: "Bearer teste" } }).catch(() => {});
      await fetch("/api/workouts", { headers: { Authorization: "Bearer teste" } }).catch(() => {});
      await new Promise((r) => setTimeout(r, 300));
    });

    const urls = await cachedUrls(page);
    expect(urls.some((u) => u.includes("/api/"))).toBe(false);
  });
});
