// ── Novos tipos: gestão ──

// Modelo de 2 papéis: quem administra a plataforma e quem consome. Aprovação e
// pausa são eixos SEPARADOS (ver Status) — pausar não torna o cadastro
// "não aprovado", e nenhuma regra deve tratar os dois como sinônimos.
export type Role = "admin" | "student";

/** Situação do cadastro: pendente de aprovação, ativo, pausado, inativo ou recusado. */
export type Status = "pending_approval" | "active" | "paused" | "inactive" | "rejected";

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role: Role;
  status?: Status;
  /** "password" | "google.com" — preenchido no cadastro. */
  authProvider?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  createdAt?: string;
  /** true quando o usuário logou mas ainda não criou o perfil (nome). */
  needsProfile?: boolean;
  /** true quando o cadastro está pendente de aprovação ou recusado. */
  needsApproval?: boolean;
}

export interface ApproveUserRequest {
  role: Role;
}

export interface RejectUserRequest {
  reason?: string;
}


export interface WorkoutExercise {
  phase?: "warmup" | "main" | "cardio" | "stretching";
  durationSeconds?: number;
  timerExcluded?: boolean;
  id?: string;
  name: string;
  description?: string;
  sets: number;
  repetitions: string;
  weight?: string;
  restSeconds?: number;
  videoUrl?: string;
  notes?: string;
  order: number;
}

/**
 * Exercício da biblioteca compartilhada (catálogo global — F5).
 * Ao selecionar num treino, os dados são COPIADOS para um WorkoutExercise
 * (snapshot) — a biblioteca nunca vira referência viva no treino.
 */
export interface Exercise {
  id?: string;
  name: string;
  description?: string;
  muscleGroup?: string;
  equipment?: string;
  videoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkoutDefine {
  modality?: "gym" | "home";
  circuitSeconds?: number;
  id?: string;
  // Vazio/ausente = treino de biblioteca (ainda não atribuído a aluno).
  studentId?: string;
  name: string;
  description?: string;
  objective?: string;
  dayOfWeek?: string;
  exercises?: WorkoutExercise[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Food {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface Meal {
  id?: string;
  name: string;
  time: string;
  notes?: string;
  order: number;
  foods?: Food[];
}

export interface Diet {
  /** Páginas privadas; o arquivo PDF original nunca é enviado ao navegador. */
  document?: { id: string; pageCount: number };
  kind?: "diet" | "recipe";
  id?: string;
  // Vazio/ausente = dieta de biblioteca; o aluno pode ser atribuído depois
  // via edição (mecanismo existente: diets.studentId).
  studentId?: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  /** Texto livre da dieta (formato simplificado: copiar/colar). */
  content?: string;
  /** Legado: refeições estruturadas (mantido para dietas antigas). */
  meals?: Meal[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DuplicateRequest {
  newStudentId?: string;
  newName?: string;
}

// ── Programas de treino (F19) ────────────────────────────────────────────
// Um TrainingProgram é a COLEÇÃO que agrupa vários treinos. Cada item de
// `workouts` é uma REFERÊNCIA a um WorkoutDefine existente — o programa não
// duplica o conteúdo do treino. `label`/`name`/`dayOfWeek` são snapshot do
// momento do vínculo, para a listagem continuar legível se o treino mudar.

export interface ProgramWorkout {
  workoutId: string;
  order: number;
  label?: string;
  name?: string;
  dayOfWeek?: string;
}

export interface TrainingProgram {
  id?: string;
  /** vazio = programa de biblioteca (não atribuído a nenhum aluno) */
  studentId: string;
  name: string;
  description?: string;
  objective?: string;
  workouts?: ProgramWorkout[];
  /** trechos da fonte preservados verbatim (PRs, periodização, estrutura semanal) */
  notes?: string;
  /** proveniência da importação (ex.: "treino.md") */
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportProgramRequest {
  markdown: string;
  source?: string;
  name?: string;
  /** opcional: já atribui a um aluno */
  studentId?: string;
}

export interface AssignProgramRequest {
  studentId: string;
}

export const WEEK_DAYS = [
  { value: "monday", label: "Segunda" },
  { value: "tuesday", label: "Terca" },
  { value: "wednesday", label: "Quarta" },
  { value: "thursday", label: "Quinta" },
  { value: "friday", label: "Sexta" },
  { value: "saturday", label: "Sabado" },
  { value: "sunday", label: "Domingo" },
] as const;

// ── Rede social / dieta diária / ranking ──
