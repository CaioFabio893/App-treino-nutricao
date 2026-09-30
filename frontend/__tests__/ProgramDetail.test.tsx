import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProgramDetail from "@/components/programs/ProgramDetail";

const getToken = vi.fn(async () => "token");

let programs: unknown[] = [];
let workouts: unknown[] = [];

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken, role: "nutritionist", profile: { id: "demo-user", role: "nutritionist" } }),
}));

vi.mock("@/lib/api", () => ({
  getProgram: vi.fn(async (id: string) => {
    const p = programs.find((x) => (x as { id: string }).id === id);
    if (!p) throw new Error("programa nao encontrado");
    return p;
  }),
  getWorkout: vi.fn(async (id: string) => {
    const w = workouts.find((x) => (x as { id: string }).id === id);
    if (!w) throw new Error("treino nao encontrado");
    return w;
  }),
}));

const PROGRAMA = {
  id: "p1",
  studentId: "student-joao",
  nutritionistId: "demo-user",
  name: "Louise Lima (Ciclo 2)",
  objective: "Hipertrofia de inferiores",
  workouts: [
    { workoutId: "w1", order: 1, label: "A", name: "Treino A", dayOfWeek: "monday" },
    { workoutId: "w2", order: 2, label: "B", name: "Treino B", dayOfWeek: "tuesday" },
  ],
  notes: "Sem 1-2: 70% · Sem 7: Deload 70%",
};

const TREINOS = [
  {
    id: "w1",
    studentId: "student-joao",
    nutritionistId: "demo-user",
    name: "Treino A — Pernas",
    dayOfWeek: "monday",
    description: "Cardio Final (circuito)",
    exercises: [
      { name: "Agachamento Livre com Barra", sets: 4, repetitions: "6-8", weight: "", order: 1, notes: "Foco em força" },
      { name: "Hack Squat", sets: 4, repetitions: "10", weight: "", order: 2, notes: "" },
    ],
  },
  {
    id: "w2",
    studentId: "student-joao",
    nutritionistId: "demo-user",
    name: "Treino B — Costas",
    dayOfWeek: "tuesday",
    exercises: [{ name: "Puxada Alta Pronada", sets: 4, repetitions: "8-10", weight: "", order: 1, notes: "" }],
  },
];

beforeEach(() => {
  programs = [PROGRAMA];
  workouts = [...TREINOS];
  getToken.mockClear();
});

describe("ProgramDetail — programa do nutricionista", () => {
  it("mostra nome, objetivo e o total consolidado de exercícios e séries", async () => {
    render(<ProgramDetail programId="p1" backHref="/admin/programs" backLabel="Programas" />);

    expect(await screen.findByRole("heading", { name: "Louise Lima (Ciclo 2)" })).toBeInTheDocument();
    expect(screen.getByText("Hipertrofia de inferiores")).toBeInTheDocument();
    // 2 treinos · 3 exercícios · 12 séries (4+4 no treino A, 4 no B)
    // A linha é montada com nós de texto separados, por isso o matcher flexível.
    const resumo = screen
      .getAllByText((_, el) => el?.className === "page-sub")
      .map((el) => el.textContent)
      .find((t) => t?.includes("treino"));
    expect(resumo).toMatch(/2 treino\(s\) · 3 exercícios · 12 séries/);
  });

  it("renderiza os treinos na ordem do programa com o rótulo da fonte", async () => {
    render(<ProgramDetail programId="p1" backHref="/admin/programs" backLabel="Programas" />);

    expect(await screen.findByText(/A · Treino A — Pernas/)).toBeInTheDocument();
    expect(screen.getByText(/B · Treino B — Costas/)).toBeInTheDocument();

    // os dois treinos aparecem, na ordem A -> B
    const titulos = screen.getAllByText(/Treino [AB] —/);
    expect(titulos[0].textContent).toMatch(/^A/);
    expect(titulos[1].textContent).toMatch(/^B/);
  });

  it("detalha os exercícios do treino carregado da referência", async () => {
    render(<ProgramDetail programId="p1" backHref="/admin/programs" backLabel="Programas" />);

    expect(await screen.findByText("Agachamento Livre com Barra")).toBeInTheDocument();
    expect(screen.getByText("Hack Squat")).toBeInTheDocument();
    expect(screen.getByText("Puxada Alta Pronada")).toBeInTheDocument();
    expect(screen.getByText("Foco em força")).toBeInTheDocument();
    // carga inexistente na fonte fica como "—", nunca inventada
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("mostra as notas preservadas da fonte", async () => {
    render(<ProgramDetail programId="p1" backHref="/admin/programs" backLabel="Programas" />);
    expect(await screen.findByText(/Sem 1-2: 70%/)).toBeInTheDocument();
  });

  it("oferece ações de escrita para o nutricionista", async () => {
    render(<ProgramDetail programId="p1" backHref="/admin/programs" backLabel="Programas" />);
    expect(await screen.findByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      "/admin/programs?edit=p1"
    );
  });

  it("avisa e ignora treino que sumiu, sem quebrar a lista", async () => {
    workouts = [TREINOS[0]];
    render(<ProgramDetail programId="p1" backHref="/admin/programs" backLabel="Programas" />);

    expect(await screen.findByText(/1 treino\(s\) deste programa não foram encontrados/)).toBeInTheDocument();
    expect(screen.getByText(/A · Treino A — Pernas/)).toBeInTheDocument();
    expect(screen.getByText("Treino indisponível.")).toBeInTheDocument();
  });

  it("mostra estado vazio quando o programa não tem treinos", async () => {
    programs = [{ ...PROGRAMA, workouts: [] }];
    render(<ProgramDetail programId="p1" backHref="/admin/programs" backLabel="Programas" />);
    expect(await screen.findByText(/ainda não tem treinos/)).toBeInTheDocument();
  });

  it("mostra erro recuperável quando o programa não existe", async () => {
    render(<ProgramDetail programId="inexistente" backHref="/admin/programs" backLabel="Programas" />);
    // A mensagem vem do erro real da API ("programa nao encontrado"),
    // e o que importa aqui é que exista o alerta com saída de recuperação —
    // não um estado vazio enganoso.
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/nao encontrado/i);
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});

describe("ProgramDetail — visão do aluno (read-only)", () => {
  it("esconde as ações de escrita", async () => {
    render(
      <ProgramDetail programId="p1" readOnly backHref="/programas" backLabel="Seu programa" />
    );
    await screen.findByRole("heading", { name: "Louise Lima (Ciclo 2)" });
    expect(screen.queryByRole("link", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Imprimir" })).not.toBeInTheDocument();
  });

  it("mostra os mesmos exercícios, só que somente leitura", async () => {
    render(<ProgramDetail programId="p1" readOnly backHref="/programas" backLabel="Seu programa" />);
    expect(await screen.findByText("Agachamento Livre com Barra")).toBeInTheDocument();
    expect(screen.getByText("Hack Squat")).toBeInTheDocument();
  });
});
