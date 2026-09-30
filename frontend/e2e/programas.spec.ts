import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

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

// Mesmo formato do material de referência (treino.md), em versão reduzida
// para o teste: 2 treinos. O volume real (5/30) é validado no parser Go.
const MARKDOWN = `# Programa de Treino — Louise Lima (Ciclo 2)

**Foco: Hipertrofia de Inferiores — sem WOD**

---

## TREINO A — Pernas (Quadríceps)

| # | Exercício | Séries | Reps | Observação |
|---|---|---:|---:|---|
| 1 | Agachamento Livre com Barra | 4 | 6-8 | Foco em força/carga |
| 2 | Hack Squat | 4 | 10 | Amplitude total |

---

## TREINO B — Costas/Bíceps

| # | Exercício | Séries | Reps | Observação |
|---|---|---:|---:|---|
| 1 | Puxada Alta Pronada | 4 | 8-10 | |

**🔥 Cardio Final (circuito — 3 opções):**

- Subida de escada — 2 min

---

## Periodização

Sem 1-2: 70% · Sem 7: Deload 70%
`;

test.describe("Programa de treino (admin)", () => {
  test("importa markdown, duplica, atribui a aluno e o aluno visualiza em leitura", async ({
    page,
  }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.waitForURL("**/admin");

    // ── 1. Importação a partir do markdown ─────────────────────────────────
    await page.goto("/admin/programs");
    await expect(page.getByRole("heading", { name: "Programas" })).toBeVisible();
    await page.getByRole("button", { name: "Importar de .md" }).click();

    await expect(page.getByRole("heading", { name: "Importar programa" })).toBeVisible();
    await page.locator("textarea").first().fill(MARKDOWN);
    await page.getByRole("button", { name: "Importar programa" }).click();

    // Vai para o detalhe do programa recém-criado.
    await expect(page.getByRole("heading", { name: /Louise Lima \(Ciclo 2\)/ })).toBeVisible({
      timeout: 20_000,
    });

    // ── 2. Os treinos e exercícios foram criados pelo parse, não digitados ──
    // 2 treinos · 3 exercícios · 12 séries (4+4 no treino A, 4 no treino B)
    await expect(page.locator(".page-sub").first()).toContainText(
      "2 treino(s) · 3 exercícios · 12 séries"
    );
    await expect(page.getByText("Agachamento Livre com Barra")).toBeVisible();
    await expect(page.getByText("Hack Squat")).toBeVisible();
    await expect(page.getByText("Puxada Alta Pronada")).toBeVisible();
    // Séries/reps da tabela foram convertidas.
    await expect(page.getByText("6-8")).toBeVisible();
    // O cardio foi para a DESCRIÇÃO do treino, não virou exercício fictício.
    await expect(page.getByText(/Cardio Final/)).toBeVisible();
    // A periodização foi preservada nas notas.
    await expect(page.getByText(/Sem 1-2: 70%/)).toBeVisible();
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

    // ── 4. Atribuir materializa cópias dos treinos para o aluno ────────────
    // "Ana Aluna" = USERS.studentA do seed (backend/cmd/e2eseed).
    await rowOriginal.getByRole("button", { name: "Atribuir" }).click();
    await page.locator(".modal-box").getByText("Ana Aluna").click();

    await expect(rowOriginal).toContainText("atribuído", { timeout: 20_000 });
    await expect(rowOriginal.getByRole("button", { name: "Atribuir" })).toHaveCount(0);

    // ── 5. O aluno enxerga o programa, somente leitura ────────────────────
    await page.getByRole("button", { name: "Sair", exact: true }).first().click();
    await page.waitForURL("**/login");

    await login(page, USERS.studentA.email, USERS.studentA.password);
    await page.waitForURL("**/dashboard");

    await page.goto("/programas");
    await expect(page.getByRole("heading", { name: "Seu programa" })).toBeVisible();
    await expect(page.getByText("Louise Lima (Ciclo 2)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver o programa" }).first()).toBeVisible();

    await page.getByRole("link", { name: "Ver o programa" }).first().click();
    await expect(page.getByRole("heading", { name: /Louise Lima \(Ciclo 2\)/ })).toBeVisible();
    // Exercícios visíveis...
    await expect(page.getByText("Agachamento Livre com Barra")).toBeVisible();
    // ... mas sem ações de escrita.
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Imprimir" })).toHaveCount(0);

    // A rota do detalhe do admin continua acessível pelo backend.
    expect(detailUrl).toContain("/admin/programs?id=");
  });
});
