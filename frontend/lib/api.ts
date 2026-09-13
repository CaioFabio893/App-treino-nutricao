"use client";

// Cliente HTTP para a API Go que roda no Cloud Run.
// No modo demo (NEXT_PUBLIC_DEMO=1) simula tudo em localStorage, sem rede.
import type {
  AppState,
  CompleteWorkoutRequest,
  Diet,
  DuplicateRequest,
  PRs,
  SessionData,
  UserProfile,
  WorkoutDefine,
  WorkoutHistoryEntry,
} from "./types";
import { DEMO_MODE } from "./config";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

export const apiConfigured = Boolean(API_URL) || DEMO_MODE;

// ── Modo demo ──────────────────────────────────────────────────────────────

const LS_KEY = {
  session: (w: number, d: string) => `ll_demo_session_${w}_${d}`,
  prs: "ll_demo_prs",
  state: "ll_demo_state",
  seeded: "ll_demo_seeded_v3",
  students: "ll_demo_students",
  workouts: "ll_demo_workouts",
  diets: "ll_demo_diets",
  history: "ll_demo_history",
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
  setJSON(LS_KEY.prs, { a: 60, b: 80, c: 120 });
  setJSON(LS_KEY.state, { week: 1, day: 0 });

  // Dados de exemplo da área do nutricionista.
  const students: UserProfile[] = [
    {
      id: "student-joao",
      name: "João Silva",
      email: "joao@email.com",
      role: "student",
      nutritionistID: "demo-user",
      startDate: "2026-01-15",
      endDate: "2026-04-15",
      status: "active",
    },
    {
      id: "student-maria",
      name: "Maria Souza",
      email: "maria@email.com",
      role: "student",
      nutritionistID: "demo-user",
      startDate: "2026-02-01",
      endDate: "2026-05-01",
      status: "paused",
    },
  ];
  const workouts: WorkoutDefine[] = [
    {
      id: "workout-a",
      studentId: "student-joao",
      nutritionistId: "demo-user",
      name: "Treino A — Peito e Tríceps",
      objective: "Hipertrofia",
      description: "Foco em peito e tríceps",
      dayOfWeek: "monday",
      exercises: [
        { id: "ex1", name: "Supino reto", sets: 4, repetitions: "10", weight: "60 kg", restSeconds: 90, notes: "Controlar a descida.", order: 1 },
        { id: "ex2", name: "Supino inclinado", sets: 3, repetitions: "12", weight: "50 kg", restSeconds: 60, notes: "Executar lentamente.", order: 2 },
        { id: "ex3", name: "Crucifixo", sets: 3, repetitions: "12", weight: "20 kg", restSeconds: 60, notes: "", order: 3 },
        { id: "ex4", name: "Tríceps corda", sets: 3, repetitions: "15", weight: "25 kg", restSeconds: 45, notes: "", order: 4 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "workout-b",
      studentId: "student-joao",
      nutritionistId: "demo-user",
      name: "Treino B — Costas e Bíceps",
      objective: "Hipertrofia",
      description: "Foco em costas e bíceps",
      dayOfWeek: "tuesday",
      exercises: [
        { id: "ex5", name: "Puxada alta", sets: 4, repetitions: "10", weight: "50 kg", restSeconds: 90, notes: "", order: 1 },
        { id: "ex6", name: "Remada curvada", sets: 4, repetitions: "10", weight: "40 kg", restSeconds: 90, notes: "", order: 2 },
        { id: "ex7", name: "Rosca direta", sets: 3, repetitions: "12", weight: "25 kg", restSeconds: 60, notes: "", order: 3 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "workout-c",
      studentId: "student-joao",
      nutritionistId: "demo-user",
      name: "Treino C — Pernas",
      objective: "Hipertrofia",
      description: "Foco em quadríceps e posterior",
      dayOfWeek: "wednesday",
      exercises: [
        { id: "ex8", name: "Agachamento livre", sets: 4, repetitions: "10", weight: "80 kg", restSeconds: 120, notes: "Descer controlado.", order: 1 },
        { id: "ex9", name: "Leg press 45°", sets: 4, repetitions: "12", weight: "180 kg", restSeconds: 90, notes: "", order: 2 },
        { id: "ex10", name: "Cadeira extensora", sets: 3, repetitions: "15", weight: "45 kg", restSeconds: 60, notes: "", order: 3 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "workout-d",
      studentId: "student-joao",
      nutritionistId: "demo-user",
      name: "Treino D — Ombros e Abdômen",
      objective: "Condicionamento",
      description: "Foco em deltoides e core",
      dayOfWeek: "thursday",
      exercises: [
        { id: "ex11", name: "Desenvolvimento militar", sets: 4, repetitions: "10", weight: "40 kg", restSeconds: 90, notes: "", order: 1 },
        { id: "ex12", name: "Elevação lateral", sets: 3, repetitions: "15", weight: "12 kg", restSeconds: 45, notes: "", order: 2 },
        { id: "ex13", name: "Prancha", sets: 3, repetitions: "60 s", weight: "", restSeconds: 45, notes: "Contrair abdômen.", order: 3 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "workout-e",
      studentId: "student-joao",
      nutritionistId: "demo-user",
      name: "Treino E — Cardio/Funcional",
      objective: "Condicionamento",
      description: "Circuito aeróbico",
      dayOfWeek: "friday",
      exercises: [
        { id: "ex14", name: "Esteira", sets: 1, repetitions: "20 min", weight: "", restSeconds: 0, notes: "Ritmo moderado.", order: 1 },
        { id: "ex15", name: "Burpees", sets: 3, repetitions: "15", weight: "", restSeconds: 45, notes: "", order: 2 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "workout-f",
      studentId: "student-joao",
      nutritionistId: "demo-user",
      name: "Treino F — Full body",
      objective: "Hipertrofia",
      description: "Corpo inteiro",
      dayOfWeek: "saturday",
      exercises: [
        { id: "ex16", name: "Levantamento terra", sets: 4, repetitions: "8", weight: "100 kg", restSeconds: 120, notes: "Costas retas.", order: 1 },
        { id: "ex17", name: "Supino reto", sets: 4, repetitions: "10", weight: "60 kg", restSeconds: 90, notes: "", order: 2 },
        { id: "ex18", name: "Remada baixa", sets: 3, repetitions: "12", weight: "50 kg", restSeconds: 60, notes: "", order: 3 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "workout-g",
      studentId: "student-joao",
      nutritionistId: "demo-user",
      name: "Treino G — Recuperação Ativa",
      objective: "Recuperação",
      description: "Alongamento e mobilidade",
      dayOfWeek: "sunday",
      exercises: [
        { id: "ex19", name: "Alongamento geral", sets: 3, repetitions: "10 min", weight: "", restSeconds: 30, notes: "Respirar fundo.", order: 1 },
        { id: "ex20", name: "Mobilidade de ombro", sets: 2, repetitions: "5 min", weight: "", restSeconds: 30, notes: "", order: 2 },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
  const diets: Diet[] = [
    {
      id: "diet-outubro",
      studentId: "student-joao",
      nutritionistId: "demo-user",
      name: "Plano alimentar — Hipertrofia",
      description: "Plano para ganho de massa muscular",
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      meals: [
        {
          id: "m1",
          name: "Café da manhã",
          time: "07:00",
          order: 1,
          notes: "45 min antes do treino",
          foods: [
            { id: "f1", name: "Ovo", quantity: 2, unit: "unidades", notes: "cozidos" },
            { id: "f2", name: "Banana", quantity: 1, unit: "unidade", notes: "" },
            { id: "f3", name: "Aveia", quantity: 30, unit: "g", notes: "em flocos" },
          ],
        },
        {
          id: "m2",
          name: "Almoço",
          time: "12:30",
          order: 2,
          foods: [
            { id: "f4", name: "Arroz", quantity: 150, unit: "g", notes: "integral" },
            { id: "f5", name: "Frango", quantity: 200, unit: "g", notes: "grelhado" },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
  // Dados da segunda aluna (Maria) para testar multi-aluno.
  const workoutsMaria: WorkoutDefine[] = [
    {
      id: "workout-m1",
      studentId: "student-maria",
      nutritionistId: "demo-user",
      name: "Treino A — Glúteos e Pernas",
      objective: "Hipertrofia",
      description: "Foco em glúteos",
      dayOfWeek: "monday",
      exercises: [
        { id: "ex21", name: "Agachamento sumô", sets: 4, repetitions: "12", weight: "40 kg", restSeconds: 90, notes: "Cadência controlada.", order: 1 },
        { id: "ex22", name: "Elevação pélvica", sets: 4, repetitions: "12", weight: "60 kg", restSeconds: 90, notes: "", order: 2 },
        { id: "ex23", name: "Cadeira abdutora", sets: 3, repetitions: "15", weight: "35 kg", restSeconds: 60, notes: "", order: 3 },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
  const dietsMaria: Diet[] = [
    {
      id: "diet-maria",
      studentId: "student-maria",
      nutritionistId: "demo-user",
      name: "Plano alimentar — Definição",
      description: "Foco em perda de gordura mantendo massa",
      startDate: "2026-09-01",
      endDate: "2026-11-30",
      meals: [
        {
          id: "m3",
          name: "Café da manhã",
          time: "07:30",
          order: 1,
          foods: [
            { id: "f6", name: "Iogurte natural", quantity: 200, unit: "g", notes: "sem açúcar" },
            { id: "f7", name: "Granola", quantity: 20, unit: "g", notes: "" },
          ],
        },
        {
          id: "m4",
          name: "Almoço",
          time: "12:30",
          order: 2,
          foods: [
            { id: "f8", name: "Salada verde", quantity: 1, unit: "porção", notes: "azeite 1 colher" },
            { id: "f9", name: "Peixe grelhado", quantity: 180, unit: "g", notes: "" },
            { id: "f10", name: "Batata-doce", quantity: 150, unit: "g", notes: "assada" },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
  const history: WorkoutHistoryEntry[] = [
    {
      id: "h1",
      studentId: "student-joao",
      workoutId: "workout-a",
      nutritionistId: "demo-user",
      completedAt: new Date().toISOString(),
      duration: 62,
      exercisesCompleted: 4,
      totalExercises: 4,
    },
  ];

  setJSON(LS_KEY.students, students);
  setJSON(LS_KEY.workouts, [...workouts, ...workoutsMaria]);
  setJSON(LS_KEY.diets, [...diets, ...dietsMaria]);
  setJSON(LS_KEY.history, history);
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
  if (!res.ok) {
    let msg = `API respondeu ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* sem corpo */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── API pública: modo original ─────────────────────────────────────────────

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

// ── API pública: gestão ────────────────────────────────────────────────────

// getMe devolve o perfil do usuário logado (nome, role etc.).
export async function getMe(token: string): Promise<UserProfile> {
  if (DEMO_MODE) {
    return {
      id: "demo-user",
      name: "Demo",
      email: "demo@treino.app",
      role: "nutritionist",
      status: "active",
    };
  }
  return request<UserProfile>("/api/me", token);
}

// Salva o próprio perfil (usado na primeira configuração do usuário).
export async function putMe(p: UserProfile, token: string): Promise<void> {
  if (DEMO_MODE) {
    return;
  }
  return request<void>("/api/me", token, { method: "PUT", body: JSON.stringify(p) });
}

// ── Alunos ──

export function listStudents(token: string): Promise<UserProfile[]> {
  if (DEMO_MODE) {
    return Promise.resolve(getJSON<UserProfile[]>(LS_KEY.students) ?? []);
  }
  return request<UserProfile[]>("/api/students", token);
}

export function getStudent(id: string, token: string): Promise<UserProfile> {
  if (DEMO_MODE) {
    const list = getJSON<UserProfile[]>(LS_KEY.students) ?? [];
    const s = list.find((x) => x.id === id);
    if (!s) return Promise.reject(new Error("aluno nao encontrado"));
    return Promise.resolve(s);
  }
  return request<UserProfile>(`/api/students/${id}`, token);
}

// Nutricionista edita dados do próprio aluno (nome, foto, status, datas).
export function updateStudent(id: string, p: Partial<UserProfile>, token: string): Promise<void> {
  if (DEMO_MODE) {
    const list = getJSON<UserProfile[]>(LS_KEY.students) ?? [];
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return Promise.reject(new Error("aluno nao encontrado"));
    list[idx] = { ...list[idx], ...p, id };
    setJSON(LS_KEY.students, list);
    return Promise.resolve();
  }
  return request<void>(`/api/students/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(p),
  });
}

// ── Usuários (admin) ──

export function listUsers(token: string): Promise<UserProfile[]> {
  if (DEMO_MODE) {
    return Promise.resolve([]);
  }
  return request<UserProfile[]>("/api/users", token);
}

export function createUser(p: UserProfile, token: string): Promise<UserProfile> {
  return request<UserProfile>("/api/users", token, {
    method: "POST",
    body: JSON.stringify(p),
  });
}

export function updateUser(id: string, p: UserProfile, token: string): Promise<void> {
  return request<void>(`/api/users/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(p),
  });
}

export function deleteUser(id: string, token: string): Promise<void> {
  return request<void>(`/api/users/${id}`, token, { method: "DELETE" });
}

// ── Treinos ──

export function listWorkouts(token: string): Promise<WorkoutDefine[]> {
  if (DEMO_MODE) {
    return Promise.resolve(getJSON<WorkoutDefine[]>(LS_KEY.workouts) ?? []);
  }
  return request<WorkoutDefine[]>("/api/workouts", token);
}

export function getWorkout(id: string, token: string): Promise<WorkoutDefine> {
  if (DEMO_MODE) {
    const list = getJSON<WorkoutDefine[]>(LS_KEY.workouts) ?? [];
    const w = list.find((x) => x.id === id);
    if (!w) return Promise.reject(new Error("treino nao encontrado"));
    return Promise.resolve(w);
  }
  return request<WorkoutDefine>(`/api/workouts/${id}`, token);
}

export function createWorkout(w: WorkoutDefine, token: string): Promise<WorkoutDefine> {
  if (DEMO_MODE) {
    const list = getJSON<WorkoutDefine[]>(LS_KEY.workouts) ?? [];
    const neu: WorkoutDefine = { ...w, id: `workout-${Date.now()}`, createdAt: new Date().toISOString() };
    setJSON(LS_KEY.workouts, [...list, neu]);
    return Promise.resolve(neu);
  }
  return request<WorkoutDefine>("/api/workouts", token, {
    method: "POST",
    body: JSON.stringify(w),
  });
}

export function updateWorkout(id: string, w: WorkoutDefine, token: string): Promise<void> {
  if (DEMO_MODE) {
    const list = getJSON<WorkoutDefine[]>(LS_KEY.workouts) ?? [];
    setJSON(
      LS_KEY.workouts,
      list.map((x) => (x.id === id ? { ...x, ...w, id } : x))
    );
    return Promise.resolve();
  }
  return request<void>(`/api/workouts/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(w),
  });
}

export function deleteWorkout(id: string, token: string): Promise<void> {
  if (DEMO_MODE) {
    const list = getJSON<WorkoutDefine[]>(LS_KEY.workouts) ?? [];
    setJSON(LS_KEY.workouts, list.filter((x) => x.id !== id));
    return Promise.resolve();
  }
  return request<void>(`/api/workouts/${id}`, token, { method: "DELETE" });
}

export function duplicateWorkout(id: string, req: DuplicateRequest, token: string): Promise<WorkoutDefine> {
  if (DEMO_MODE) {
    const list = getJSON<WorkoutDefine[]>(LS_KEY.workouts) ?? [];
    const src = list.find((x) => x.id === id);
    if (!src) return Promise.reject(new Error("treino nao encontrado"));
    const copy: WorkoutDefine = {
      ...src,
      id: `workout-${Date.now()}`,
      name: req.newName || `${src.name} (copia)`,
      studentId: req.newStudentId || src.studentId,
      createdAt: new Date().toISOString(),
      exercises: src.exercises?.map((e) => ({ ...e, id: undefined })),
    };
    setJSON(LS_KEY.workouts, [...list, copy]);
    return Promise.resolve(copy);
  }
  return request<WorkoutDefine>(`/api/workouts/${id}/duplicate`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Dietas ──

export function listDiets(token: string): Promise<Diet[]> {
  if (DEMO_MODE) {
    return Promise.resolve(getJSON<Diet[]>(LS_KEY.diets) ?? []);
  }
  return request<Diet[]>("/api/diets", token);
}

export function getDiet(id: string, token: string): Promise<Diet> {
  if (DEMO_MODE) {
    const list = getJSON<Diet[]>(LS_KEY.diets) ?? [];
    const d = list.find((x) => x.id === id);
    if (!d) return Promise.reject(new Error("dieta nao encontrada"));
    return Promise.resolve(d);
  }
  return request<Diet>(`/api/diets/${id}`, token);
}

export function createDiet(d: Diet, token: string): Promise<Diet> {
  if (DEMO_MODE) {
    const list = getJSON<Diet[]>(LS_KEY.diets) ?? [];
    const neu: Diet = { ...d, id: `diet-${Date.now()}`, createdAt: new Date().toISOString() };
    setJSON(LS_KEY.diets, [neu, ...list]);
    return Promise.resolve(neu);
  }
  return request<Diet>("/api/diets", token, {
    method: "POST",
    body: JSON.stringify(d),
  });
}

export function updateDiet(id: string, d: Diet, token: string): Promise<void> {
  if (DEMO_MODE) {
    const list = getJSON<Diet[]>(LS_KEY.diets) ?? [];
    setJSON(
      LS_KEY.diets,
      list.map((x) => (x.id === id ? { ...x, ...d, id } : x))
    );
    return Promise.resolve();
  }
  return request<void>(`/api/diets/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(d),
  });
}

export function deleteDiet(id: string, token: string): Promise<void> {
  if (DEMO_MODE) {
    const list = getJSON<Diet[]>(LS_KEY.diets) ?? [];
    setJSON(LS_KEY.diets, list.filter((x) => x.id !== id));
    return Promise.resolve();
  }
  return request<void>(`/api/diets/${id}`, token, { method: "DELETE" });
}

export function duplicateDiet(id: string, req: DuplicateRequest, token: string): Promise<Diet> {
  if (DEMO_MODE) {
    const list = getJSON<Diet[]>(LS_KEY.diets) ?? [];
    const src = list.find((x) => x.id === id);
    if (!src) return Promise.reject(new Error("dieta nao encontrada"));
    const copy: Diet = {
      ...src,
      id: `diet-${Date.now()}`,
      name: req.newName || `${src.name} (copia)`,
      studentId: req.newStudentId || src.studentId,
      createdAt: new Date().toISOString(),
      meals: src.meals?.map((m) => ({
        ...m,
        id: undefined,
        foods: m.foods?.map((f) => ({ ...f, id: undefined })),
      })),
    };
    setJSON(LS_KEY.diets, [copy, ...list]);
    return Promise.resolve(copy);
  }
  return request<Diet>(`/api/diets/${id}/duplicate`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Histórico ──

export function listHistory(token: string): Promise<WorkoutHistoryEntry[]> {
  if (DEMO_MODE) {
    return Promise.resolve(getJSON<WorkoutHistoryEntry[]>(LS_KEY.history) ?? []);
  }
  return request<WorkoutHistoryEntry[]>("/api/workout-history", token);
}

export function completeWorkout(req: CompleteWorkoutRequest, token: string): Promise<WorkoutHistoryEntry> {
  if (DEMO_MODE) {
    const list = getJSON<WorkoutHistoryEntry[]>(LS_KEY.history) ?? [];
    const workouts = getJSON<WorkoutDefine[]>(LS_KEY.workouts) ?? [];
    const workout = workouts.find((w) => w.id === req.workoutId);
    const neu: WorkoutHistoryEntry = {
      ...req,
      id: `h-${Date.now()}`,
      studentId: workout?.studentId ?? "demo-student",
      nutritionistId: workout?.nutritionistId ?? "demo-user",
      completedAt: new Date().toISOString(),
    };
    setJSON(LS_KEY.history, [neu, ...list]);
    return Promise.resolve(neu);
  }
  return request<WorkoutHistoryEntry>("/api/workouts/complete", token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}