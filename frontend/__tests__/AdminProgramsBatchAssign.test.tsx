import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgramsPage from "@/app/admin/programs/page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getToken: vi.fn(async () => "tok"),
  listPrograms: vi.fn(),
  listStudents: vi.fn(),
  listWorkouts: vi.fn(),
  duplicateProgram: vi.fn(),
  assignProgram: vi.fn(),
  deleteProgram: vi.fn(),
  friendlyError: (e: unknown) => String(e),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ getToken: mocks.getToken }) }));
vi.mock("@/lib/api", () => ({
  listPrograms: mocks.listPrograms,
  listStudents: mocks.listStudents,
  listWorkouts: mocks.listWorkouts,
  duplicateProgram: mocks.duplicateProgram,
  assignProgram: mocks.assignProgram,
  deleteProgram: mocks.deleteProgram,
  friendlyError: mocks.friendlyError,
}));

const program = { id: "p1", name: "Treino Feminino", studentId: "", workouts: [] };
const students = [
  { id: "s1", name: "Ana", email: "ana@x" },
  { id: "s2", name: "Bia", email: "bia@x" },
];

beforeEach(() => {
  mocks.push.mockClear();
  mocks.duplicateProgram.mockReset();
  mocks.assignProgram.mockReset();
  mocks.listPrograms.mockResolvedValue([program]);
  mocks.listStudents.mockResolvedValue(students);
  mocks.listWorkouts.mockResolvedValue([]);
  mocks.duplicateProgram.mockImplementation(async (_id: string, opts: { newName?: string }) => ({
    id: `clone-${mocks.duplicateProgram.mock.calls.length}`,
    name: opts?.newName,
  }));
});

async function openPicker() {
  // A listagem renderiza cards e tabela; ambos trazem o gatilho de associacao.
  const triggers = await screen.findAllByRole("button", { name: /Associar a .* alunos/ });
  await userEvent.click(triggers[0]);
}

describe("Programas - associacao em lote", () => {
  it("duplica uma vez por aluno e associa todos (modelo original preservado)", async () => {
    mocks.assignProgram.mockResolvedValue(undefined);
    render(<ProgramsPage />);
    await screen.findAllByText("Treino Feminino");

    await openPicker();
    await userEvent.click(screen.getByRole("checkbox", { name: /Ana/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Bia/ }));
    await userEvent.click(screen.getByRole("button", { name: /Associar a 2 aluno/ }));

    await waitFor(() => expect(mocks.assignProgram).toHaveBeenCalledTimes(2));
    expect(mocks.duplicateProgram).toHaveBeenCalledTimes(2);
    expect(mocks.duplicateProgram).toHaveBeenCalledWith("p1", { newName: "Treino Feminino" }, "tok");
    // Cada aluno recebe a SUA copia.
    expect(mocks.assignProgram.mock.calls.map((c) => c[1])).toEqual(["s1", "s2"]);
  });

  it("em falha parcial, mantem so o aluno que falhou e nao duplica de novo no retry", async () => {
    let assignCalls = 0;
    mocks.assignProgram.mockImplementation(async () => {
      assignCalls++;
      if (assignCalls === 2) throw new Error("falha na associacao");
    });
    render(<ProgramsPage />);
    await screen.findAllByText("Treino Feminino");

    await openPicker();
    await userEvent.click(screen.getByRole("checkbox", { name: /Ana/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Bia/ }));
    await userEvent.click(screen.getByRole("button", { name: /Associar a 2 aluno/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/1 associa..o\(.es\) pendentes/);
    expect(mocks.duplicateProgram).toHaveBeenCalledTimes(2);

    // Retry: so Bia esta selecionada; a copia dela ja existe (pending) -> nao duplica de novo.
    await userEvent.click(screen.getByRole("button", { name: /Associar a 1 aluno/ }));
    await waitFor(() => expect(mocks.assignProgram).toHaveBeenCalledTimes(3));
    expect(mocks.duplicateProgram).toHaveBeenCalledTimes(2);
  });
});
