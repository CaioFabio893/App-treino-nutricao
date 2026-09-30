export type Check = "" | "ok" | "fail";

// ── Novos tipos: gestão ──

// Modelo de 2 papéis: quem administra a plataforma e quem consome. Aprovação e
// pausa são eixos SEPARADOS (ver Status) — pausar não torna o cadastro
// "não aprovado", e nenhuma regra deve tratar os dois como sinônimos.
export type Role = "admin" | "student";

/** Situação do cadastro: pendente de aprovação, ativo, pausado, inativo ou recusado. */
export type Status = "pending_approval" | "active" | "paused" | "inactive" | "rejected";

/** Funcionalidades que um plano pode liberar para o aluno. */
export type Feature = "workouts" | "diet" | "community" | "ranking";

/** Catálogo de features para o CRUD de planos do admin (checkboxes). */
export const FEATURES: { value: Feature; label: string; desc: string }[] = [
  { value: "workouts", label: "Treinos", desc: "Treinos e histórico (tier gratuito)" },
  { value: "diet", label: "Dietas", desc: "Planos alimentares e dieta diária" },
  { value: "community", label: "Comunidade", desc: "Feed social com outros alunos" },
  { value: "ranking", label: "Ranking", desc: "Ranking e perfil público pontuado" },
];

/**
 * Plano = pacote de features snapshotado no perfil no momento da atribuição.
 * O backend aplica o gate pelas features; a UI só esconde por UX.
 */
export interface Plan {
  id?: string;
  name: string;
  description?: string;
  features: Feature[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  bio?: string;
  role: Role;
  startDate?: string;
  endDate?: string;
  status?: Status;
  /** Snapshot das features do plano atribuído pelo admin. */
  features?: Feature[];
  planID?: string;
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
  planID?: string;
}

export interface RejectUserRequest {
  reason?: string;
}

export interface AssignPlanRequest {
  planID: string;
}

export interface WorkoutExercise {
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

export interface HistorySet {
  weight?: string;
  reps?: string;
  done: boolean;
}

export interface HistoryExercise {
  name: string;
  order: number;
  sets?: HistorySet[];
  note?: string;
}

export interface WorkoutHistoryEntry {
  id?: string;
  studentId: string;
  workoutId: string;
  workoutName?: string;
  completedAt?: string;
  duration?: number;
  exercisesCompleted: number;
  totalExercises: number;
  exercises?: HistoryExercise[];
}

export interface DuplicateRequest {
  newStudentId?: string;
  newName?: string;
}

export interface CompleteWorkoutRequest {
  workoutId: string;
  duration: number;
  exercisesCompleted: number;
  totalExercises: number;
  exercises?: HistoryExercise[];
  caption?: string;
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

export type PostType = "workout" | "diet" | "manual";

export interface PostComment {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  text: string;
  createdAt?: string;
  deleted?: boolean;
  moderatedBy?: string;
  moderatedAt?: string;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  type: PostType;
  text: string;
  workoutId?: string;
  workoutName?: string;
  dietId?: string;
  dietName?: string;
  date: string;
  likes?: Record<string, boolean>;
  likeCount?: number;
  comments?: PostComment[];
  deleted?: boolean;
  moderatedBy?: string;
  moderatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePostRequest {
  type: PostType;
  text: string;
}

export interface CommentRequest {
  text: string;
}

export interface PostsPage {
  posts: Post[];
  nextCursor?: string;
}

export type DietLogStatus = "followed" | "partial" | "not_followed";

export interface MealCheck {
  mealId?: string;
  mealName?: string;
  followed: boolean;
  note?: string;
}

export interface DietDailyLog {
  id?: string;
  studentId: string;
  dietId?: string;
  dietName?: string;
  date: string;
  status: DietLogStatus;
  mealChecks?: MealCheck[];
  note?: string;
  caption?: string;
  postId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertDietLogRequest {
  studentId?: string;
  date: string;
  status?: DietLogStatus;
  mealChecks?: MealCheck[];
  note?: string;
  caption?: string;
}

export interface ScoreRecord {
  studentId: string;
  rawPoints: number;
  cycleId: string;
  cycleStart?: string;
  score: number;
  daysElapsed: number;
  daysCompleted: number;
}

export interface ScoreHistoryEntry {
  studentId: string;
  cycleId: string;
  startDate?: string;
  endDate?: string;
  rawPoints: number;
  days: number;
  score: number;
}

export interface RankingEntry {
  studentId: string;
  name: string;
  photoURL?: string;
  score: number;
  rank: number;
}

export interface RankingResponse {
  cycleId: string;
  cycleStart?: string;
  cycleEnd?: string;
  top: RankingEntry[];
  total: number;
  self?: RankingEntry;
  full?: RankingEntry[];
}

export interface PublicProfile {
  id: string;
  name: string;
  photoURL?: string;
  bio?: string;
  role: Role;
  streak?: number;
  score?: number;
  cycleId?: string;
  rank?: number;
}
