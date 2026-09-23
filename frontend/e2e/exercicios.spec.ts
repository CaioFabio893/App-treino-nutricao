import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

// F5 — Biblioteca de exercícios (catálogo global) + snapshot em treinos.
// Fluxo ponta-a-ponta: nutricionista cria um exercício na biblioteca, seleciona
// num treino, e depois altera o exercício da biblioteca — o treino deve manter
// a CÓPIA original (snapshot), sem referência viva.
//
// O Playwright roda em Desktop Chrome (viewport >= 901px), onde a listagem é
// exibida como TABELA (`.table-view`), não como cards — as ações são localizadas
// pelas linhas da tabela.

test.describe("Biblioteca de exercícios (nutricionista)", () => {
  test("cria, busca, usa em treino e preserva snapshot após edição na biblioteca", async ({
    page,
  }) => {
    await login(page, USERS.nutritionist.email, USERS.nutritionist.password);
    await page.waitForURL("**/nutritionist");

    // 1. Abre a biblioteca e cria um exercício.
    await page.goto("/nutritionist/exercises");
    await expect(page.getByRole("heading", { name: "Exercícios" })).toBeVisible();
    await page.getByRole("button", { name: "+ Novo exercício" }).click();
    await page.getByPlaceholder("Ex.: Supino reto").fill("Supino Inclinado E2E");
    await page.getByPlaceholder("Ex.: Peito").fill("Peito");
    await page.getByRole("button", { name: "Salvar exercício" }).click();

    // 2. Volta para a listagem e confirma o exercício na busca.
    await expect(page.getByRole("heading", { name: "Exercícios" })).toBeVisible();
    const exTable = page.locator(".table-view");
    await expect(exTable.getByText("Supino Inclinado E2E")).toBeVisible();
    await page
      .getByPlaceholder("Buscar por nome, grupo muscular ou equipamento…")
      .fill("Inclinado");
    await expect(exTable.getByText("Supino Inclinado E2E")).toBeVisible();

    // 3. Cria um treino e seleciona o exercício da biblioteca.
    await page.goto("/nutritionist/workouts?new=1");
    await page
      .getByPlaceholder("Ex.: Treino A — Peito e Tríceps")
      .fill("Treino Biblioteca E2E");
    await page.getByRole("button", { name: "Buscar na biblioteca" }).click();
    await page.getByPlaceholder("Buscar por nome ou grupo muscular…").fill("Inclinado");
    await page.getByRole("button", { name: /Supino Inclinado E2E/ }).click();

    // O exercício é copiado para o treino (snapshot embutido).
    await expect(page.getByPlaceholder("Ex.: Supino reto")).toHaveValue("Supino Inclinado E2E");

    await page.getByRole("button", { name: "Salvar treino" }).click();
    await page.waitForURL("**/nutritionist/workouts");

    // 4. Altera o exercício NA BIBLIOTECA (renomeia).
    await page.goto("/nutritionist/exercises");
    await expect(page.getByRole("heading", { name: "Exercícios" })).toBeVisible();
    const exRow = page.locator(".table-view tr", { hasText: "Supino Inclinado E2E" });
    await exRow.getByRole("button", { name: "Editar" }).click();
    await page.getByPlaceholder("Ex.: Supino reto").fill("Supino Renomeado E2E");
    await page.getByRole("button", { name: "Salvar exercício" }).click();
    await expect(page.getByRole("heading", { name: "Exercícios" })).toBeVisible();

    // 5. O treino continua com o SNAPSHOT original (não acompanha a biblioteca).
    await page.goto("/nutritionist/workouts");
    const wkRow = page.locator(".table-view tr", { hasText: "Treino Biblioteca E2E" });
    await wkRow.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByPlaceholder("Ex.: Supino reto")).toHaveValue("Supino Inclinado E2E");
    await expect(page.getByPlaceholder("Ex.: Supino reto")).not.toHaveValue("Supino Renomeado E2E");
  });
});
