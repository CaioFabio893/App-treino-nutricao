import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/lib/auth";

// Modo demo: AuthProvider opera sem Firebase (firebaseAuth null) e sem rede.
vi.mock("@/lib/firebase", () => ({
  firebaseAuth: null,
  firebaseConfigured: false,
  googleProvider: undefined,
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: true }));

function Probe() {
  const ctx = useAuth();
  return (
    <div>
      <span data-testid="user">{ctx.user?.email ?? "none"}</span>
      <span data-testid="profile-role">{ctx.profile?.role ?? "none"}</span>
      <span data-testid="active-role">{ctx.role}</span>
      <span data-testid="demo-as">{ctx.demoAs}</span>
      <button onClick={() => void ctx.login("a@b.c", "x")}>login</button>
      <button onClick={() => void ctx.logout()}>logout</button>
      <button onClick={() => ctx.setDemoAs("student")}>as-student</button>
    </div>
  );
}

beforeEach(() => {
  // Garante o papel inicial "nutritionist" que o provider usa no mount.
  localStorage.clear();
});

describe("AuthProvider — fluxo de autenticação em modo demo", () => {
  it("inicia logado como nutricionista demo (sem Firebase)", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(await screen.findByTestId("user")).toHaveTextContent("demo@treino.app");
    expect(screen.getByTestId("profile-role")).toHaveTextContent("nutritionist");
    expect(screen.getByTestId("active-role")).toHaveTextContent("nutritionist");
    expect(screen.getByTestId("demo-as")).toHaveTextContent("nutritionist");
  });

  it("alterna para a visão do aluno (demoAs student) com features completas", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await userEvent.click(await screen.findByText("as-student"));
    expect(screen.getByTestId("profile-role")).toHaveTextContent("student");
    expect(screen.getByTestId("active-role")).toHaveTextContent("student");
    expect(screen.getByTestId("demo-as")).toHaveTextContent("student");
  });

  it("login em modo demo devolve o usuário demo sem erro", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await userEvent.click(await screen.findByText("login"));
    expect(screen.getByTestId("user")).toHaveTextContent("demo@treino.app");
  });

  it("logout limpa usuário e perfil", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await userEvent.click(await screen.findByText("logout"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("profile-role")).toHaveTextContent("none");
  });
});