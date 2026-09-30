import { test, expect } from "@playwright/test";
import { login, signup, USERS, PASS } from "./helpers";

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
    await page.waitForURL("**/admin");
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

  // ── Deep-link de papel (achado pre-f13): acesso por URL direta não pode ser
  // rebatido por causa do role default "student" antes do perfil carregar. ──
  test("admin acessa /admin por URL direta (deep-link)", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.waitForURL("**/admin");
    // Full reload em /admin — re-hidrata a app com o perfil ainda carregando.
    await page.goto("/admin");
    await page.waitForURL("**/admin");
    await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
  });

  test("admin acessa /admin/workouts por URL direta (deep-link)", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.waitForURL("**/admin");
    await page.goto("/admin/workouts");
    await page.waitForURL("**/admin/workouts");
    await expect(page.getByRole("heading", { name: "Treinos" })).toBeVisible();
  });
});

test.describe("Fluxo de autenticação — Google removido, cadastro e recuperação", () => {
  test("tela de login não mostra Google; expõe criar conta, recuperar senha e mostrar/ocultar", async ({
    page,
  }) => {
    await page.goto("/login");

    // Google completamente ausente da UI.
    await expect(page.getByRole("button", { name: "Entrar com Google" })).toHaveCount(0);
    await expect(page.getByText("Google", { exact: false })).toHaveCount(0);

    // Opções claras de cadastro e recuperação.
    await expect(page.getByRole("link", { name: "Criar nova conta" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toBeVisible();

    // Senha pode ser mostrada/ocultada.
    const senha = page.getByLabel("Senha", { exact: true });
    await senha.fill("e2e-senha-123");
    await expect(senha).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(senha).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(senha).toHaveAttribute("type", "password");
  });

  test("cadastro: senhas diferentes bloqueiam o envio com erro claro", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("E-mail").fill(`e2e.bloqueio.${Date.now()}@teste.local`);
    await page.getByLabel("Senha", { exact: true }).fill("senha-certa-1");
    await page.getByLabel("Confirmar senha", { exact: true }).fill("senha-errada-2");
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();

    await expect(page.getByText("As senhas não coincidem.")).toBeVisible();
    // Permanece na tela de cadastro (nenhum fluxo de perfil dispara).
    await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  });

  test("cadastro: senhas iguais criam o pedido de conta (Auth Emulator)", async ({ page }) => {
    const email = `e2e.cadastro.${Date.now()}@teste.local`;
    await signup(page, email, PASS);
    // Conta nova sem perfil → fluxo de boas-vindas/ProfileSetup.
    await expect(page.getByText("Bem-vindo!")).toBeVisible();
  });

  test("recuperação: dentro do fluxo até o sucesso e de volta ao login", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await page.waitForURL("**/recuperar-senha");

    await page.getByLabel("E-mail").fill(USERS.studentA.email);
    await page.getByRole("button", { name: "Enviar", exact: true }).click();

    // Feedback de sucesso (mensagem genérica, sem enumeração) e retorno ao login.
    await expect(page.getByText(/Se o e-mail estiver cadastrado/)).toBeVisible();
    await page.getByRole("link", { name: "Voltar para o login" }).click();
    await page.waitForURL("**/login");
    await expect(page.getByPlaceholder("voce@email.com")).toBeVisible();
  });

  test("recuperação: e-mail inválido é bloqueado na validação", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail").fill("nao-e-email");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page.getByText("E-mail inválido.")).toBeVisible();
    // Continua na tela de recuperação (não navega).
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  });
});
