export type Check = "" | "ok" | "fail";

// ── Modo original (preservado) ──

export interface SetData {
  w?: number;
  r?: number;
  c?: Check;
}

export interface ExerciseData {
  sets: SetData[];
  note?: string;
}

export interface SessionData {
  week: number;
  day: string;
  exercise: ExerciseData[];
}

export interface PRs {
  a: number;
  b: number;
  c: number;
}

export interface AppState {
  week: number;
  day: number;
}

export interface ExercisePlan {
  n: string;
  s: number;
  r: string;
  o?: string;
}

export interface CardioOption {
  op: string;
  items: string[];
}

export interface DayPlan {
  id: string;
  label: string;
  name: string;
  ex: ExercisePlan[];
  cardio?: CardioOption[];
}

export interface Phase {
  pct: number;
  label: string;
}

// ── Novos tipos: gestão ──

export type Role = "admin" | "nutritionist" | "student";

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  role: Role;
  nutritionistID?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  createdAt?: string;
  needsProfile?: boolean;
}

export interface WorkoutExercise {
  id?: string;
  name: string;
  description?: string;
  sets: number;
  repetitions: string;
  weight?: string;
  restSeconds?: number;
  notes?: string;
  order: number;
}

export interface WorkoutDefine {
  id?: string;
  studentId: string;
  nutritionistId: string;
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
  studentId: string;
  nutritionistId: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
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
  nutritionistId: string;
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
