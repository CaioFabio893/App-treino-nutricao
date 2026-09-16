"use client";

// Cliente HTTP para a API Go que roda no Cloud Run.
// No modo demo (NEXT_PUBLIC_DEMO=1) simula tudo em localStorage, sem rede.
import type {
  AppState,
  ApproveUserRequest,
  CommentRequest,
  CompleteWorkoutRequest,
  CreatePostRequest,
  Diet,
  DietDailyLog,
  DuplicateRequest,
  MealCheck,
  Plan,
  Post,
  PostsPage,
  PRs,
  PublicProfile,
  RankingResponse,
  RejectUserRequest,
  Role,
  ScoreHistoryEntry,
  SessionData,
  UpsertDietLogRequest,
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
  seeded: "ll_demo_seeded_v4",
  students: "ll_demo_students",
  workouts: "ll_demo_workouts",
  diets: "ll_demo_diets",
  history: "ll_demo_history",
  posts: "ll_demo_posts",
  dietLogs: "ll_demo_diet_logs",
  scores: "ll_demo_scores",
  scoreHistory: "ll_demo_score_history",
  plans: "ll_demo_plans",
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

// ── Identidade do modo demo ────────────────────────────────────────────────
// Em produção a identidade do usuário vem do token JWT. No modo demo o token
// carrega o id simulado (ex.: "demo:student-joao") emitido pelo getToken() do
// AuthProvider — assim posts, likes, comentários e ranking são atribuídos ao
// papel realmente ativo (aluno ou nutricionista), nunca a um id fixo.
function demoMe(
  token: string
): { id: string; name: string; email: string; role: Role; nutritionistID?: string; status: UserProfile["status"] } {
  const id = token && token.startsWith("demo:") ? token.slice("demo:".length) : "demo-user";
  if (id === "student-joao") {
    return {
      id: "student-joao",
      name: "João Silva",
      email: "joao@email.com",
      role: "student",
      nutritionistID: "demo-user",
      status: "active",
    };
  }
  return {
    id: "demo-user",
    name: "Demo (Nutricionista)",
    email: "demo@treino.app",
    role: "nutritionist",
    status: "active",
  };
}

// Nome de um aluno da seed para posts automáticos (libera o hardcode e mantém
// coerência caso a lista de alunos da demo seja editada no painel).
function demoStudentName(studentId: string): string {
  const students = getJSON<UserProfile[]>(LS_KEY.students) ?? [];
  return students.find((s) => s.id === studentId)?.name ?? studentId;
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
      exercises: [
        {
          name: "Supino reto",
          order: 1,
          note: "Bom rendimento!",
          sets: [
            { weight: "55", reps: "8", done: true },
            { weight: "60", reps: "7", done: true },
            { weight: "60", reps: "6", done: true },
            { weight: "55", reps: "8", done: true },
          ],
        },
        {
          name: "Supino inclinado",
          order: 2,
          sets: [
            { weight: "40", reps: "10", done: true },
            { weight: "45", reps: "10", done: true },
          ],
        },
        {
          name: "Crucifixo",
          order: 3,
          sets: [{ weight: "90", reps: "12", done: true }],
        },
        {
          name: "Tríceps corda",
          order: 4,
          sets: [{ weight: "25", reps: "12", done: true }],
        },
      ],
    },
  ];

  setJSON(LS_KEY.students, students);
  setJSON(LS_KEY.workouts, [...workouts, ...workoutsMaria]);
  setJSON(LS_KEY.diets, [...diets, ...dietsMaria]);
  setJSON(LS_KEY.history, history);

  // ── Rede social (feed global) ──
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  };
  const posts: Post[] = [
    {
      id: "post-1",
      userId: "student-joao",
      userName: "João Silva",
      type: "workout",
      text: "Treino A — Peito e Tríceps concluído em 62 min! 💪 Foco total hoje.",
      workoutId: "workout-a",
      workoutName: "Treino A — Peito e Tríceps",
      date: daysAgo(0).toISOString().slice(0, 10),
      likes: { "student-maria": true, "demo-user": true },
      likeCount: 2,
      comments: [
        {
          id: "c1",
          userId: "student-maria",
          userName: "Maria Souza",
          text: "Arrasou! 💪",
          createdAt: iso(daysAgo(0)),
        },
        {
          id: "c2",
          userId: "demo-user",
          userName: "Demo (Nutricionista)",
          text: "Ótimo rendimento, João! Continua assim.",
          createdAt: iso(daysAgo(0)),
        },
      ],
      createdAt: iso(daysAgo(0)),
    },
    {
      id: "post-2",
      userId: "student-maria",
      userName: "Maria Souza",
      type: "diet",
      text: "Dia de dieta seguida à risca! 🥗🥑",
      dietId: "diet-maria",
      dietName: "Plano alimentar — Definição",
      date: daysAgo(1).toISOString().slice(0, 10),
      likes: { "student-joao": true },
      likeCount: 1,
      comments: [],
      createdAt: iso(daysAgo(1)),
    },
    {
      id: "post-3",
      userId: "student-joao",
      userName: "João Silva",
      type: "workout",
      text: "Treino C — Pernas concluído! Novo PR no agachamento 💥",
      workoutId: "workout-c",
      workoutName: "Treino C — Pernas",
      date: daysAgo(2).toISOString().slice(0, 10),
      likes: {},
      likeCount: 0,
      comments: [],
      createdAt: iso(daysAgo(2)),
    },
    {
      id: "post-4",
      userId: "student-maria",
      userName: "Maria Souza",
      type: "manual",
      text: "Meta da semana: 5 treinos e dieta 100% de segunda a sexta. Vamos! 🎯",
      date: daysAgo(3).toISOString().slice(0, 10),
      likes: { "student-joao": true, "demo-user": true },
      likeCount: 2,
      comments: [
        {
          id: "c3",
          userId: "demo-user",
          userName: "Demo (Nutricionista)",
          text: "Conto com você, Maria!",
          createdAt: iso(daysAgo(3)),
        },
      ],
      createdAt: iso(daysAgo(3)),
    },
  ];
  setJSON(LS_KEY.posts, posts);

  // ── Logs diários de dieta (últimos 14 dias) ──
  const mealNames = ["Café da manhã", "Almoço", "Lanche", "Jantar"];
  const dietLogs: DietDailyLog[] = [];
  for (let n = 0; n < 14; n++) {
    const d = daysAgo(n).toISOString().slice(0, 10);
    const isJoao = n % 3 !== 1; // João seguindo quase sempre
    const isMaria = n % 2 === 0; // Maria mais irregular
    const mk = (ok: boolean): MealCheck[] =>
      mealNames.map((m, i) => ({ mealId: `m${i}`, mealName: m, followed: ok }));
    if (isJoao) {
      dietLogs.push({
        studentId: "student-joao",
        nutritionistId: "demo-user",
        dietId: "diet-outubro",
        dietName: "Plano alimentar — Hipertrofia",
        date: d,
        status: n === 1 || n === 4 ? "partial" : "followed",
        mealChecks: n === 1 || n === 4 ? mk(false) : mk(true),
      });
    }
    if (isMaria) {
      dietLogs.push({
        studentId: "student-maria",
        nutritionistId: "demo-user",
        dietId: "diet-maria",
        dietName: "Plano alimentar — Definição",
        date: d,
        status: n % 4 === 0 ? "followed" : n % 4 === 2 ? "partial" : "not_followed",
        mealChecks:
          n % 4 === 0
            ? mk(true)
            : n % 4 === 2
              ? mealNames.map((m, i) => ({ mealId: `m${i}`, mealName: m, followed: i < 2 }))
              : mk(false),
      });
    }
  }
  setJSON(LS_KEY.dietLogs, dietLogs);

  // ── Pontuação (ciclo atual + histórico de um ciclo fechado) ──
  const cycleId = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  setJSON(LS_KEY.scores, [
    { studentId: "student-joao", rawPoints: 9.4, cycleId, score: 9.4, daysElapsed: 14, daysCompleted: 13 },
    { studentId: "student-maria", rawPoints: 6.2, cycleId, score: 6.2, daysElapsed: 14, daysCompleted: 8 },
  ]);
  setJSON(LS_KEY.scoreHistory, [
    { studentId: "student-joao", cycleId: "2026-Q2", startDate: "2026-04-01", endDate: "2026-06-30", rawPoints: 8.1, days: 91, score: 8.1 },
    { studentId: "student-maria", cycleId: "2026-Q2", startDate: "2026-04-01", endDate: "2026-06-30", rawPoints: 7.3, days: 91, score: 7.3 },
  ] as ScoreHistoryEntry[]);

  localStorage.setItem(LS_KEY.seeded, "1");
}

if (DEMO_MODE) seedDemo();

// ── Requisições reais ──────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 15_000;

const NETWORK_ERROR_MSG =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
const TIMEOUT_ERROR_MSG =
  "O servidor está demorando para responder. Tente novamente em instantes.";
const UNEXPECTED_ERROR_MSG =
  "Ocorreu um erro inesperado. Tente novamente.";

// Erro de API com status HTTP (quando a API respondeu) e mensagem já pronta
// para exibir ao usuário. Tempos de rede (offline/timeout) têm status undefined.
export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Converte qualquer erro em mensagem segura para o usuário (sem detalhes
// técnicos, stack trace ou mensagens internas do backend).
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return UNEXPECTED_ERROR_MSG;
}

// Mapêia o status HTTP para uma mensagem amigável. Para 4xx com mensagem do
// backend (validação/objeto não encontrado), preserva a mensagem — o backend
// usa textos curtos e legíveis. Nunca expõe erros internos de 5xx.
function errorMessageFor(status: number, backendMsg?: string): string {
  if (status === 401) {
    return "Sua sessão expirou ou não é válida. Entre novamente.";
  }
  if (status === 403) {
    return "Você não tem permissão para realizar esta ação.";
  }
  if (status === 429) {
    return "Muitas requisições por enquanto. Aguarde um pouco e tente novamente.";
  }
  if (status >= 500) {
    return "Erro interno do servidor. Tente novamente em instantes.";
  }
  if (backendMsg && backendMsg.trim()) return backendMsg.trim();
  return "Não foi possível concluir a operação. Verifique os dados e tente novamente.";
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  if (!API_URL) {
    throw new ApiError("API não configurada (NEXT_PUBLIC_API_URL)");
  }

  // Timeout: evita que a chamada fique pendurada para sempre quando o
  // servidor não responde. Compõe com o AbortSignal do caller, se houver.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const externalSignal = init?.signal;
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new ApiError(UNEXPECTED_ERROR_MSG);
    }
    externalSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
      });
    } catch {
      // fetch só rejeita em falha de rede/CORS/dns — nunca por status HTTP.
      if (externalSignal?.aborted) throw new ApiError(UNEXPECTED_ERROR_MSG);
      if (controller.signal.aborted) throw new ApiError(TIMEOUT_ERROR_MSG);
      throw new ApiError(NETWORK_ERROR_MSG);
    }

    if (!res.ok) {
      let backendMsg: string | undefined;
      try {
        const body = await res.json();
        if (body && typeof body.error === "string") backendMsg = body.error;
      } catch {
        /* corpo não-JSON (erro em texto puro) — usa o mapeamento por status */
      }
      throw new ApiError(errorMessageFor(res.status, backendMsg), res.status);
    }

    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      // 2xx com corpo inválido: comportamento anômalo do backend.
      throw new ApiError(
        "O servidor retornou uma resposta inválida. Tente novamente."
      );
    }
  } finally {
    clearTimeout(timer);
  }
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
    return demoMe(token);
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

// ── Aprovação de cadastro + planos (admin) ─────────────────────────────────

// Fila de cadastros aguardando aprovação.
export function listPendingUsers(token: string): Promise<UserProfile[]> {
  if (DEMO_MODE) {
    return Promise.resolve([]);
  }
  return request<UserProfile[]>("/api/users/pending", token);
}

// Aprova um cadastro, define papel e (para aluno) plano com snapshot de features.
export function approveUser(
  id: string,
  req: ApproveUserRequest,
  token: string
): Promise<void> {
  if (DEMO_MODE) {
    demoApproveLike(id, { ...req, status: "active" });
    return Promise.resolve();
  }
  return request<void>(`/api/users/${id}/approve`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Recusa o cadastro (marca rejected e exclui a conta do Firebase Auth).
export function rejectUser(
  id: string,
  req: RejectUserRequest,
  token: string
): Promise<void> {
  if (DEMO_MODE) {
    demoApproveLike(id, { role: "student", status: "rejected", rejectedReason: req.reason });
    return Promise.resolve();
  }
  return request<void>(`/api/users/${id}/reject`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Troca o plano (e o snapshot de features) de um aluno já aprovado.
export function assignPlan(id: string, planID: string, token: string): Promise<void> {
  if (DEMO_MODE) {
    const plans = getJSON<Plan[]>(LS_KEY.plans) ?? [];
    const plan = plans.find((p) => p.id === planID);
    updateStudent(
      id,
      { planID, features: plan?.features ?? [] },
      "demo-token"
    );
    return Promise.resolve();
  }
  return request<void>(`/api/users/${id}/assign-plan`, token, {
    method: "POST",
    body: JSON.stringify({ planID }),
  });
}

// Planos (pacotes de features).
export function listPlans(token: string): Promise<Plan[]> {
  if (DEMO_MODE) {
    let plans = getJSON<Plan[]>(LS_KEY.plans);
    if (!plans || plans.length === 0) {
      plans = [
        {
          id: "plano-basico",
          name: "Básico",
          description: "Somente treinos (tier gratuito)",
          features: ["workouts"],
          active: true,
        },
        {
          id: "plano-completo",
          name: "Completo",
          description: "Treinos + dietas + comunidade + ranking",
          features: ["workouts", "diet", "community", "ranking"],
          active: true,
        },
      ];
      setJSON(LS_KEY.plans, plans);
    }
    return Promise.resolve(plans);
  }
  return request<Plan[]>("/api/plans", token);
}

export function createPlan(p: Plan, token: string): Promise<Plan> {
  if (DEMO_MODE) {
    const plans = getJSON<Plan[]>(LS_KEY.plans) ?? [];
    const neu: Plan = { ...p, id: `plano-${Date.now()}` };
    setJSON(LS_KEY.plans, [neu, ...plans]);
    return Promise.resolve(neu);
  }
  return request<Plan>("/api/plans", token, {
    method: "POST",
    body: JSON.stringify(p),
  });
}

export function updatePlan(id: string, p: Plan, token: string): Promise<void> {
  if (DEMO_MODE) {
    const plans = getJSON<Plan[]>(LS_KEY.plans) ?? [];
    setJSON(
      LS_KEY.plans,
      plans.map((x) => (x.id === id ? { ...x, ...p, id } : x))
    );
    return Promise.resolve();
  }
  return request<void>(`/api/plans/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(p),
  });
}

export function deletePlan(id: string, token: string): Promise<void> {
  if (DEMO_MODE) {
    const plans = getJSON<Plan[]>(LS_KEY.plans) ?? [];
    setJSON(LS_KEY.plans, plans.filter((x) => x.id !== id));
    return Promise.resolve();
  }
  return request<void>(`/api/plans/${id}`, token, { method: "DELETE" });
}

// Modo demo: aplica o approve/reject na lista local de alunos (seed).
function demoApproveLike(id: string, patch: Partial<UserProfile>): void {
  const students = getJSON<UserProfile[]>(LS_KEY.students) ?? [];
  const idx = students.findIndex((s) => s.id === id);
  if (idx === -1) return;
  students[idx] = { ...students[idx], ...patch, id };
  setJSON(LS_KEY.students, students);
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

// Página do histórico (mais recentes primeiro). Usado na Timeline com
// botão "Carregar mais". O backend aceita offset/limit e devolve
// { entries, total, offset, limit, hasMore }.
export interface HistoryPage {
  entries: WorkoutHistoryEntry[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export function listHistoryPage(
  token: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<HistoryPage> {
  if (DEMO_MODE) {
    const all = getJSON<WorkoutHistoryEntry[]>(LS_KEY.history) ?? [];
    const sorted = [...all].sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
    );
    const limit = opts.limit && opts.limit > 0 ? opts.limit : sorted.length;
    const offset = Math.max(0, opts.offset ?? 0);
    const entries = sorted.slice(offset, offset + limit);
    return Promise.resolve({
      entries,
      total: sorted.length,
      offset,
      limit,
      hasMore: offset + limit < sorted.length,
    });
  }
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.offset) qs.set("offset", String(opts.offset));
  const q = qs.toString();
  return request<HistoryPage>(`/api/workout-history${q ? `?${q}` : ""}`, token);
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
      workoutName: workout?.name ?? "",
      completedAt: new Date().toISOString(),
    };
    setJSON(LS_KEY.history, [neu, ...list]);

    // Feed automático (mesmo comportamento da API real: 1 post/dia por tipo).
    const today = new Date().toISOString().slice(0, 10);
    const allPosts = getJSON<Post[]>(LS_KEY.posts) ?? [];
    const already = allPosts.some(
      (p) => p.userId === neu.studentId && p.type === "workout" && p.date === today
    );
    if (!already) {
      allPosts.unshift({
        id: `post-${Date.now()}`,
        userId: neu.studentId,
        userName: demoStudentName(neu.studentId),
        type: "workout",
        text:
          req.caption?.trim() ||
          `${workout?.name ?? "Treino"} concluído${req.duration ? ` em ${req.duration} min` : ""}! 💪`,
        workoutId: workout?.id,
        workoutName: workout?.name,
        date: today,
        likes: {},
        likeCount: 0,
        comments: [],
        createdAt: new Date().toISOString(),
      });
      setJSON(LS_KEY.posts, allPosts);
    }
    return Promise.resolve(neu);
  }
  return request<WorkoutHistoryEntry>("/api/workouts/complete", token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Rede social (feed global) ──────────────────────────────────────────────

// Feed paginado (mais recentes primeiro). O backend aceita limit e cursor
// e devolve { posts, next }; o modo demo devolve tudo de uma vez.
export function listPosts(
  token: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<PostsPage> {
  if (DEMO_MODE) {
    const posts = getJSON<Post[]>(LS_KEY.posts) ?? [];
    const visible = posts
      .filter((p) => !p.deleted)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return Promise.resolve({ posts: visible, nextCursor: undefined });
  }
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.cursor) qs.set("cursor", opts.cursor);
  const q = qs.toString();
  return request<{ posts: Post[]; next?: string }>(
    `/api/posts${q ? `?${q}` : ""}`,
    token
  ).then((r) => ({ posts: r.posts, nextCursor: r.next }));
}

export function createPost(req: CreatePostRequest, token: string): Promise<Post> {
  if (DEMO_MODE) {
    const posts = getJSON<Post[]>(LS_KEY.posts) ?? [];
    const me = demoMe(token);
    const neu: Post = {
      id: `post-${Date.now()}`,
      userId: me.id,
      userName: me.name,
      type: req.type,
      text: req.text,
      date: new Date().toISOString().slice(0, 10),
      likes: {},
      likeCount: 0,
      comments: [],
      createdAt: new Date().toISOString(),
    };
    setJSON(LS_KEY.posts, [neu, ...posts]);
    return Promise.resolve(neu);
  }
  return request<Post>("/api/posts", token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function toggleLike(postId: string, token: string): Promise<Post> {
  if (DEMO_MODE) {
    const posts = getJSON<Post[]>(LS_KEY.posts) ?? [];
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx === -1) return Promise.reject(new Error("post nao encontrado"));
    const p = posts[idx];
    const me = demoMe(token).id;
    const likes = { ...(p.likes ?? {}) };
    if (likes[me]) delete likes[me];
    else likes[me] = true;
    const next = { ...p, likes, likeCount: Object.keys(likes).length };
    posts[idx] = next;
    setJSON(LS_KEY.posts, posts);
    return Promise.resolve(next);
  }
  return request<Post>(`/api/posts/${postId}/like`, token, { method: "POST" });
}

export function addComment(postId: string, req: CommentRequest, token: string): Promise<Post> {
  if (DEMO_MODE) {
    const posts = getJSON<Post[]>(LS_KEY.posts) ?? [];
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx === -1) return Promise.reject(new Error("post nao encontrado"));
    const p = posts[idx];
    const me = demoMe(token);
    const next: Post = {
      ...p,
      comments: [
        ...(p.comments ?? []),
        {
          id: `c-${Date.now()}`,
          userId: me.id,
          userName: me.name,
          text: req.text,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    posts[idx] = next;
    setJSON(LS_KEY.posts, posts);
    return Promise.resolve(next);
  }
  return request<Post>(`/api/posts/${postId}/comments`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function deleteComment(postId: string, commentId: string, token: string): Promise<Post> {
  if (DEMO_MODE) {
    const posts = getJSON<Post[]>(LS_KEY.posts) ?? [];
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx === -1) return Promise.reject(new Error("post nao encontrado"));
    const p = posts[idx];
    const next: Post = {
      ...p,
      comments: (p.comments ?? []).filter((c) => c.id !== commentId),
    };
    posts[idx] = next;
    setJSON(LS_KEY.posts, posts);
    return Promise.resolve(next);
  }
  return request<Post>(`/api/posts/${postId}/comments/${commentId}`, token, {
    method: "DELETE",
  });
}

export function deletePost(postId: string, token: string): Promise<void> {
  if (DEMO_MODE) {
    const posts = getJSON<Post[]>(LS_KEY.posts) ?? [];
    setJSON(LS_KEY.posts, posts.map((p) => (p.id === postId ? { ...p, deleted: true } : p)));
    return Promise.resolve();
  }
  return request<void>(`/api/posts/${postId}`, token, { method: "DELETE" });
}

// ── Dieta diária (dia + refeição) ──────────────────────────────────────────

export function listDietLogs(studentId: string, token: string, from?: string, to?: string): Promise<DietDailyLog[]> {
  if (DEMO_MODE) {
    let logs = getJSON<DietDailyLog[]>(LS_KEY.dietLogs) ?? [];
    if (studentId) logs = logs.filter((l) => l.studentId === studentId);
    if (from) logs = logs.filter((l) => l.date >= from);
    if (to) logs = logs.filter((l) => l.date <= to);
    return Promise.resolve(logs);
  }
  const qs = new URLSearchParams({ studentId });
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  return request<{ logs: DietDailyLog[] }>(`/api/diet-logs?${qs.toString()}`, token).then(
    (r) => r.logs
  );
}

export function putDietLog(req: UpsertDietLogRequest, token: string): Promise<DietDailyLog> {
  if (DEMO_MODE) {
    const logs = getJSON<DietDailyLog[]>(LS_KEY.dietLogs) ?? [];
    const studentId = req.studentId ?? "demo-user";
    const existing = logs.find((l) => l.studentId === studentId && l.date === req.date);
    const neu: DietDailyLog = {
      ...(existing ?? {}),
      studentId,
      nutritionistId: "demo-user",
      date: req.date,
      status: req.status ?? "followed",
      mealChecks: req.mealChecks,
      note: req.note,
      caption: req.caption,
      updatedAt: new Date().toISOString(),
    };
    const next = existing
      ? logs.map((l) => (l === existing ? neu : l))
      : [...logs, neu];
    setJSON(LS_KEY.dietLogs, next);

    // Post automático de dieta (1/dia): só quando seguida.
    const allPosts = getJSON<Post[]>(LS_KEY.posts) ?? [];
    const d = allPosts.find((p) => p.userId === studentId && p.type === "diet" && p.date === req.date && !p.deleted);
    if (neu.status === "followed") {
      if (d) {
        const idx = allPosts.indexOf(d);
        allPosts[idx] = { ...d, text: req.caption?.trim() || d.text };
      } else {
        allPosts.unshift({
          id: `post-${Date.now()}`,
          userId: studentId,
          userName: demoStudentName(studentId),
          type: "diet",
          text: req.caption?.trim() || "Dia de dieta seguida à risca! 🥗",
          dietId: neu.dietId,
          dietName: neu.dietName,
          date: req.date,
          likes: {},
          likeCount: 0,
          comments: [],
          createdAt: new Date().toISOString(),
        });
      }
    } else if (d) {
      allPosts[allPosts.indexOf(d)] = { ...d, deleted: true };
    }
    setJSON(LS_KEY.posts, allPosts);
    return Promise.resolve(neu);
  }
  return request<DietDailyLog>("/api/diet-logs", token, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

// ── Ranking / pontuação / perfil público ───────────────────────────────────

export function getRanking(token: string): Promise<RankingResponse> {
  if (DEMO_MODE) {
    const me = demoMe(token);
    const top: RankingResponse["top"] = [
      { studentId: "student-joao", name: "João Silva", score: 9.4, rank: 1 },
      { studentId: "student-maria", name: "Maria Souza", score: 6.2, rank: 2 },
    ];
    // Igual à API real: self só existe para o aluno logado; nutricionista
    // recebe full (os alunos dele). Nenhum caso mostra o nutricionista como
    // participante do ranking de alunos.
    const self =
      me.role === "student"
        ? top.find((e) => e.studentId === me.id) ?? {
            studentId: me.id,
            name: me.name,
            score: 0,
            rank: top.length + 1,
          }
        : undefined;
    return Promise.resolve({
      cycleId: "2026-Q3",
      cycleStart: "2026-07-01",
      cycleEnd: "2026-09-30",
      top,
      total: top.length,
      self,
      full: me.role === "student" ? undefined : top,
    });
  }
  return request<RankingResponse>("/api/ranking", token);
}

export function getScoreHistory(studentId: string, token: string): Promise<ScoreHistoryEntry[]> {
  if (DEMO_MODE) {
    const all = getJSON<ScoreHistoryEntry[]>(LS_KEY.scoreHistory) ?? [];
    return Promise.resolve(all.filter((h) => h.studentId === studentId));
  }
  const qs = new URLSearchParams({ studentId });
  return request<{ history: ScoreHistoryEntry[] }>(`/api/scores/history?${qs.toString()}`, token).then(
    (r) => r.history
  );
}

export function getPublicProfile(id: string, token: string): Promise<PublicProfile> {
  if (DEMO_MODE) {
    return Promise.resolve({
      id,
      name: id === "student-joao" ? "João Silva" : id === "student-maria" ? "Maria Souza" : "Demo (Nutricionista)",
      photoURL: undefined,
      bio: id === "student-joao" ? "Focado em hipertrofia. 🏋️" : id === "student-maria" ? "Definição e saúde. 🥗" : "Nutricionista esportiva.",
      role: id === "demo-user" ? "nutritionist" : "student",
      streak: id === "student-joao" ? 5 : 2,
      score: id === "demo-user" ? undefined : id === "student-joao" ? 9.4 : 6.2,
      cycleId: "2026-Q3",
      rank: id === "student-joao" ? 1 : 2,
    });
  }
  return request<PublicProfile>(`/api/public/profile/${id}`, token);
}