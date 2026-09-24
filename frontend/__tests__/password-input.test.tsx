import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordInput from "@/components/PasswordInput";

/** Harness controlado como as páginas usam (value + onChange com estado). */
function Controlled({ id = "pwd" }: { id?: string }) {
  const [v, setV] = useState("");
  return <PasswordInput id={id} value={v} onChange={setV} placeholder="••••••" />;
}

describe("PasswordInput — mostrar/ocultar senha (acessível)", () => {
  it("renderiza input do tipo password com botão real de mostrar senha", () => {
    render(<PasswordInput id="pwd" value="" onChange={() => {}} />);
    const input = document.getElementById("pwd") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "password");
    const toggle = screen.getByRole("button", { name: "Mostrar senha" });
    expect(toggle).toHaveAttribute("type", "button");
  });

  it("alterna para texto e atualiza o aria-label quando clicado", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const byId = document.getElementById("pwd") as HTMLInputElement;
    expect(byId).toHaveAttribute("type", "password");

    const show = screen.getByRole("button", { name: "Mostrar senha" });
    await user.click(show);
    expect(byId).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(byId).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
  });

  it("mantém o estado de visibilidade independente entre instâncias", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <PasswordInput id="senha" value="" onChange={() => {}} />
        <PasswordInput id="confirmar" value="" onChange={() => {}} />
      </div>
    );
    const senha = document.getElementById("senha") as HTMLInputElement;
    const confirmar = document.getElementById("confirmar") as HTMLInputElement;

    // 1) Abre só a senha — confirmação continua oculta.
    await user.click(screen.getAllByRole("button", { name: "Mostrar senha" })[0]);
    expect(senha).toHaveAttribute("type", "text");
    expect(confirmar).toHaveAttribute("type", "password");

    // 2) O botão restante é da confirmação: abre apenas ela.
    await user.click(screen.getAllByRole("button", { name: "Mostrar senha" })[0]);
    expect(confirmar).toHaveAttribute("type", "text");
    expect(senha).toHaveAttribute("type", "text");

    // 3) Fecha só a senha — confirmação permanece visível.
    await user.click(screen.getAllByRole("button", { name: "Ocultar senha" })[0]);
    expect(senha).toHaveAttribute("type", "password");
    expect(confirmar).toHaveAttribute("type", "text");
  });

  it("repassa aria-invalid e aria-describedby para o input", () => {
    render(
      <PasswordInput id="pwd" value="" onChange={() => {}} invalid describedBy="pwd-error" />
    );
    const input = document.getElementById("pwd") as HTMLInputElement;
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "pwd-error");
  });

  it("repassa placeholder e chama onChange com o valor completo", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = document.getElementById("pwd") as HTMLInputElement;
    expect(input).toHaveAttribute("placeholder", "••••••");
    await user.type(input, "123456");
    expect(input).toHaveValue("123456");
  });

  it("chama onChange a cada tecla com o valor acumulado (estado controlado)", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    function RecordingHarness() {
      const [v, setV] = useState("");
      return (
        <PasswordInput
          id="pwd"
          value={v}
          onChange={(x) => {
            setV(x);
            calls.push(x);
          }}
        />
      );
    }
    render(<RecordingHarness />);
    const input = document.getElementById("pwd") as HTMLInputElement;
    await user.type(input, "123456");
    expect(calls.length).toBe(6);
    expect(calls.at(-1)).toBe("123456");
  });
});