import { test, expect } from "@playwright/test";
import { API_BASE, AUTH_EMU_BASE, USERS, apiGet, idTokenFor, login } from "./helpers";

test.describe("F7 — isolamento e somente leitura com Auth/Firestore reais do emulador", () => {
  test("ativos e pausado leem próprios recursos; alheios 404; escrita 403", async ({ request }) => {
    const admin = await idTokenFor(USERS.admin.email, USERS.admin.password);
    const profiles = [];
    for (const user of [USERS.studentA, USERS.studentB, USERS.studentC]) {
      const token = await idTokenFor(user.email, user.password);
      const me = await apiGet(request, "/api/me", token);
      expect(me.status()).toBe(200);
      profiles.push({ token, ...(await me.json()) });
    }
    expect(profiles[2].status).toBe("paused");
    const resources = [];
    for (const [i, p] of profiles.entries()) {
      const create = async (path: string, data: object) => {
        const res = await request.post(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${admin}` }, data });
        expect(res.status(), await res.text()).toBe(200);
        return res.json();
      };
      const workout = await create("/api/workouts", { name: `F7 Treino ${i}`, studentId: p.id, exercises: [{name:"F7 Exercício",sets:3,repetitions:"10",order:1}] });
      const diet = await create("/api/diets", { name: `F7 Dieta ${i}`, studentId: p.id, content: `Dieta exclusiva F7 ${i}` });
      const program = await create("/api/programs", { name: `F7 Programa ${i}`, studentId: p.id, workouts: [{workoutId:workout.id,order:1,label:"A"}] });
      resources.push({ workouts:workout.id, diets:diet.id, programs:program.id, students:p.id });
    }
    for (const [i, p] of profiles.entries()) {
      const other = resources[(i + 1) % resources.length];
      for (const collection of ["workouts", "diets", "programs", "students"] as const) {
        const own = await apiGet(request, `/api/${collection}/${resources[i][collection]}`, p.token);
        expect(own.status()).toBe(200);
        const foreign = await apiGet(request, `/api/${collection}/${other[collection]}`, p.token);
        const missing = await apiGet(request, `/api/${collection}/f7-missing-resource`, p.token);
        expect(foreign.status()).toBe(404);
        expect(missing.status()).toBe(404);
        expect(await foreign.text()).toBe(await missing.text());
      }
      for (const collection of ["workouts", "diets", "programs"] as const) {
        const list = await apiGet(request, `/api/${collection}`, p.token);
        expect(list.status()).toBe(200);
        const rows = await list.json();
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row: {studentId:string}) => row.studentId === p.id)).toBe(true);
        for (const [method, path] of [["POST",`/api/${collection}`],["PUT",`/api/${collection}/${resources[i][collection]}`],["DELETE",`/api/${collection}/${resources[i][collection]}`]]) {
          const res = await request.fetch(`${API_BASE}${path}`, { method, headers: {Authorization:`Bearer ${p.token}`},data:{} });
          expect(res.status()).toBe(403);
        }
      }
      expect((await apiGet(request,"/api/workout-history",p.token)).status()).toBe(404);
      expect((await apiGet(request,"/api/diet-logs",p.token)).status()).toBe(404);
      expect((await request.post(`${API_BASE}/api/workouts/complete`,{headers:{Authorization:`Bearer ${p.token}`},data:{}})).status()).toBe(404);
    }
    for (const user of [USERS.pending, USERS.rejected]) {
      const token = await idTokenFor(user.email,user.password);
      const me = await (await apiGet(request,"/api/me",token)).json();
      for (const path of ["/api/workouts","/api/diets","/api/programs",`/api/students/${me.id}`]) expect((await apiGet(request,path,token)).status()).toBe(403);
    }
  });

  test("pausado consulta treino e dieta na UI sem controles de registro", async ({ page, request }) => {
    const admin = await idTokenFor(USERS.admin.email, USERS.admin.password);
    const token = await idTokenFor(USERS.studentC.email, USERS.studentC.password);
    const me = await (await apiGet(request, '/api/me', token)).json();
    const created = await request.post(API_BASE + '/api/diets', { headers: { Authorization: 'Bearer ' + admin }, data: { name: 'F7 UI Dieta', studentId: me.id, content: 'Dieta exclusiva UI pausado' } });
    expect(created.status()).toBe(200);
    await login(page, USERS.studentC.email, USERS.studentC.password);
    await page.waitForURL("**/dashboard");
    await page.getByRole("link",{name:"Treino",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Treino"})).toBeVisible();
    await expect(page.getByRole("link", {name:"Abrir treino",exact:true}).first()).toBeVisible();
    await expect(page.locator("input, textarea, .chk-btn")).toHaveCount(0);
    await expect(page.getByRole("button",{name:/finalizar|registrar|marcar/i})).toHaveCount(0);
    await page.getByRole("link",{name:"Dieta",exact:true}).click();
    await expect(page.getByText("Dieta exclusiva UI pausado")).toBeVisible();
    await expect(page.locator("input, textarea, .chk-btn")).toHaveCount(0);
  });
  test("conta inativa fica na tela de acesso suspenso", async ({ page, request }) => {
    const email = `f7.inactive.${Date.now()}@teste.local`;
    const password = "f7-emulator-password";
    const signup = await request.post(`${AUTH_EMU_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=e2e-fake-api-key`, { data: { email, password, returnSecureToken: true } });
    expect(signup.status()).toBe(200);
    const account = await signup.json();
    expect((await apiGet(request, "/api/me", account.idToken)).status()).toBe(200);
    const admin = await idTokenFor(USERS.admin.email, USERS.admin.password);
    const update = await request.put(`${API_BASE}/api/users/${account.localId}`, { headers: {Authorization:`Bearer ${admin}`},data:{name:"F7 Inativo",email,role:"student",status:"inactive"} });
    expect(update.status()).toBe(200);
    await login(page, email, password);
    await expect(page.locator(".logo-text").filter({ hasText: "Acesso suspenso" })).toBeVisible();
    await expect(page.getByRole("button",{name:"Sem acesso",exact:true})).toBeDisabled();
    await page.goto("/treinos");
    await expect(page.locator(".logo-text").filter({ hasText: "Acesso suspenso" })).toBeVisible();
    await expect(page.getByRole("heading",{name:"Seus treinos"})).toHaveCount(0);
  });
});
