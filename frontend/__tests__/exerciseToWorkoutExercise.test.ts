import { describe, it, expect } from "vitest";
import { exerciseToWorkoutExercise } from "@/lib/exercise";
import type { Exercise } from "@/lib/types";

// Teste OBRIGATÓRIO da F5: a biblioteca vira um SNAPSHOT copiado no treino.
// Alterar/excluir o exercício da biblioteca NÃO pode afetar o treino existente.
describe("exerciseToWorkoutExercise — snapshot da biblioteca", () => {
  it("copia os campos compartilhados da biblioteca para o WorkoutExercise", () => {
    const ex: Exercise = {
      id: "ex1",
      name: "Supino reto",
      description: "Básico de peito",
      muscleGroup: "Peito",
      equipment: "Barra",
      videoUrl: "https://youtu.be/x",
    };
    const we = exerciseToWorkoutExercise(ex, 2);

    expect(we.name).toBe("Supino reto");
    expect(we.description).toBe("Básico de peito");
    expect(we.videoUrl).toBe("https://youtu.be/x");
    expect(we.order).toBe(2);
    // Campos específicos de treino ganham os defaults do formulário manual.
    expect(we.sets).toBe(3);
    expect(we.repetitions).toBe("10");
    expect(we.restSeconds).toBe(60);
  });

  it("é um SNAPSHOT: alterar a biblioteca depois NÃO muda o treino", () => {
    const ex: Exercise = { id: "ex1", name: "Supino reto", description: "original" };
    const we = exerciseToWorkoutExercise(ex, 1);

    // Alteração posterior no exercício da biblioteca…
    ex.name = "Supino inclinado";
    ex.description = "alterado";

    // …não afeta o snapshot copiado no treino.
    expect(we.name).toBe("Supino reto");
    expect(we.description).toBe("original");
  });

  it("não guarda referência viva ao objeto da biblioteca", () => {
    const ex: Exercise = { id: "ex1", name: "Agachamento" };
    const we = exerciseToWorkoutExercise(ex, 1);

    ex.name = "Mudou";

    expect(we.name).toBe("Agachamento");
  });

  it("excluir da biblioteca não quebra o treino (snapshot é autônomo)", () => {
    // Simula: seleciona o exercício, depois a biblioteca "remove" o item.
    const library: Exercise[] = [{ id: "ex1", name: "Remada curvada" }];
    const we = exerciseToWorkoutExercise(library[0], 1);
    library.splice(0, 1); // exclusão na biblioteca

    expect(we.name).toBe("Remada curvada");
    expect(library).toHaveLength(0);
  });
});
