"use client";

// Cliente HTTP para a API Go que roda no Cloud Run.
import type {
  ApproveUserRequest,
  AssignProgramRequest,
  Diet,
  DuplicateRequest,
  Exercise,
  ImportProgramRequest,
  RejectUserRequest,
  TrainingProgram,
  UserProfile,
  WorkoutDefine,
} from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

export const apiConfigured = Boolean(API_URL);

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

// ── API pública: gestão ────────────────────────────────────────────────────

// getMe devolve o perfil do usuário logado (nome, role etc.).
export async function getMe(token: string): Promise<UserProfile> {
  return request<UserProfile>("/api/me", token);
}

// Salva o próprio perfil (usado na primeira configuração do usuário).
export async function putMe(p: UserProfile, token: string): Promise<void> {
  return request<void>("/api/me", token, { method: "PUT", body: JSON.stringify(p) });
}

// ── Alunos ──

export function listStudents(token: string): Promise<UserProfile[]> {
  return request<UserProfile[]>("/api/students", token);
}

export function getStudent(id: string, token: string): Promise<UserProfile> {
  return request<UserProfile>(`/api/students/${id}`, token);
}

// Nutricionista edita dados do próprio aluno (nome, foto, status, datas).
export function updateStudent(id: string, p: Partial<UserProfile>, token: string): Promise<void> {
  return request<void>(`/api/students/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(p),
  });
}

// ── Usuários (admin) ──

export function listUsers(token: string): Promise<UserProfile[]> {
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
  return request<UserProfile[]>("/api/users/pending", token);
}

// Aprova um cadastro e confirma o papel student.
export function approveUser(
  id: string,
  req: ApproveUserRequest,
  token: string
): Promise<void> {
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
  return request<void>(`/api/users/${id}/reject`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Treinos ──

export function listWorkouts(token: string): Promise<WorkoutDefine[]> {
  return request<WorkoutDefine[]>("/api/workouts", token);
}

export function getWorkout(id: string, token: string): Promise<WorkoutDefine> {
  return request<WorkoutDefine>(`/api/workouts/${id}`, token);
}

export function createWorkout(w: WorkoutDefine, token: string): Promise<WorkoutDefine> {
  return request<WorkoutDefine>("/api/workouts", token, {
    method: "POST",
    body: JSON.stringify(w),
  });
}

export function updateWorkout(id: string, w: WorkoutDefine, token: string): Promise<void> {
  return request<void>(`/api/workouts/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(w),
  });
}

export function deleteWorkout(id: string, token: string): Promise<void> {
  return request<void>(`/api/workouts/${id}`, token, { method: "DELETE" });
}

export function duplicateWorkout(id: string, req: DuplicateRequest, token: string): Promise<WorkoutDefine> {
  return request<WorkoutDefine>(`/api/workouts/${id}/duplicate`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Programas de treino (F19) ────────────────────────────────────────────
// Um programa é uma coleção de TREINOS: `workouts` guarda apenas REFERÊNCIAS a
// `workouts/{id}`. Atribuir a um aluno materializa CÓPIAS dos treinos do
// modelo (o original fica na biblioteca) e repassa as referências para as cópias.

export function listPrograms(token: string): Promise<TrainingProgram[]> {
  return request<TrainingProgram[]>("/api/programs", token);
}

export function getProgram(id: string, token: string): Promise<TrainingProgram> {
  return request<TrainingProgram>(`/api/programs/${id}`, token);
}

export function createProgram(p: TrainingProgram, token: string): Promise<TrainingProgram> {
  return request<TrainingProgram>("/api/programs", token, {
    method: "POST",
    body: JSON.stringify(p),
  });
}

export function updateProgram(id: string, p: TrainingProgram, token: string): Promise<void> {
  return request<void>(`/api/programs/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(p),
  });
}

export function deleteProgram(id: string, token: string): Promise<void> {
  return request<void>(`/api/programs/${id}`, token, { method: "DELETE" });
}

export function assignProgram(id: string, studentId: string, token: string): Promise<TrainingProgram> {
  return request<TrainingProgram>(`/api/programs/${id}/assign`, token, {
    method: "POST",
    body: JSON.stringify({ studentId } satisfies AssignProgramRequest),
  });
}

export function duplicateProgram(id: string, req: DuplicateRequest, token: string): Promise<TrainingProgram> {
  return request<TrainingProgram>(`/api/programs/${id}/duplicate`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Importa um programa em markdown.
 *
 * O PARSING é do backend Go (programmd) — o cliente só envia o texto e recebe
 * o programa com os treinos já criados.
 */
export function importProgram(req: ImportProgramRequest, token: string): Promise<TrainingProgram> {
  return request<TrainingProgram>("/api/programs/import", token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Biblioteca de exercícios (F5) ──────────────────────────────────────────

export function listExercises(token: string): Promise<Exercise[]> {
  return request<Exercise[]>("/api/exercises", token);
}

export function getExercise(id: string, token: string): Promise<Exercise> {
  return request<Exercise>(`/api/exercises/${id}`, token);
}

export function createExercise(e: Exercise, token: string): Promise<Exercise> {
  return request<Exercise>("/api/exercises", token, {
    method: "POST",
    body: JSON.stringify(e),
  });
}

export function updateExercise(id: string, e: Exercise, token: string): Promise<void> {
  return request<void>(`/api/exercises/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(e),
  });
}

export function deleteExercise(id: string, token: string): Promise<void> {
  return request<void>(`/api/exercises/${id}`, token, { method: "DELETE" });
}

// ── Dietas ──

export function listDiets(token: string): Promise<Diet[]> {
  return request<Diet[]>("/api/diets", token);
}

export function getDiet(id: string, token: string): Promise<Diet> {
  return request<Diet>(`/api/diets/${id}`, token);
}

export function createDiet(d: Diet, token: string): Promise<Diet> {
  return request<Diet>("/api/diets", token, {
    method: "POST",
    body: JSON.stringify(d),
  });
}

export function updateDiet(id: string, d: Diet, token: string): Promise<void> {
  return request<void>(`/api/diets/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(d),
  });
}

export function deleteDiet(id: string, token: string): Promise<void> {
  return request<void>(`/api/diets/${id}`, token, { method: "DELETE" });
}

export function duplicateDiet(id: string, req: DuplicateRequest, token: string): Promise<Diet> {
  return request<Diet>(`/api/diets/${id}/duplicate`, token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Histórico ──
