import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExercisesPage from "@/app/nutritionist/exercises/page";
import type { Exercise } from "@/lib/types";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: async () => "token" }),
}));

const apiMocks = vi.hoisted(() => ({
  listExercises: vi.fn(),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
  deleteExercise: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);

const exA: Exercise = { id: "e1", name: "Supino reto", muscleGroup: "Peito", equipment: "Barra" };
const exB: Exercise = { id: "e2", name: "Agachamento livre", muscleGroup: "Pernas", equipment: "Barra" };

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.listExercises.mockResolvedValue([exA, exB]);
});

describe("ExercisesPage — biblioteca de exercícios", () => {
  it("lista os exercícios da biblioteca", async () => {
    render(<ExercisesPage />);
    // A listagem é responsiva (cards + tabela): o mesmo nome aparece em ambos.
    expect((await screen.findAllByText("Supino reto")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Agachamento livre").length).toBeGreaterThan(0);
    expect(apiMocks.listExercises).toHaveBeenCalledWith("token");
  });

  it("busca por nome/grupo muscular", async () => {
    render(<ExercisesPage />);
    await screen.findAllByText("Supino reto");

    fireEvent.change(screen.getByPlaceholderText("Buscar por nome, grupo muscular ou equipamento…"), {
      target: { value: "pernas" },
    });

    await waitFor(() => {
      expect(screen.queryAllByText("Supino reto")).toHaveLength(0);
    });
    expect(screen.getAllByText("Agachamento livre").length).toBeGreaterThan(0);
  });

  it("cria um exercício novo", async () => {
    apiMocks.createExercise.mockResolvedValue({ id: "e3", name: "Crucifixo" });
    render(<ExercisesPage />);
    await screen.findAllByText("Supino reto");

    fireEvent.click(screen.getByRole("button", { name: "+ Novo exercício" }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: Supino reto"), {
      target: { value: "Crucifixo" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex.: Peito"), {
      target: { value: "Peito" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar exercício" }));

    await waitFor(() => {
      expect(apiMocks.createExercise).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Crucifixo", muscleGroup: "Peito" }),
        "token"
      );
    });
  });

  it("edita um exercício existente", async () => {
    apiMocks.updateExercise.mockResolvedValue(undefined);
    render(<ExercisesPage />);
    await screen.findAllByText("Supino reto");

    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const input = screen.getByPlaceholderText("Ex.: Supino reto");
    expect(input).toHaveValue("Supino reto");

    fireEvent.change(input, { target: { value: "Supino inclinado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar exercício" }));

    await waitFor(() => {
      expect(apiMocks.updateExercise).toHaveBeenCalledWith(
        "e1",
        expect.objectContaining({ name: "Supino inclinado" }),
        "token"
      );
    });
  });

  it("exclui um exercício (com confirmação)", async () => {
    apiMocks.deleteExercise.mockResolvedValue(undefined);
    render(<ExercisesPage />);
    await screen.findAllByText("Supino reto");

    fireEvent.click(screen.getAllByRole("button", { name: "Excluir" })[0]);
    expect(screen.getByText("Excluir exercício")).toBeInTheDocument();

    // O botão de confirmação do modal é o último "Excluir" renderizado.
    const buttons = screen.getAllByRole("button", { name: "Excluir" });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(apiMocks.deleteExercise).toHaveBeenCalledWith("e1", "token");
    });
  });
});
