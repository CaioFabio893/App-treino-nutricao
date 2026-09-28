"use client";

// Rótulos de dia da semana em PT-BR, curtos (cards/tabelas) e completos
// (detalhe). Fonte única: evita "Seg"/"Segunda" divergindo entre telas.
export const PROGRAM_DAY_SHORT: Record<string, string> = {
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
  sunday: "Dom",
};

export const PROGRAM_DAY_FULL: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

export function dayLabel(day?: string): string {
  if (!day) return "—";
  return PROGRAM_DAY_SHORT[day] ?? day;
}

/**
 * Total de exercícios do programa — usado nos cards e no detalhe.
 * `counts` mapeia workoutId → nº de exercícios carregados; ids sem entrada
 * contam como 0 para não inflar o número enquanto os treinos carregam.
 */
export function programExerciseCount(
  refs: { workoutId: string }[] | undefined,
  counts: Record<string, number>
): number {
  if (!refs?.length) return 0;
  return refs.reduce((acc, r) => acc + (counts[r.workoutId] ?? 0), 0);
}
