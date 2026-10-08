import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudentDietPage from "@/components/student/StudentDietPage";
import type { Diet, UserProfile } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  listDiets: vi.fn(),
  profile: { id: "s1", name: "João", role: "student", status: "active" } as UserProfile,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: mocks.getToken, profile: mocks.profile }),
}));

vi.mock("@/lib/api", () => ({
  listDiets: mocks.listDiets,
}));


const textDiet: Diet = {
  id: "d1",
  studentId: "s1",
  name: "Plano Hipercalórico",
  content: "CAFÉ DA MANHÃ\n• 4 ovos mexidos\n• 2 bananas com aveia",
};

const legacyMealsDiet: Diet = {
  id: "d2",
  studentId: "s1",
  name: "Plano Seco",
  meals: [
    {
      id: "m1",
      name: "Almoço",
      time: "12:30",
      order: 1,
      foods: [{ name: "Frango", quantity: 200, unit: "g", notes: "grelhado" }],
    },
  ],
};

describe("StudentDietPage — dieta do aluno", () => {
  it("mostra loading enquanto carrega", () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.listDiets.mockReturnValue(new Promise(() => {}));
    render(<StudentDietPage />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it("renderiza dieta em texto livre (formato simplificado)", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.listDiets.mockResolvedValue([textDiet]);

    render(<StudentDietPage />);
    expect(await screen.findByText("Plano Hipercalórico")).toBeInTheDocument();
    expect(screen.getByText(/CAFÉ DA MANHÃ/)).toBeInTheDocument();
    expect(screen.getByText(/4 ovos mexidos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar dieta/ })).toBeInTheDocument();
    // Sem refeições estruturadas → nenhum acompanhamento por refeição.
    expect(screen.queryByText(/Acompanhamento de hoje/)).not.toBeInTheDocument();
  });

  it("renderiza dieta legada (refeições estruturadas) sem quebrar", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.listDiets.mockResolvedValue([legacyMealsDiet]);

    render(<StudentDietPage />);
    expect(await screen.findByText("Plano Seco")).toBeInTheDocument();
    expect(screen.getByText("Almoço")).toBeInTheDocument();
    expect(screen.getByText(/Frango — 200 g \(grelhado\)/)).toBeInTheDocument();
  });

  it("mostra estado vazio quando nenhuma dieta está atribuída ao aluno", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.listDiets.mockResolvedValue([]);

    render(<StudentDietPage />);
    expect(await screen.findByText(/Nenhuma dieta foi atribuída ainda/)).toBeInTheDocument();
  });

  it("ignora dietas de outros alunos na listagem", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.listDiets.mockResolvedValue([textDiet, { ...textDiet, id: "outra", studentId: "s9" }]);

    render(<StudentDietPage />);
    // Só a dieta do próprio aluno é exibida.
    expect(await screen.findByText("Plano Hipercalórico")).toBeInTheDocument();
  });

  it("mostra erro de carregamento e recupera no retry", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.listDiets.mockRejectedValueOnce(new Error("network"));
    mocks.listDiets.mockResolvedValueOnce([textDiet]);

    render(<StudentDietPage />);
    expect(await screen.findByText(/Não foi possível carregar sua dieta/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    await waitFor(() => expect(screen.getByText("Plano Hipercalórico")).toBeInTheDocument());
  });
  it("mantém dieta válida até meia-noite em Recife, mesmo no próximo dia UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T02:59:59Z"));
    try {
      mocks.getToken.mockResolvedValue("tok");
      mocks.listDiets.mockResolvedValue([{ ...textDiet, startDate: "2026-09-30", endDate: "2026-09-30" }]);
      render(<StudentDietPage />);
      expect(await screen.findByText("Plano Hipercalórico")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });});

describe("StudentDietPage — receitas globais", () => {
  const globalRecipe: Diet = {
    id: "r1",
    studentId: "",
    kind: "recipe",
    name: "Coxinha da Lou",
    content: "MODO DE PREPARO\n• Cozinhe a batata\n• Recheie e asse",
  };

  it("lista receitas globais (sem aluno) e abre por clique", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.listDiets.mockResolvedValue([globalRecipe, textDiet]);

    render(<StudentDietPage recipe />);
    // Receita aparece como botão; a dieta própria (kind diet) não aparece na aba de receitas.
    const botao = await screen.findByRole("button", { name: /Coxinha da Lou/ });
    expect(screen.queryByText("Plano Hipercalórico")).not.toBeInTheDocument();
    // Conteúdo escondido até abrir.
    expect(screen.queryByText(/MODO DE PREPARO/)).not.toBeInTheDocument();
    await userEvent.click(botao);
    expect(screen.getByText(/MODO DE PREPARO/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar receita/ })).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há receita", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.listDiets.mockResolvedValue([]);
    render(<StudentDietPage recipe />);
    expect(await screen.findByText(/Nenhuma receita disponível ainda/)).toBeInTheDocument();
  });
});