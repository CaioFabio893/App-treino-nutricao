import { test, expect } from "@playwright/test";
import { API_BASE, USERS, apiGet, idTokenFor, login } from "./helpers";

test("receita formatada salva, duplica e aparece só em Receitas do aluno associado", async ({ page, request }) => {
  const admin = await idTokenFor(USERS.admin.email, USERS.admin.password);
  const student = await idTokenFor(USERS.studentA.email, USERS.studentA.password);
  const other = await idTokenFor(USERS.studentB.email, USERS.studentB.password);
  const name = `Receita E2E ${Date.now()}`;
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.waitForURL("**/admin");
  await page.goto("/admin/recipes?new=1");
  await page.getByLabel("Nome da receita").fill(name);
  // Receita é global: o formulário não pede aluno.
  await page.getByLabel(/Receita \(texto livre\)/).fill("## Preparo\n- **Aveia** 🥣\nMisture e sirva.");
  await page.getByRole("button", {name:"Visualizar",exact:true}).click();
  await expect(page.locator(".formatted-text strong")).toHaveText("Aveia");
  await page.getByRole("button", {name:"Salvar receita",exact:true}).click();
  await page.waitForURL("**/admin/recipes");
  await expect(page.getByText(name,{exact:true})).toBeVisible();
  const list = await (await apiGet(request, "/api/diets", admin)).json();
  const recipe = list.find((d: {name:string}) => d.name === name);
  expect(recipe.kind).toBe("recipe");
  // Receita é GLOBAL: qualquer aluno aprovado lê (mas não escreve).
  expect((await apiGet(request, `/api/diets/${recipe.id}`, other)).status()).toBe(200);
  expect((await request.put(`${API_BASE}/api/diets/${recipe.id}`, {headers:{Authorization:`Bearer ${student}`},data:recipe})).status()).toBe(403);
  const duplicate = await request.post(`${API_BASE}/api/diets/${recipe.id}/duplicate`, {headers:{Authorization:`Bearer ${admin}`},data:{newName:name+" copia"}});
  expect(duplicate.status()).toBe(200);
  expect((await duplicate.json()).kind).toBe("recipe");
  await page.getByRole("button", {name:"Sair",exact:true}).first().click();
  await page.waitForURL("**/login");
  await login(page, USERS.studentA.email, USERS.studentA.password);
  await page.waitForURL("**/dashboard");
  await page.goto("/receitas");
  await expect(page.getByRole("heading", {name:"Suas receitas"})).toBeVisible();
  // A receita aparece como botão (nome) e abre por clique.
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".formatted-text strong").first()).toHaveText("Aveia");
  await page.goto("/dietas");
  await expect(page.getByRole("heading", {name:"Sua dieta"})).toBeVisible();
  await expect(page.getByText(name,{exact:true})).toHaveCount(0);
});
