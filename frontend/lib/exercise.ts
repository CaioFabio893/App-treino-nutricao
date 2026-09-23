import type { Exercise, WorkoutExercise } from "./types";

// ── Conversão da biblioteca de exercícios para snapshot de treino (F5) ──
//
// O treino continua armazenando uma CÓPIA embutida (WorkoutExercise). Selecionar
// um exercício da biblioteca copia apenas os campos compartilhados (nome,
// descrição e vídeo); os campos específicos de treino (séries, repetições,
// carga, descanso) ganham os defaults do formulário manual. Depois de inserido,
// alterar/excluir o exercício da biblioteca NÃO afeta o treino existente.

export function exerciseToWorkoutExercise(ex: Exercise, order: number): WorkoutExercise {
  return {
    name: ex.name,
    description: ex.description,
    videoUrl: ex.videoUrl,
    // Defaults idênticos aos do exercício criado manualmente no WorkoutForm.
    sets: 3,
    repetitions: "10",
    weight: "",
    restSeconds: 60,
    notes: "",
    order,
  };
}
