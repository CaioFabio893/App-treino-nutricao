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
    expect((await apiGet(request, "/api/plans", a)).status()).toBe(403);
  });

  test("features do plano bloqueiam módulos fora dele", async ({ request }) => {
    const b = await idTokenFor(USERS.studentB.email, USERS.studentB.password);
    // Bruno (Essencial: workouts+ranking) não tem dieta nem comunidade.
    expect((await apiGet(request, "/api/diets", b)).status()).toBe(403);
    expect((await apiGet(request, "/api/posts", b)).status()).toBe(403);

    const c = await idTokenFor(USERS.studentC.email, USERS.studentC.password);
    // Carla (só treinos) não tem ranking.
    expect((await apiGet(request, "/api/ranking", c)).status()).toBe(403);
  });

  test("aluno com a feature consegue usar o módulo", async ({ request }) => {
    const a = await idTokenFor(USERS.studentA.email, USERS.studentA.password);

    const ranking = await apiGet(request, "/api/ranking", a);
    expect(ranking.status()).toBe(200);
    const body = (await ranking.json()) as {
      top: { name: string }[];
      total: number;
    };
    expect(body.total).toBe(3);
    expect(body.top.length).toBeGreaterThanOrEqual(1);
    expect(body.top[0].name).toContain("Ana");

    expect((await apiGet(request, "/api/diets", a)).status()).toBe(200);
    expect((await apiGet(request, "/api/workouts", a)).status()).toBe(200);
    expect((await apiGet(request, "/api/workout-history", a)).status()).toBe(200);
  });

  test("frontend bloqueia aluno no /admin", async ({ page }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await page.goto("/admin");
    await page.waitForURL("**/dashboard");
  });
});