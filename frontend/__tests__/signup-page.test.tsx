import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CadastroPage from "@/app/cadastro/page";

const authCtx = vi.hoisted(() => ({
  signup: vi.fn<(email: string, password: string) => Promise<unknown>>(),
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
    signup: authCtx.signup,
  }),
}));

beforeEach(() => {
  authCtx.signup.mockReset();
  authCtx.user = null;
  authCtx.configured = true;
  authCtx.initializing = false;
});

async function preencher(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  senha: string,
  confirmacao: string
) {
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), senha);
  await user.type(screen.getByLabelText("Confirmar senha"), confirmacao);
}

describe("CadastroPage — criar conta com confirmação de senha", () => {
  it("renderiza e-mail, senha e confirmação com link de volta ao login", () => {
    render(<CadastroPage />);
    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar senha")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar conta"})
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar"})).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("exibe toggles de mostrar/ocultar para senha E confirmação (independentes)", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    const senha = screen.getByLabelText("Senha") as HTMLInputElement;
    const confirmar = screen.getByLabelText("Confirmar senha") as HTMLInputElement;
    expect(senha).toHaveAttribute("type", "password");
    expect(confirmar).toHaveAttribute("type", "password");

    // Abre apenas a senha: a confirmação continua oculta.
    await user.click(screen.getAllByRole("button", { name: "Mostrar senha" })[0]);
    expect(senha).toHaveAttribute("type", "text");
    expect(confirmar).toHaveAttribute("type", "password");

    // Abre a confirmação separadamente.
    await user.click(screen.getAllByRole("button", { name: "Mostrar senha" })[0]);
    expect(confirmar).toHaveAttribute("type", "text");
    expect(senha).toHaveAttribute("type", "text");

    // Oculta a senha de novo, sem afetar a confirmação.
    await user.click(screen.getAllByRole("button", { name: "Ocultar senha" })[0]);
    expect(senha).toHaveAttribute("type", "password");
    expect(confirmar).toHaveAttribute("type", "text");
  });

  it("não mostra erros antes do usuário interagir", () => {
    render(<CadastroPage />);
    expect(screen.queryByText("As senhas não coincidem.")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("bloqueia o cadastro quando as senhas são diferentes e mostra erro acessível", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await preencher(user, "nova@email.com", "123456", "654321");
    await user.click(screen.getByRole("button", { name: "Criar conta"}));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("As senhas não coincidem.");

    // Não chama o Firebase e permanece na tela de cadastro.
    expect(authCtx.signup).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();

    // Acessível: aria-invalid + aria-describedby no input de confirmação.
    const confirmar = screen.getByLabelText("Confirmar senha");
    expect(confirmar).toHaveAttribute("aria-invalid", "true");
    expect(confirmar).toHaveAttribute("aria-describedby", "cadastro-senha-confirmacao-error");
    expect(screen.getByText("As senhas não coincidem.")).toHaveAttribute(
      "id",
      "cadastro-senha-confirmacao-error"
    );
  });

  it("pede confirmação quando o campo está vazio", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await user.type(screen.getByLabelText("E-mail"), "nova@email.com");
    await user.type(screen.getByLabelText("Senha"), "123456");
    await user.click(screen.getByRole("button", { name: "Criar conta"}));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Confirme sua senha.");
    expect(authCtx.signup).not.toHaveBeenCalled();
  });

  it("valida o e-mail (formato inválido)", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await preencher(user, "nao-e-email", "123456", "123456");
    await user.click(screen.getByRole("button", { name: "Criar conta"}));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("E-mail inválido.");
    expect(authCtx.signup).not.toHaveBeenCalled();
  });

  it("cadastra com senhas iguais chamando signup(email, senha) — sem enviar a confirmação", async () => {
    const user = userEvent.setup();
    authCtx.signup.mockResolvedValue(undefined);
    render(<CadastroPage />);
    await preencher(user, "nova@email.com", "123456", "123456");
    await user.click(screen.getByRole("button", { name: "Criar conta"}));

    expect(authCtx.signup).toHaveBeenCalledTimes(1);
    expect(authCtx.signup).toHaveBeenCalledWith("nova@email.com", "123456");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra erro amigável quando o Firebase falha (e-mail em uso)", async () => {
    const user = userEvent.setup();
    authCtx.signup.mockRejectedValue({ code: "auth/email-already-in-use" });
    render(<CadastroPage />);
    await preencher(user, "existente@email.com", "123456", "123456");
    await user.click(screen.getByRole("button", { name: "Criar conta"}));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Esse e-mail já está cadastrado.");
    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("revalida a confirmação ao vivo depois da primeira tentativa", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await preencher(user, "nova@email.com", "123456", "654321");
    await user.click(screen.getByRole("button", { name: "Criar conta"}));
    await screen.findByText("As senhas não coincidem.");

    // Corrigir a confirmação remove o erro imediatamente (sem novo submit).
    const confirmar = screen.getByLabelText("Confirmar senha");
    await user.clear(confirmar);
    await user.type(confirmar, "123456");
    expect(screen.queryByText("As senhas não coincidem.")).not.toBeInTheDocument();
  });
});