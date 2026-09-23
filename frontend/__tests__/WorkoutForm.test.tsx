import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WorkoutForm from "@/components/WorkoutForm";
import type { Exercise, UserProfile } from "@/lib/types";

const apiMocks = vi.hoisted(() => ({
  listExercises: vi.fn(),
  getWorkout: vi.fn(),
  createWorkout: vi.fn(),
  updateWorkout: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);

const students: UserProfile[] = [{ id: "s1", name: "Ana", role: "student" }];
const getToken = async () => "token";

function renderForm() {
  return render(
    <WorkoutForm
      students={students}
      getToken={getToken}
      onDone={() => {}}
      onCancel={() => {}}
    />
  );
}

describe("WorkoutForm — biblioteca de exercícios", () => {
  it("continua aceitando entrada manual de exercício", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar exercício" }));

    const nameInput = screen.getByPlaceholderText("Ex.: Supino reto");
    fireEvent.change(nameInput, { target: { value: "Elevação lateral" } });

    expect(nameInput).toHaveValue("Elevação lateral");
  });

  it("seleciona exercício da biblioteca e copia como snapshot embutido", async () => {
    apiMocks.listExercises.mockResolvedValue([
      { id: "e1", name: "Supino reto", muscleGroup: "Peito", equipment: "Barra" } as Exercise,
    ]);
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Buscar na biblioteca" }));
    await screen.findByRole("button", { name: /Supino reto/ });
    fireEvent.click(screen.getByRole("button", { name: /Supino reto/ }));

    // A seleção copia o nome da biblioteca para o exercício embutido (snapshot).
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex.: Supino reto")).toHaveValue("Supino reto");
    });
  });
});
