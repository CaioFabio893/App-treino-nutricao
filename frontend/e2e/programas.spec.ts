import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";
import { LOUISE_PROGRAM_EXAMPLE } from "../lib/program-example";

// F19 — Programa de Treino (coleção que agrupa TREINOS por referência).
//
// O teste cobre o caminho completo que elimina a digitação manual:
//   1. admin importa um programa em MARKDOWN (sem digitar exercício);
//   2. confere que os 5 treinos e os 30 exercícios foram criados;
//   3. duplica o programa para ajustar sem mexer no original;
//   4. atribui a um aluno (materializa cópias dos treinos);
//   5. o aluno vê o programa atribuído, em modo leitura.
//
// Playwright roda em Desktop Chrome (viewport >= 901px), então a listagem do
// admin aparece como TABELA (.table-view) e as ações são localizadas
// pelas linhas. O detalhe fica em ?id=<id> (rota /admin/programs).

// Material integral fornecido pelo dono: cinco treinos A–E e 30 exercícios.
const MARKDOWN = LOUISE_PROGRAM_EXAMPLE;

test.describe("Programa de treino (admin)", () => {
  test("importa markdown, duplica, atribui a aluno e o aluno visualiza em leitura", async ({
    page,
  }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.waitForURL("**/admin");

    // ── 1. Importação a partir do markdown ─────────────────────────────────
    await page.goto("/admin/programs");
    await expect(page.getByRole("heading", { name: "Programas" })).toBeVisible();
    await page.getByRole("button", { name: "+ Novo programa completo" }).click();

    await expect(page.getByRole("heading", { name: "Cadastrar programa completo" })).toBeVisible();
    await page.locator("textarea").first().fill(MARKDOWN);
    await page.getByRole("button", { name: "Cadastrar programa completo" }).click();

    // Vai para o detalhe do programa recém-criado.
    await expect(page.getByRole("heading", { name: /Louise Lima \(Ciclo 2\)/ })).toBeVisible({
      timeout: 20_000,
    });

    // ── 2. Os treinos e exercícios foram criados pelo parse, não digitados ──
    // Os cinco treinos e as 103 séries do exemplo integral.
    await expect(page.locator(".page-sub").first()).toContainText(
      "5 treino(s) · 30 exercícios · 103 séries"
    );
    await expect(page.getByText("Agachamento Livre com Barra").first()).toBeVisible();
    await expect(page.getByText("Hack Squat").first()).toBeVisible();
    await expect(page.getByText("Puxada Alta Pronada")).toBeVisible();
    // Séries/reps da tabela foram convertidas.
    await expect(page.getByText("6-8").first()).toBeVisible();
    // O cardio foi para a DESCRIÇÃO do treino, não virou exercício fictício.
    await expect(page.getByText(/Cardio Final/).first()).toBeVisible();
    // A periodização foi preservada nas notas.
    await expect(page.getByText(/Sem 1–2: 70%/)).toBeVisible();
    // Origem registrada.
    await expect(page.getByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      /\/admin\/programs\?edit=/
    );

    const detailUrl = page.url();

    // ── 3. Duplicar preserva o original ────────────────────────────────────
    await page.goto("/admin/programs");
    const table = page.locator(".table-view");
    // O nome da cópia CONTÉM o do original, então o filtro precisa excluir
    // "(copia)" para não casar com as duas linhas.
    const rowOriginal = table
      .locator("tr")
      .filter({ hasText: "Louise Lima (Ciclo 2)" })
      .filter({ hasNotText: "(copia)" });
    await expect(rowOriginal).toBeVisible();
    await rowOriginal.getByRole("button", { name: "Duplicar" }).click();

    const rowCopia = table.locator("tr").filter({ hasText: "Louise Lima (Ciclo 2) (copia)" });
    await expect(rowCopia).toBeVisible({ timeout: 20_000 });
    // A cópia nasce na biblioteca (sem aluno) — a coluna "Aluno" mostra isso.
    await expect(rowCopia).toContainText("Biblioteca (sem aluno)");

    // ── 4. Associar em lote: preserva a FONTE e cria uma cópia por aluno ───
    // "Ana Aluna" = USERS.studentA do seed (backend/cmd/e2eseed).
    await rowOriginal.getByRole("button", { name: "Associar a vários alunos" }).click();
    const modal = page.locator(".modal-box");
    await modal.getByRole("checkbox", { name: /Ana Aluna/ }).check();
    await modal.getByRole("button", { name: /Associar a 1 aluno/ }).click();

    // A cópia independente vai para a aluna; o modelo original segue na biblioteca.
    const rowsOriginal = table
      .locator("tr")
      .filter({ hasText: "Louise Lima (Ciclo 2)" })
      .filter({ hasNotText: "(copia)" });
    await expect(rowsOriginal.filter({ hasText: "Ana Aluna" })).toBeVisible({ timeout: 20_000 });
    await expect(rowsOriginal.filter({ hasText: "Biblioteca (sem aluno)" })).toBeVisible();

    // ── 5. O aluno enxerga o programa, somente leitura ────────────────────
    await page.getByRole("button", { name: "Sair", exact: true }).first().click();
    await page.waitForURL("**/login");

    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");

    await page.goto("/programas");
    await page.waitForURL("**/treinos");
    await expect(page.getByRole("heading", { name: "Treino" })).toBeVisible();
    await expect(page.getByText("Louise Lima (Ciclo 2)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir treino" }).first()).toBeVisible();

    await page.getByRole("link", { name: "Abrir treino" }).first().click();
    await expect(page.getByRole("heading", { name: /Louise Lima \(Ciclo 2\)/ })).toBeVisible();
    // Exercícios visíveis...
    await expect(page.getByText("Agachamento Livre com Barra").first()).toBeVisible();
    // ... mas sem ações de escrita.
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Imprimir" })).toHaveCount(0);
    await page.getByLabel("Agachamento Livre com Barra série 1 carga", { exact: true }).fill("40");
    await page.getByLabel("Agachamento Livre com Barra série 1 repetições", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Agachamento Livre com Barra série 1: não marcada", exact: true }).click();
    await expect(page.getByText("1 / 19 séries concluídas com sucesso")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Agachamento Livre com Barra série 1 carga", { exact: true })).toHaveValue("40");
    await expect(page.getByRole("button", { name: "Agachamento Livre com Barra série 1: conseguiu", exact: true })).toBeVisible();

    // A rota do detalhe do admin continua acessível pelo backend.
    expect(detailUrl).toContain("/admin/programs?id=");
  });
});
