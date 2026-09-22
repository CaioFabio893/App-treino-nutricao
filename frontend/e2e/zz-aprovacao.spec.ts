import { test, expect } from "@playwright/test";
import {
  login,
  logout,
  signup,
  completeProfileSetup,
  PASS,
  USERS,
} from "./helpers";

test.describe("Fluxo de aprovação (novo cadastro → admin aprova → acesso real)", () => {
  test("cadastro nasce pendente, admin aprova e aluno acessa o dashboard", async ({
    page,
  }) => {
    const email = `e2e.novo.${Date.now()}@teste.local`;

    // 1. Cadastro real (frente real): conta nova nasce sem nome → ProfileSetup.
    await signup(page, email, PASS);
    await expect(page.getByText("Bem-vindo!")).toBeVisible();
    await completeProfileSetup(page, "Novo Aluno E2E");

    // 2. Entra na fila de espera do admin.
    await expect(page.getByText("Cadastro em análise")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aguardando aprovação…" })
    ).toBeDisabled();

    // 3. Admin aprova (default = plano Completo E2E, a primeira feature completa).
    await logout(page);
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.waitForURL("**/nutritionist");
    await page.getByRole("link", { name: "Usuários" }).click();
    await page.waitForURL("**/admin");

    const card = page.locator(".nut-card").filter({ hasText: email });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Aprovar", exact: true }).click();
    await expect(
      page.locator(".modal-box").getByText("Aprovar cadastro")
    ).toBeVisible();
    await page
      .locator(".modal-box")
      .getByRole("button", { name: "Aprovar", exact: true })
      .click();

    // O card sai da fila de pendentes (badge "aguardando aprovação" some).
    await expect(
      page
        .locator(".nut-card")
        .filter({ hasText: "aguardando aprovação" })
        .filter({ hasText: email })
    ).toHaveCount(0);

    await logout(page);

    // 4. O aluno agora entra direto no dashboard com as 4 áreas do plano.
    await login(page, email, PASS);
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Olá, Novo 👋" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Treinos", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dietas", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comunidade", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ranking", exact: true })).toBeVisible();
  });
});