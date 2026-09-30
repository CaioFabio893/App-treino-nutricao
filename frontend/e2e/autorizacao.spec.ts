import { test, expect } from "@playwright/test";
import { login, USERS, idTokenFor, apiGet } from "./helpers";

test.describe("Autorização (API Go autenticada com idToken real do emulador)", () => {
  test("token inválido é rejeitado", async ({ request }) => {
    const res = await apiGet(request, "/api/me", "token-falso-123");
    expect(res.status()).toBe(401);
  });

  test("aluno não acessa rotas de admin", async ({ request }) => {
    const a = await idTokenFor(USERS.studentA.email, USERS.studentA.password);
    expect((await apiGet(request, "/api/users", a)).status()).toBe(403);
    expect((await apiGet(request, "/api/plans", a)).status()).toBe(404);
  });

  test("aluno aprovado acessa dieta sem plano", async ({ request }) => {
    const b = await idTokenFor(USERS.studentB.email, USERS.studentB.password);
    // A aprovação libera os módulos sem consultar planos legados.
    expect((await apiGet(request, "/api/diets", b)).status()).toBe(200);
  });

  test("aluno aprovado acessa treinos e dietas", async ({ request }) => {
    const a = await idTokenFor(USERS.studentA.email, USERS.studentA.password);

    expect((await apiGet(request, "/api/diets", a)).status()).toBe(200);
    expect((await apiGet(request, "/api/workouts", a)).status()).toBe(200);
    expect((await apiGet(request, "/api/workout-history", a)).status()).toBe(404);
  });

  test("frontend bloqueia aluno no /admin", async ({ page }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await page.goto("/admin");
    await page.waitForURL("**/dashboard");
  });
});
