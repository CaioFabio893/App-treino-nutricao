import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Área do aluno (cadastro aprovado)", () => {
  test("aluno aprovado vê treinos e dietas", async ({ page }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("link", { name: "Treinos", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dietas", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comunidade", exact: true })).toHaveCount(0);
  });

  test("aluno consulta exercícios sem controles de registro", async ({ page }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await page.getByRole("link", { name: "Treinos", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Seus treinos" })).toBeVisible();
    await expect(page.locator(".wod-chip").filter({ hasText: "Treino de Hoje E2E" })).toBeVisible();
    await expect(page.locator(".ex-name").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /FINALIZAR|Registrar|Marcar/ })).toHaveCount(0);
    await expect(page.locator("input, textarea, .chk-btn")).toHaveCount(0);
  });

  test("aluno aprovado vê dieta sem depender de plano", async ({
    page,
  }) => {
    await login(page, USERS.studentB.email, USERS.studentB.password);
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("link", { name: "Treinos", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dietas", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comunidade", exact: true })).toHaveCount(0);
    await page.goto("/dietas");
    await page.waitForURL("**/dietas");
  });
});
