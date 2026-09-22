import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StudentDashboard from "@/components/student/StudentDashboard";
import type { UserProfile } from "@/lib/types";

const dashboardCtx = vi.hoisted(() => ({ profile: null as UserProfile | null }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ profile: dashboardCtx.profile }),
}));

function renderWithProfile(profile: UserProfile | null) {
  dashboardCtx.profile = profile;
  return render(<StudentDashboard />);
}

describe("StudentDashboard — cards de módulo por feature do plano", () => {
  it("mostra Treinos sempre, mesmo sem features (tier gratuito)", () => {
    renderWithProfile({
      id: "s1",
      name: "João Silva",
      email: "joao@email.com",
      role: "student",
      status: "active",
      features: [],
    });
    // Regra documentada (docs/security/plans.md): workouts é sempre liberado.
    expect(screen.getByRole("link", { name: /Treinos/ })).toBeInTheDocument();
    // Com Treinos sempre visível, o empty state ("ainda não tem módulos") é
    // inalcançável — o dashboard nunca renderiza essa mensagem.
    expect(screen.queryByText(/ainda não tem módulos/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dietas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ranking/ })).not.toBeInTheDocument();
  });

  it("mostra apenas os módulos liberados no plano", () => {
    renderWithProfile({
      id: "s1",
      name: "João Silva",
      role: "student",
      status: "active",
      features: ["diet"],
    });
    expect(screen.getByRole("link", { name: /Treinos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dietas/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Comunidade/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ranking/ })).not.toBeInTheDocument();
  });

  it("mostra todos os módulos com o plano completo", () => {
    renderWithProfile({
      id: "s1",
      name: "Maria Souza",
      role: "student",
      status: "active",
      features: ["workouts", "diet", "community", "ranking"],
    });
    expect(screen.getByRole("link", { name: /Treinos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dietas/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Comunidade/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ranking/ })).toBeInTheDocument();
    expect(screen.queryByText(/ainda não tem módulos/)).not.toBeInTheDocument();
  });

  it("saúda pelo primeiro nome do aluno e usa fallback 'Aluno' sem nome", () => {
    renderWithProfile({
      id: "s1",
      name: "João Pedro da Silva",
      role: "student",
      status: "active",
    });
    expect(screen.getByRole("heading", { name: "Olá, João 👋" })).toBeInTheDocument();

    renderWithProfile({
      id: "s2",
      name: "",
      role: "student",
      status: "active",
    });
    expect(screen.getByRole("heading", { name: "Olá, Aluno 👋" })).toBeInTheDocument();
  });

  it("perfil ausente (null) não quebra: mostra o fallback de greeting", () => {
    renderWithProfile(null);
    expect(screen.getByRole("heading", { name: "Olá, Aluno 👋" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Treinos/ })).toBeInTheDocument();
  });
});