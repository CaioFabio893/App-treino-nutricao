import { test, expect } from "@playwright/test";
import { login, USERS, idTokenFor, API_BASE, apiGet } from "./helpers";

test("associa um plano a dois alunos e preserva o modelo sem seletor flutuante", async ({ page, request }) => {
  const token = await idTokenFor(USERS.admin.email, USERS.admin.password);
  const name = `Plano lote E2E ${Date.now()}`;
  const created = await request.post(`${API_BASE}/api/diets`, { headers: {Authorization: `Bearer ${token}`}, data: { name, content: "Plano em lote de teste", studentId: "", meals: [] } });
  expect(created.ok()).toBeTruthy();
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.waitForURL("**/admin");
  await expect(page.locator(".admin-areas")).toHaveCount(0);
  await page.goto("/admin/diets");
  const card = page.locator(".nut-card").filter({hasText: name});
  await card.getByRole("button", {name: "Associar a vários alunos"}).click();
  const dialog = page.getByRole("dialog", {name: "Associar plano alimentar"});
  await dialog.getByRole("checkbox", {name: new RegExp(USERS.studentA.email)}).check();
  await dialog.getByRole("checkbox", {name: new RegExp(USERS.studentB.email)}).check();
  await dialog.getByRole("button", {name: /Associar a 2 aluno/}).click();
  await expect(dialog).not.toBeVisible();
  const response = await apiGet(request, "/api/diets", token);
  const diets = (await response.json()).filter((d: {name: string}) => d.name === name);
  expect(diets).toHaveLength(3);
  expect(diets.filter((d: {studentId?: string}) => !d.studentId)).toHaveLength(1);
  expect(new Set(diets.map((d: {studentId?: string}) => d.studentId || "" )).size).toBe(3);
});
