import { type Page, type APIRequestContext, expect } from "@playwright/test";

/** Senha única usada no seed do emulador (npm-run e2e:seed). */
export const PASS = "e2e-senha-123";

/** Usuários semeados por backend/cmd/e2eseed (rolam junto com os emuladores). */
export const USERS = {
  admin: { email: "e2e.admin@teste.local", password: PASS },
  nutritionist: { email: "e2e.nutri@teste.local", password: PASS },
  studentA: { email: "e2e.aluno@teste.local", password: PASS }, // plano Completo (workouts+diet+community+ranking)
  studentB: { email: "e2e.aluno2@teste.local", password: PASS }, // plano Essencial (workouts+ranking)
  studentC: { email: "e2e.aluno3@teste.local", password: PASS }, // plano só Treinos (workouts)
  pending: { email: "e2e.pendente@teste.local", password: PASS },
  rejected: { email: "e2e.recusado@teste.local", password: PASS },
} as const;

export const API_BASE = "http://127.0.0.1:8081";
export const AUTH_EMU_BASE = "http://127.0.0.1:9099";

/** Entra com e-mail/senha na tela inicial e espera a navegação pós-login. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("voce@email.com").fill(email);
  await page.getByPlaceholder("••••••").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

/** Cria conta nova (mode signup) — o cadastro nasce como pending_approval. */
export async function signup(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Cadastre-se", exact: true }).click();
  // A troca para o modo de cadastro é estado local do componente; aguarda o
  // formulário de cadastro (heading "Criar conta") para garantir que o clique
  // registrou antes de preencher/submeter (evita corrida de hidratação).
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  await page.getByPlaceholder("voce@email.com").fill(email);
  await page.getByPlaceholder("••••••").fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
}

/** Se o app pedir o nome (ProfileSetup), preenche e segue. */
export async function completeProfileSetup(page: Page, name: string) {
  const input = page.getByPlaceholder("Seu nome");
  await expect(input).toBeVisible();
  await input.fill(name);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

/** Sai da conta (qualquer variante de "Sair": login, topbar, pendência). */
export async function logout(page: Page) {
  const sair = page.getByRole("button", { name: "Sair", exact: true });
  await expect(sair.first()).toBeVisible();
  await sair.first().click();
  await page.waitForURL("**/login");
  await expect(page.getByPlaceholder("voce@email.com")).toBeVisible();
}

/** Emite idToken no Auth Emulator via REST (sem depender do SDK web). */
export async function idTokenFor(email: string, password: string): Promise<string> {
  const res = await fetch(
    `${AUTH_EMU_BASE}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=e2e-fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error(`signInWithPassword falhou (${res.status})`);
  const body = (await res.json()) as { idToken?: string };
  if (!body.idToken) throw new Error("Auth Emulator não devolveu idToken");
  return body.idToken;
}

/** GET autenticado contra a API Go (teste de autorização no nível HTTP). */
export async function apiGet(request: APIRequestContext, path: string, token: string) {
  return request.get(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}