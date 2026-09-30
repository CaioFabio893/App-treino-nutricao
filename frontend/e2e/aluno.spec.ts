import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Área do aluno (cadastro aprovado)", () => {
  test("aluno aprovado vê treinos e dietas", async ({ page }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("link", { name: "Treino", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dieta", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comunidade", exact: true })).toHaveCount(0);
  });

  test("a área Treino usa somente a lista de programas completos", async ({ page }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await page.getByRole("link", { name: "Treino", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Treino" })).toBeVisible();
    await expect(page.locator(".wod-chip")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Seções do aluno" }).getByRole("link")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Programa", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /FINALIZAR|Registrar|Marcar/ })).toHaveCount(0);
    await expect(page.locator("input, textarea, .chk-btn")).toHaveCount(0);
  });

  test("aluno aprovado vê dieta sem depender de plano", async ({
    page,
  }) => {
    await login(page, USERS.studentB.email, USERS.studentB.password);
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("link", { name: "Treino", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dieta", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comunidade", exact: true })).toHaveCount(0);
    await page.goto("/dietas");
    await page.waitForURL("**/dietas");
  });
});
