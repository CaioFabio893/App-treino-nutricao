export type Check = "" | "ok" | "fail";

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