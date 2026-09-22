import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Ranking from "@/components/Ranking";
import type { RankingResponse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  getRanking: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: mocks.getToken }),
}));

vi.mock("@/lib/api", () => ({
  getRanking: mocks.getRanking,
}));

const data: RankingResponse = {
  cycleId: "C2026-Q3",
  cycleStart: "2026-07-01",
  cycleEnd: "2026-09-30",
  top: [
    { studentId: "s1", name: "João", score: 9.5, rank: 1 },
    { studentId: "s2", name: "Maria", score: 8.2, rank: 2 },
  ],
  total: 3,
};

describe("Ranking — página de ranking do aluno", () => {
  it("mostra skeleton enquanto carrega", () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.getRanking.mockReturnValue(new Promise(() => {}));
    render(<Ranking />);
    expect(document.querySelector(".rank-skeleton, .skeleton")).toBeDefined();
  });

  it("mostra o top do ciclo com medalhas e links para o perfil", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.getRanking.mockResolvedValue(data);

    render(<Ranking />);
    expect(await screen.findByText("Ranking do ciclo")).toBeInTheDocument();
    expect(screen.getByText(/C2026-Q3/)).toBeInTheDocument();
    expect(screen.getByText("🥇")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /João/ })).toHaveAttribute("href", "/profile/s1");
    expect(screen.getByText("9.5")).toBeInTheDocument();
    expect(screen.getByText("🥈")).toBeInTheDocument();
  });

  it("mostra o próprio aluno (`self`) destacado quando fora do top", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.getRanking.mockResolvedValue({
      ...data,
      self: { studentId: "s3", name: "Você", score: 6.0, rank: 4 },
    });

    render(<Ranking />);
    expect(await screen.findByText("Você")).toBeInTheDocument();
    const selfLink = screen.getByRole("link", { name: /Você/ });
    expect(selfLink.className).toContain("me");
  });

  it("mostra estado vazio quando ninguém pontuou no ciclo", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.getRanking.mockResolvedValue({ ...data, top: [] });

    render(<Ranking />);
    expect(await screen.findByText(/Nenhum aluno pontuou ainda neste ciclo/)).toBeInTheDocument();
  });

  it("mostra erro e recupera no retry", async () => {
    mocks.getToken.mockResolvedValue("tok");
    mocks.getRanking.mockRejectedValueOnce(new Error("network"));
    mocks.getRanking.mockResolvedValueOnce(data);

    render(<Ranking />);
    expect(await screen.findByText(/Não foi possível carregar o ranking/)).toBeInTheDocument();

    // LoadError expõe "Tentar novamente" como link/button.
    const retry = screen.getByRole("button", { name: /Tentar novamente/i });
    retry.click();

    await waitFor(() => expect(screen.getByText("Ranking do ciclo")).toBeInTheDocument());
  });
});