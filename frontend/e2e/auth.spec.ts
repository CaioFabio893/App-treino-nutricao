import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Autenticação (fluxo real no Auth Emulator)", () => {
  test("visitante anônimo é redirecionado para /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.getByPlaceholder("voce@email.com")).toBeVisible();
  });

  test("senha incorreta mostra erro amigável", async ({ page }) => {
    await login(page, USERS.studentA.email, "senha-errada");
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("admin autentica e acessa o painel de gestão", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.waitForURL("**/nutritionist");
    await page.getByRole("link", { name: "Usuários" }).click();
    await page.waitForURL("**/admin");
    await expect(page.getByText("Cadastros pendentes", { exact: false })).toBeVisible();
  });

  test("aluno ativo entra direto no dashboard", async ({ page }) => {
    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Olá, Ana 👋" })).toBeVisible();
  });

  test("cadastro pendente fica em análise", async ({ page }) => {
    await login(page, USERS.pending.email, USERS.pending.password);
    await expect(page.getByText("Cadastro em análise")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aguardando aprovação…" })
    ).toBeDisabled();
  });

  test("cadastro recusado mostra o motivo", async ({ page }) => {
    await login(page, USERS.rejected.email, USERS.rejected.password);
    await expect(page.getByText("Cadastro recusado")).toBeVisible();
    await expect(page.getByText("Documento divergente", { exact: false })).toBeVisible();
  });
});