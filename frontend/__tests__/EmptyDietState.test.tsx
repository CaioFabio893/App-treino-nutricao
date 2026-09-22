import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyDietState } from "@/components/EmptyDietState";

describe("EmptyDietState — estado vazio da tela de dietas", () => {
  it("mostra título e texto de orientação", () => {
    render(<EmptyDietState />);
    expect(screen.getByText("Nenhuma dieta cadastrada")).toBeInTheDocument();
    expect(screen.getByText(/Adicione uma refeição ou plano alimentar/i)).toBeInTheDocument();
  });

  it("sem callback de ação não renderiza o botão de cadastro", () => {
    render(<EmptyDietState />);
    expect(screen.queryByRole("button", { name: /Cadastrar Dieta/i })).not.toBeInTheDocument();
  });

  it("com callback, clicar aciona a ação", async () => {
    const onAction = vi.fn();
    render(<EmptyDietState onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: /Cadastrar Dieta/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});