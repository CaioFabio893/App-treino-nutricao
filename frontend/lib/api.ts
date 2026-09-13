"use client";

// Cliente HTTP para a API Go que roda no Cloud Run.
// No modo demo (NEXT_PUBLIC_DEMO=1) simula tudo em localStorage, sem rede.
import type { AppState, PRs, SessionData } from "./types";
import { DEMO_MODE } from "./config";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

export const apiConfigured = Boolean(API_URL) || DEMO_MODE;

// ── Modo demo ──────────────────────────────────────────────────────────────

const LS_KEY = {
  session: (w: number, d: string) => `ll_demo_session_${w}_${d}`,
  prs: "ll_demo_prs",
  state: "ll_demo_state",
  seeded: "ll_demo_seeded",
};

function getJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function setJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem espaço / privado */
  }
}

// Dados de exemplo para a primeira visita (só no navegador).
function seedDemo() {
  if (typeof window === "undefined" || localStorage.getItem(LS_KEY.seeded)) return;

  setJSON(
    LS_KEY.session(1, "ta"),
    {
      week: 1,
      day: "ta",
      exercise: [
        {
          sets: [
            { w: 55, r: 8, c: "ok" },
            { w: 60, r: 7, c: "ok" },
            { w: 60, r: 6, c: "ok" },
            { w: 55, r: 8, c: "ok" },
          ],
          note: "Bom rendimento!",
        },
        { sets: [{ w: 40, r: 10, c: "ok" }, { w: 45, r: 10, c: "ok" }], note: "" },
        { sets: [{ w: 90, r: 12, c: "ok" }], note: "" },
        { sets: [{ w: 25, r: 12, c: "ok" }], note: "" },
        { sets: [], note: "" },
      ],
    }
  );
  setJSON(
    LS_KEY.session(1, "tb"),
    {
      week: 1,
      day: "tb",
      exercise: [
        { sets: [{ w: 35, r: 8, c: "ok" }, { w: 35, r: 8, c: "ok" }, { w: 30, r: 9 }], note: "" },
        { sets: [], note: "" },
        { sets: [], note: "" },
        { sets: [], note: "" },
        { sets: [], note: "" },
      ],
    }
  );
  setJSON(LS_KEY.prs, { a: 60, b: 80, c: 120 });
  setJSON(LS_KEY.state, { week: 1, day: 0 });
  localStorage.setItem(LS_KEY.seeded, "1");
}

if (DEMO_MODE) seedDemo();

// ── Requisições reais ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  if (!API_URL) throw new Error("API não configurada (NEXT_PUBLIC_API_URL)");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API respondeu ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── API pública ────────────────────────────────────────────────────────────

export function getSession(week: number, day: string, token: string) {
  if (DEMO_MODE) {
    return Promise.resolve(
      getJSON<SessionData>(LS_KEY.session(week, day)) ??
        ({ week, day, exercise: null } as unknown as SessionData)
    );
  }
  return request<SessionData>(`/api/sessions/${week}/${day}`, token);
}

export function putSession(
  week: number,
  day: string,
  sess: SessionData,
  token: string
) {
  if (DEMO_MODE) {
    setJSON(LS_KEY.session(week, day), { ...sess, week, day });
    return Promise.resolve();
  }
  return request<void>(`/api/sessions/${week}/${day}`, token, {
    method: "PUT",
    body: JSON.stringify({ ...sess, week, day }),
  });
}

export function getPRs(token: string) {
  if (DEMO_MODE) {
    return Promise.resolve(getJSON<PRs>(LS_KEY.prs) ?? { a: 0, b: 0, c: 0 });
  }
  return request<PRs>("/api/prs", token);
}

export function putPRs(prs: PRs, token: string) {
  if (DEMO_MODE) {
    setJSON(LS_KEY.prs, prs);
    return Promise.resolve();
  }
  return request<void>("/api/prs", token, {
    method: "PUT",
    body: JSON.stringify(prs),
  });
}

export function getState(token: string) {
  if (DEMO_MODE) {
    return Promise.resolve(
      getJSON<AppState>(LS_KEY.state) ?? { week: 1, day: 0 }
    );
  }
  return request<AppState>("/api/state", token);
}

export function putState(st: AppState, token: string) {
  if (DEMO_MODE) {
    setJSON(LS_KEY.state, st);
    return Promise.resolve();
  }
  return request<void>("/api/state", token, {
    method: "PUT",
    body: JSON.stringify(st),
  });
}