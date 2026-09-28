import { beforeEach, describe, expect, it, vi } from "vitest";

// Modo demo: a API é simulada em localStorage, sem rede.
vi.mock("@/lib/config", () => ({ DEMO_MODE: true }));

import * as api from "@/lib/api";
import type { TrainingProgram, WorkoutDefine } from "@/lib/types";

const NUTRI = "demo:nutritionist";
// O modo demo tem UMA identidade de aluno (demoMe só conhece "student-joao");
// qualquer outro id de token cai no nutricionista. Por isso os testes de
// escopo de aluno usam sempre ALUNO.
const ALUNO = "demo:student-joao";

const PROGRAMS_KEY = "ll_demo_programs";
const WORKOUTS_KEY = "ll_demo_workouts";

function setPrograms(p: TrainingProgram[]) {
  localStorage.setItem(PROGRAMS_KEY, JSON.stringify(p));
}
function getPrograms(): TrainingProgram[] {
  return JSON.parse(localStorage.getItem(PROGRAMS_KEY) || "[]");
}
function setWorkouts(w: WorkoutDefine[]) {
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(w));
}
function getWorkouts(): WorkoutDefine[] {
  return JSON.parse(localStorage.getItem(WORKOUTS_KEY) || "[]");
}

/** Programa de biblioteca com dois treinos que existem em workouts. */
function biblioteca(): TrainingProgram {
  return {
    id: "p1",
    studentId: "",
    nutritionistId: "demo-user",
    name: "Ciclo 2",
    objective: "Hipertrofia",
    workouts: [
      { workoutId: "w1", order: 1, label: "A", name: "Treino A", dayOfWeek: "monday" },
      { workoutId: "w2", order: 2, label: "B", name: "Treino B", dayOfWeek: "tuesday" },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
  setPrograms([biblioteca()]);
  setWorkouts([
    {
      id: "w1",
      studentId: "",
      nutritionistId: "demo-user",
      name: "Treino A",
      dayOfWeek: "monday",
      exercises: [{ name: "Agachamento", sets: 4, repetitions: "6-8", order: 1 }],
    },
    {
      id: "w2",
      studentId: "",
      nutritionistId: "demo-user",
      name: "Treino B",
      dayOfWeek: "tuesday",
      exercises: [
        { name: "Puxada", sets: 4, repetitions: "8-10", order: 1 },
        { name: "Remada", sets: 3, repetitions: "12", order: 2 },
      ],
    },
  ]);
});

describe("api de programas — escopo por papel", () => {
  it("nutricionista vê a biblioteca inteira", async () => {
    const list = await api.listPrograms(NUTRI);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Ciclo 2");
  });

  it("aluno não vê programa de biblioteca (sem studentId)", async () => {
    expect(await api.listPrograms(ALUNO)).toHaveLength(0);
  });

  it("aluno vê apenas o programa atribuído a ele", async () => {
    setPrograms([
      { ...biblioteca(), id: "p-meu", studentId: "student-joao" },
      { ...biblioteca(), id: "p-outro", studentId: "student-maria" },
    ]);
    const list = await api.listPrograms(ALUNO);
    expect(list.map((p) => p.id)).toEqual(["p-meu"]);
  });

  it("getProgram de programa de outro aluno rejeita para o aluno", async () => {
    setPrograms([{ ...biblioteca(), studentId: "student-maria" }]);
    await expect(api.getProgram("p1", ALUNO)).rejects.toThrow();
  });
});

describe("api de programas — CRUD", () => {
  it("createProgram gera id e createdAt", async () => {
    const created = await api.createProgram(
      { studentId: "", nutritionistId: "demo-user", name: "Novo" },
      NUTRI
    );
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();
    expect(getPrograms()).toHaveLength(2);
  });

  it("updateProgram preserva id, studentId e createdAt", async () => {
    await api.updateProgram(
      "p1",
      {
        // o cliente tentaria forçar id/aluno/criação: o store ignora
        id: "hackeado",
        studentId: "student-maria",
        nutritionistId: "demo-user",
        name: "Ciclo 2 (editado)",
        workouts: [],
        notes: "nota",
      },
      NUTRI
    );
    const p = getPrograms()[0];
    expect(p.id).toBe("p1");
    expect(p.studentId).toBe("");
    expect(p.name).toBe("Ciclo 2 (editado)");
    expect(p.createdAt).toBeUndefined();
  });

  it("updateProgram de id inexistente rejeita", async () => {
    await expect(
      api.updateProgram("nao-existe", { studentId: "", nutritionistId: "d", name: "x" }, NUTRI)
    ).rejects.toThrow();
  });

  it("deleteProgram remove o programa mas preserva os treinos", async () => {
    await api.deleteProgram("p1", NUTRI);
    expect(getPrograms()).toHaveLength(0);
    expect(getWorkouts().map((w) => w.id)).toEqual(["w1", "w2"]);
  });
});

describe("api de programas — atribuição materializa cópias", () => {
  it("assignProgram copia os treinos para o aluno e repassa as referências", async () => {
    const updated = await api.assignProgram("p1", "student-joao", NUTRI);

    expect(updated.studentId).toBe("student-joao");
    expect(updated.workouts).toHaveLength(2);

    const copias = getWorkouts().filter((w) => w.studentId === "student-joao");
    expect(copias).toHaveLength(2);
    // originais intactos na biblioteca
    expect(getWorkouts().filter((w) => w.studentId === "")).toHaveLength(2);

    // as referências apontam para as cópias, não para os originais
    for (const ref of updated.workouts ?? []) {
      expect(["w1", "w2"]).not.toContain(ref.workoutId);
      expect(copias.map((c) => c.id)).toContain(ref.workoutId);
    }
    // snapshot de nome/dia preservado no vínculo
    expect(updated.workouts?.[0].label).toBe("A");
    expect(updated.workouts?.[0].dayOfWeek).toBe("monday");
  });

  it("assignProgram é idempotente para o mesmo aluno", async () => {
    await api.assignProgram("p1", "student-joao", NUTRI);
    const antes = getWorkouts().length;
    await api.assignProgram("p1", "student-joao", NUTRI);
    expect(getWorkouts()).toHaveLength(antes);
  });

  it("assignProgram recusa reatribuir a outro aluno", async () => {
    await api.assignProgram("p1", "student-joao", NUTRI);
    await expect(api.assignProgram("p1", "student-maria", NUTRI)).rejects.toThrow(
      /ja atribuido/
    );
  });

  it("assignProgram exige aluno", async () => {
    await expect(api.assignProgram("p1", "", NUTRI)).rejects.toThrow();
  });

  it("assignProgram falha se um treino do programa não existe", async () => {
    setWorkouts([{ id: "w1", studentId: "", nutritionistId: "d", name: "A" }]);
    await expect(api.assignProgram("p1", "student-joao", NUTRI)).rejects.toThrow();
  });

  it("depois de atribuir, o aluno enxerga o programa", async () => {
    await api.assignProgram("p1", "student-joao", NUTRI);
    const list = await api.listPrograms(ALUNO);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("p1");
  });
});

describe("api de programas — duplicação", () => {
  it("duplicateProgram clona como biblioteca com novo id e cópias de treino", async () => {
    const clone = await api.duplicateProgram("p1", {}, NUTRI);
    expect(clone.id).not.toBe("p1");
    expect(clone.name).toBe("Ciclo 2 (copia)");
    expect(clone.studentId).toBe("");
    expect(clone.workouts).toHaveLength(2);
    // 2 originais + 2 cópias de biblioteca
    expect(getWorkouts()).toHaveLength(4);
    expect(getWorkouts().every((w) => w.studentId === "")).toBe(true);
  });

  it("duplicateProgram aceita nome customizado", async () => {
    const clone = await api.duplicateProgram("p1", { newName: "Intermediário" }, NUTRI);
    expect(clone.name).toBe("Intermediário");
  });
});

describe("api de programas — importação de markdown", () => {
  const MD = `# Programa de Treino — Louise Lima (Ciclo 2)

**Foco: Hipertrofia de Inferiores**

---

## TREINO A — Pernas (Quadríceps)

| # | Exercício | Séries | Reps | Observação |
|---|---|---:|---:|---|
| 1 | Agachamento Livre com Barra | 4 | 6-8 | Foco em força/carga |
| 2 | Hack Squat | 4 | 10 | Amplitude total |

---

## TREINO B — Costas/Bíceps

| # | Exercício | Séries | Reps | Observação |
|---|---|---:|---:|---|
| 1 | Puxada Alta Pronada | 4 | 8-10 | |

**🔥 Cardio Final (circuito — 3 opções):**

- Subida de escada — 2 min

---

## Estrutura semanal

| Dia | Treino | Foco |
|---|---|---|
| 1 | A | Pernas |
`;

  it("cria um treino por seção e resolve as referências", async () => {
    const p = await api.importProgram({ markdown: MD, source: "treino.md" }, NUTRI);

    expect(p.name).toBe("Programa de Treino — Louise Lima (Ciclo 2)");
    expect(p.objective).toBe("Hipertrofia de Inferiores");
    expect(p.source).toBe("treino.md");
    expect(p.workouts).toHaveLength(2);

    // 2 treinos da biblioteca (beforeEach) + 2 criados pela importação
    const criados = getWorkouts().filter((w) => !["w1", "w2"].includes(w.id ?? ""));
    expect(criados).toHaveLength(2);
    for (const ref of p.workouts ?? []) expect(criados.map((w) => w.id)).toContain(ref.workoutId);
  });

  it("converte séries/reps e numera os exercícios na ordem da fonte", async () => {
    await api.importProgram({ markdown: MD }, NUTRI);
    const treinoA = getWorkouts().find((w) => w.name?.includes("Pernas"));
    expect(treinoA?.exercises).toHaveLength(2);
    expect(treinoA?.exercises?.[0]).toMatchObject({
      name: "Agachamento Livre com Barra",
      sets: 4,
      repetitions: "6-8",
      notes: "Foco em força/carga",
      order: 1,
    });
    expect(treinoA?.exercises?.[1].order).toBe(2);
  });

  it("preserva o cardio na descrição em vez de virar exercício", async () => {
    await api.importProgram({ markdown: MD }, NUTRI);
    const treinoB = getWorkouts().find((w) => w.name?.includes("Costas"));
    expect(treinoB?.exercises).toHaveLength(1);
    expect(treinoB?.description).toMatch(/Cardio Final/);
  });

  it("leva estrutura semanal/PRs para as notas do programa", async () => {
    const p = await api.importProgram({ markdown: MD }, NUTRI);
    expect(p.notes).toMatch(/Estrutura semanal/);
  });

  it("atribui a um aluno quando studentId vem no pedido", async () => {
    const p = await api.importProgram({ markdown: MD, studentId: "student-joao" }, NUTRI);
    expect(p.studentId).toBe("student-joao");
    const atribuidos = getWorkouts().filter((w) => w.studentId === "student-joao");
    // os 2 da biblioteca + os 2 importados
    expect(atribuidos).toHaveLength(2);
    const list = await api.listPrograms(ALUNO);
    expect(list.map((x) => x.id)).toContain(p.id);
  });

  it("rejeita markdown vazio", async () => {
    await expect(api.importProgram({ markdown: "   " }, NUTRI)).rejects.toThrow();
  });

  it("rejeita markdown sem nenhuma seção de treino", async () => {
    await expect(
      api.importProgram({ markdown: "# Só um título\n\nsem treinos aqui" }, NUTRI)
    ).rejects.toThrow(/nenhum treino/i);
  });
});
