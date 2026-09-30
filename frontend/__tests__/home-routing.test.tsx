import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const state = vi.hoisted(() => ({
  replace: vi.fn(),
  auth: { user: { uid: "admin" }, initializing: false, profileLoaded: false,
    configured: true, role: "student", needsProfile: false, needsApproval: false },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => state.auth }));
vi.mock("@/components/ProfileSetup", () => ({ default: () => <div>Perfil</div> }));
vi.mock("@/components/PendingApproval", () => ({ default: () => <div>Pendente</div> }));
vi.mock("@/components/SetupNeeded", () => ({ default: () => <div>Configurar</div>, LoadingScreen: () => <div>Carregando</div> }));

describe("Destino depois do login", () => {
  beforeEach(() => {
    state.replace.mockClear();
    Object.assign(state.auth, { profileLoaded: false, role: "student", needsApproval: false });
  });
  it("espera o perfil antes de decidir a área do administrador", async () => {
    const view = render(<Home />);
    expect(state.replace).not.toHaveBeenCalled();
    Object.assign(state.auth, { profileLoaded: true, role: "admin" });
    view.rerender(<Home />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/admin"));
    expect(state.replace).not.toHaveBeenCalledWith("/dashboard");
  });
  it("encaminha o aluno só após carregar o perfil", async () => {
    const view = render(<Home />);
    expect(state.replace).not.toHaveBeenCalled();
    state.auth.profileLoaded = true;
    view.rerender(<Home />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/dashboard"));
  });
  it("mantém a conta sem aprovação na tela de espera", () => {
    Object.assign(state.auth, { profileLoaded: true, needsApproval: true });
    render(<Home />);
    expect(state.replace).not.toHaveBeenCalled();
  });
});
