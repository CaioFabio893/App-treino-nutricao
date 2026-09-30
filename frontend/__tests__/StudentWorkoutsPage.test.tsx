import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudentWorkoutsPage from "@/components/student/StudentWorkoutsPage";

const mocks = vi.hoisted(() => ({ getToken: vi.fn(), listWorkouts: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ getToken: mocks.getToken, profile: { id: "s1" } }) }));
vi.mock("@/lib/api", () => ({ listWorkouts: mocks.listWorkouts }));
const workout = { id: "w1", studentId: "s1", name: "Treino A", exercises: [{name: "Agachamento",sets: 3,repetitions: "10",weight: "40 kg",restSeconds: 60,order: 1,notes: "Controle a descida",videoUrl: "https://youtu.be/dQw4w9WgXcQ"}] };
beforeEach(() => { vi.clearAllMocks(); mocks.getToken.mockResolvedValue("token"); mocks.listWorkouts.mockResolvedValue([workout]); });

describe("Treinos somente leitura", () => {
  it("exibe a prescrição sem inputs, marcações ou botão de concluir", async () => {
    const { container } = render(<StudentWorkoutsPage />);
    await screen.findByRole("heading", { name: "Agachamento" });
    expect(screen.getByText(/3 séries · 10 · 40 kg · descanso 60s/)).toBeInTheDocument();
    expect(screen.getByText(/Controle a descida/)).toBeInTheDocument();
    expect(container.querySelectorAll("input, textarea, .chk-btn")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /finalizar|concluir|registrar/i })).not.toBeInTheDocument();
    expect(mocks.listWorkouts).toHaveBeenCalledWith("token");
  });
  it("troca treino localmente sem nova requisição e oculta treino alheio", async () => {
    mocks.listWorkouts.mockResolvedValue([workout,{...workout,id:"w2",name:"Treino B",exercises:[]},{...workout,id:"other",studentId:"s2",name:"Alheio"}]);
    render(<StudentWorkoutsPage />);
    await screen.findByRole("button", { name: /Treino B/ });
    await userEvent.click(screen.getByRole("button", { name: /Treino B/ }));
    expect(screen.getByRole("heading", { name: "Treino B" })).toBeInTheDocument();
    expect(screen.queryByText("Alheio")).not.toBeInTheDocument();
    expect(mocks.listWorkouts).toHaveBeenCalledTimes(1);
  });
  it("mantém vídeo YouTube consultável", async () => {
    const { container } = render(<StudentWorkoutsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Ver vídeo de Agachamento" }));
    expect(container.querySelector("iframe")).toHaveAttribute("src","https://www.youtube.com/embed/dQw4w9WgXcQ");
  });
  it("mostra estado vazio", async () => {
    mocks.listWorkouts.mockResolvedValue([]);
    render(<StudentWorkoutsPage />);
    expect(await screen.findByText("Nenhum treino atribuído a você ainda.")).toBeInTheDocument();
  });
  it("recupera falha de carregamento com retry", async () => {
    mocks.listWorkouts.mockRejectedValueOnce(new Error("offline"));
    render(<StudentWorkoutsPage />);
    await screen.findByText("Não foi possível carregar seus treinos.");
    await userEvent.click(screen.getByRole("button",{name:/tentar novamente/i}));
    expect(await screen.findByRole("heading",{name:"Agachamento"})).toBeInTheDocument();
  });
});