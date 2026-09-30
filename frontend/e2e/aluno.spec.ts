import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Área do aluno (gates do plano)", () => {
  test("aluno do plano completo vê treinos e dietas", async ({ page }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("link", { name: "Treinos", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dietas", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comunidade", exact: true })).toHaveCount(0);
  });

  test("aluno conclui o treino de hoje (registro e histórico no backend)", async ({
    page,
  }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await page.getByRole("link", { name: "Treinos", exact: true }).click();
    await page.waitForURL("**/treinos");

    // Treino de hoje aparece como opção e já vem selecionado (dayOfWeek = hoje).
    const chip = page
      .locator(".wod-chip")
      .filter({ hasText: "Treino de Hoje E2E" });
    await expect(chip).toBeVisible();
    await chip.click();

    const finish = page.getByRole("button", { name: "FINALIZAR TREINO" });
    await expect(finish).toBeVisible();
    const before = await page.locator(".tl-item").count();

    // Expande o primeiro exercício (a lista de séries fica recolhida por padrão)
    // e marca a primeira série.
    await page.locator(".ex-hd").first().click();
    const firstSet = page.locator(".s-row .chk-btn").first();
    await expect(firstSet).toBeVisible();
    await firstSet.click();
    await expect(firstSet).toHaveClass(/ok/);
    await finish.click();

    await expect(page.locator("#toast.show")).toContainText("Treino finalizado");
    // Histórico recarregado do backend ganha um item novo.
    await expect(page.locator(".tl-item")).toHaveCount(before + 1);
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
