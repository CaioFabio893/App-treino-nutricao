import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

// Fluxo "Nova dieta" (pós-auditoria de a11y/UI): valida que o formulário abre,
// os campos têm labels acessíveis, a criação persiste no backend e nenhum
// elemento fixo (Install Prompt / AdminAreaSwitch) cobre o botão de salvar.
test.describe("Nova dieta (admin)", () => {
  test("cria dieta com labels acessíveis e sem sobreposição no botão salvar", async ({
    page,
  }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.waitForURL("**/admin");

    await page.goto("/admin/diets?new=1");

    // 1. Formulário abre com título correto.
    await expect(page.getByRole("heading", { name: "Nova dieta", exact: true })).toBeVisible();

    // 2. Labels associadas aos campos (a11y — htmlFor/id pareados).
    await expect(page.getByLabel("Nome da dieta", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Aluno", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Data de início", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Data de término", { exact: true })).toBeVisible();

    // 3. Preenche os campos (habilita o botão de salvar).
    await page.getByLabel("Nome da dieta", { exact: true }).fill("Dieta E2E Nova");
    await page.getByLabel("Aluno", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Data de início", { exact: true }).fill("2026-10-01");
    await page.getByLabel("Data de término", { exact: true }).fill("2026-12-31");
    await page.getByLabel("Plano alimentar (texto livre)").fill(
      "CAFÉ DA MANHÃ (07:00)\n• 2 ovos cozidos\n• 1 banana\n\nALMOÇO (12:30)\n• 150g de arroz\n• 200g de frango"
    );

    // 4. Nenhum elemento fixed cobre o botão "Salvar dieta" (centro clicável).
    const save = page.getByRole("button", { name: "Salvar dieta", exact: true });
    await expect(save).toBeEnabled();
    await save.scrollIntoViewIfNeeded();
    const box = await save.boundingBox();
    expect(box).not.toBeNull();
    const covered = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const btn = el?.closest("button");
        return btn ? btn.textContent?.includes("Salvar dieta") ?? false : false;
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
    );
    expect(covered).toBe(true);

    // 5. Submete.
    await save.click();

    // 6. onDone volta para a listagem e a dieta criada aparece.
    await page.waitForURL("**/admin/diets");
    await expect(page.getByText("Dieta E2E Nova", { exact: true })).toBeVisible();

    // 6. Guarda o card no Feed/Diets recarregado (verificação via backend já
    //    coberta pelo teste de autorização; aqui validamos o resultado na tela).
    await expect(
      page.getByText("Dieta E2E Nova", { exact: true }).locator("xpath=ancestor::*[contains(@class,'nut-card')][1]")
    ).toBeVisible();
  });
});