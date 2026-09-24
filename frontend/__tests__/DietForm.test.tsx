import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DietForm from "@/components/DietForm";
import type { UserProfile } from "@/lib/types";

const students: UserProfile[] = [{ id: "s1", name: "Ana", role: "student" }];
const getToken = async () => "token";

function renderForm() {
  return render(
    <DietForm
      students={students}
      getToken={getToken}
      onDone={() => {}}
      onCancel={() => {}}
    />
  );
}

describe("DietForm — acessibilidade", () => {
  it("associa cada label ao seu input via htmlFor/id", () => {
    renderForm();

    expect(screen.getByLabelText("Nome da dieta")).toHaveAttribute("id", "diet-name");
    expect(screen.getByLabelText("Aluno")).toHaveAttribute("id", "diet-student");
    expect(screen.getByLabelText("Data de início")).toHaveAttribute("id", "diet-start");
    expect(screen.getByLabelText("Data de término")).toHaveAttribute("id", "diet-end");
    expect(screen.getByLabelText(/Plano alimentar/)).toHaveAttribute("id", "diet-content");
  });

  it("marca erro de intervalo de datas como alert e liga aria-invalid/aria-describedby", () => {
    renderForm();

    const start = screen.getByLabelText("Data de início");
    const end = screen.getByLabelText("Data de término");

    fireEvent.change(start, { target: { value: "2026-10-20" } });
    fireEvent.change(end, { target: { value: "2026-10-01" } });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("não pode ser posterior");
    expect(alert).toHaveAttribute("aria-live", "polite");

    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(start).toHaveAttribute("aria-describedby", "diet-range-error");
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveAttribute("aria-describedby", "diet-range-error");
  });
});
