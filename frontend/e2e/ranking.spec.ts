import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Ranking (pontuação calculada pelo backend no emulador)", () => {
  test("o topo reflete o score do ciclo: Ana > Bruno > Carla", async ({
    page,
  }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await page.getByRole("link", { name: "Ranking", exact: true }).click();
    await page.waitForURL("**/ranking");

    await expect(
      page.getByRole("heading", { name: "Ranking do ciclo" })
    ).toBeVisible();
    await expect(page.getByText("Top 3 de 3 alunos", { exact: false })).toBeVisible();

    const rows = page.locator(".rank-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator(".rank-pos")).toHaveText("🥇");
    await expect(rows.nth(0).locator(".rank-name")).toHaveText("Ana Aluna");
    await expect(rows.nth(1).locator(".rank-name")).toHaveText("Bruno Aluno");
    await expect(rows.nth(2).locator(".rank-name")).toHaveText("Carla Aluna");
    // O score vem da nota média diária (formatado com 1 casa).
    await expect(rows.nth(0).locator(".rank-score")).toHaveText(/^\d+\.\d$/);
  });
});