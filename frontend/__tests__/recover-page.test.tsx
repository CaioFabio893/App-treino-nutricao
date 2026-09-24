import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecuperarSenhaPage from "@/app/recuperar-senha/page";

const authCtx = vi.hoisted(() => ({
  resetPassword: vi.fn<(email: string) => Promise<void>>(),
  configured: true,
  initializing: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    configured: authCtx.configured,
    initializing: authCtx.initializing,
    resetPassword: authCtx.resetPassword,
  }),
}));

beforeEach(() => {
  authCtx.resetPassword.mockReset();
  authCtx.configured = true;
  authCtx.initializing = false;
});

describe("RecuperarSenhaPage — redefinição via Firebase (e-mail)", () => {
  it("renderiza o campo de e-mail, o botão Enviar e o retorno ao login", () => {
    render(<RecuperarSenhaPage />);
    expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar"})).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("e-mail inválido mostra validação e NÃO chama o Firebase", async () => {
    const user = userEvent.setup();
    render(<RecuperarSenhaPage />);
    await user.type(screen.getByLabelText("E-mail"), "nao-e-email");
    await user.click(screen.getByRole("button", { name: "Enviar"}));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("E-mail inválido.");
    expect(authCtx.resetPassword).not.toHaveBeenCalled();
  });

  it("e-mail vazio mostra validação", async () => {
    const user = userEvent.setup();
    render(<RecuperarSenhaPage />);
    await user.click(screen.getByRole("button", { name: "Enviar"}));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Informe seu e-mail.");
    expect(authCtx.resetPassword).not.toHaveBeenCalled();
  });

  it("e-mail válido chama resetPassword(email) e mostra sucesso (anti-enumeração)", async () => {
    const user = userEvent.setup();
    authCtx.resetPassword.mockResolvedValue(undefined);
    render(<RecuperarSenhaPage />);
    await user.type(screen.getByLabelText("E-mail"), "aluna@email.com");
    await user.click(screen.getByRole("button", { name: "Enviar"}));

    expect(authCtx.resetPassword).toHaveBeenCalledTimes(1);
    expect(authCtx.resetPassword).toHaveBeenCalledWith("aluna@email.com");

    const msg = await screen.findByText(/Se o e-mail estiver cadastrado/);
    expect(msg).toBeInTheDocument();
    // O formulário dá lugar ao sucesso (botão Enviar some).
    expect(screen.queryByRole("button", { name: "Enviar"})).not.toBeInTheDocument();
  });

  it("ficou em loading (disabled) enquanto o e-mail é enviado", async () => {
    const user = userEvent.setup();
    authCtx.resetPassword.mockImplementation(() => new Promise(() => {}));
    render(<RecuperarSenhaPage />);
    await user.type(screen.getByLabelText("E-mail"), "aluna@email.com");
    await user.click(screen.getByRole("button", { name: "Enviar"}));

    const button = screen.getByRole("button", { name: "Enviando…" });
    expect(button).toBeDisabled();
  });

  it("erro de rede mostra mensagem compreensível", async () => {
    const user = userEvent.setup();
    authCtx.resetPassword.mockRejectedValue({ code: "auth/network-request-failed" });
    render(<RecuperarSenhaPage />);
    await user.type(screen.getByLabelText("E-mail"), "aluna@email.com");
    await user.click(screen.getByRole("button", { name: "Enviar"}));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Falha de conexão. Verifique sua internet e tente novamente."
    );
  });

  it("e-mail inexistente vira sucesso genérico (não revela se a conta existe)", async () => {
    const user = userEvent.setup();
    authCtx.resetPassword.mockRejectedValue({ code: "auth/user-not-found" });
    render(<RecuperarSenhaPage />);
    await user.type(screen.getByLabelText("E-mail"), "naoexiste@email.com");
    await user.click(screen.getByRole("button", { name: "Enviar"}));

    await screen.findByText(/Se o e-mail estiver cadastrado/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra o link de volta ao login no estado de sucesso", async () => {
    const user = userEvent.setup();
    authCtx.resetPassword.mockResolvedValue(undefined);
    render(<RecuperarSenhaPage />);
    await user.type(screen.getByLabelText("E-mail"), "aluna@email.com");
    await user.click(screen.getByRole("button", { name: "Enviar"}));

    await screen.findByText(/Se o e-mail estiver cadastrado/);
    expect(screen.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});