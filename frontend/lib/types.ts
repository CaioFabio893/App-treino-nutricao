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
  bio?: string;
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
  videoUrl?: string;
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
  workoutName?: string;
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
  caption?: string;
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
  nutritionistId?: string;
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
