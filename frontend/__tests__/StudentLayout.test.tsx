import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StudentLayout from "@/components/StudentLayout";

const state = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/treinos/abc",
  auth: {
    user: { uid: "s1" },
    initializing: false,
    profile: { id: "s1", name: "João", role: "student" },
    needsApproval: false,
    logout: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace, push: vi.fn() }),
  usePathname: () => state.pathname,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => state.auth }));
vi.mock("@/components/SetupNeeded", () => ({ LoadingScreen: () => <div>Carregando</div> }));

describe("StudentLayout", () => {
  it("mostra a faixa de Check-in Diário em nova aba, preservando a página", () => {
    render(<StudentLayout><div>conteúdo</div></StudentLayout>);
    const link = screen.getByRole("link", { name: /Check-in Diário/ });
    expect(link).toHaveAttribute("href", "https://forms.gle/7E8rybhNQEbnqpTe8");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("marca a aba pai como ativa em rota aninhada", () => {
    render(<StudentLayout><div>conteúdo</div></StudentLayout>);
    expect(screen.getByRole("link", { name: "Treino" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dieta" })).not.toHaveAttribute("aria-current");
  });
});
