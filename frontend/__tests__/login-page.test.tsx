import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

const authCtx = vi.hoisted(() => ({
  login: vi.fn<(email: string, password: string) => Promise<unknown>>(),
  user: null as { email: string } | null,
  configured: true,
  initializing: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: authCtx.user,
    initializing: authCtx.initializing,
    configured: authCtx.configured,
    login: authCtx.login,
  }),
}));

beforeEach(() => {
  authCtx.login.mockReset();
  authCtx.user = null;
  authCtx.configured = true;
  authCtx.initializing = false;
});

describe("LoginPage — login com e-mail/senha", () => {
  it("renderiza o formulário de login com links de cadastro e recuperação", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Bem-vinda de volta" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar"})).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar nova conta" })).toHaveAttribute(
      "href",
      "/cadastro"
    );
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute(
      "href",
      "/recuperar-senha"
    );
  });

  it("NÃO exibe Google Login (botão, texto ou divisor)", () => {
    render(<LoginPage />);
    expect(screen.queryByRole("button", { name: /Google/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Google/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("separator")
    ).not.toBeInTheDocument();
  });

  it("login válido chama login(email, senha)", async () => {
    const user = userEvent.setup();
    authCtx.login.mockResolvedValue(undefined);
    render(<LoginPage />);
    await user.type(screen.getByLabelText("E-mail"), "aluna@email.com");
    await user.type(screen.getByLabelText("Senha"), "123456");
    await user.click(screen.getByRole("button", { name: "Entrar"}));

    expect(authCtx.login).toHaveBeenCalledTimes(1);
    expect(authCtx.login).toHaveBeenCalledWith("aluna@email.com", "123456");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("login inválido mostra erro amigável", async () => {
    const user = userEvent.setup();
    authCtx.login.mockRejectedValue({ code: "auth/invalid-credential" });
    render(<LoginPage />);
    await user.type(screen.getByLabelText("E-mail"), "aluna@email.com");
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: "Entrar"}));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("E-mail ou senha incorretos.");
  });

  it("ficou em loading (disabled) enquanto a autenticação está em andamento", async () => {
    const user = userEvent.setup();
    // Promessa que nunca resolve: o botão fica em "Aguarde…" durante a espera.
    authCtx.login.mockImplementation(() => new Promise(() => {}));
    render(<LoginPage />);
    await user.type(screen.getByLabelText("E-mail"), "aluna@email.com");
    await user.type(screen.getByLabelText("Senha"), "123456");
    await user.click(screen.getByRole("button", { name: "Entrar"}));

    const button = screen.getByRole("button", { name: "Aguarde…" });
    expect(button).toBeDisabled();
  });

  it("alterna a visibilidade da senha (mostrar → ocultar)", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const senha = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(senha).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(senha).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(senha).toHaveAttribute("type", "password");
  });
});