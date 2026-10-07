import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import WorkoutPlayer, { readProgress } from "@/components/programs/WorkoutPlayer";

const workouts = [{ id: "a", name: "Treino A", exercises: [{ name: "Agachamento Livre com Barra", order: 1, sets: 2, repetitions: "6-8" }] }, { id: "b", name: "Treino B", exercises: [] }];
const player = (userId = "alice") => <WorkoutPlayer userId={userId} programId="program" workouts={workouts} periodized />;
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("Workout execution", () => {
  it("cycles outcomes, counts only successful sets and restores weight and notes after reload", () => {
    const view = render(player());
    fireEvent.change(screen.getByLabelText("Agachamento Livre com Barra série 1 carga"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Agachamento Livre com Barra série 1 repetições"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Observações da sessão"), { target: { value: "Boa amplitude" } });
    fireEvent.click(screen.getByRole("button", { name: /série 1: não marcada/ }));
    expect(screen.getByText("1 / 2 séries concluídas com sucesso")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /série 1: conseguiu/ }));
    expect(screen.getByText("0 / 2 séries concluídas com sucesso")).toBeInTheDocument();
    view.unmount(); render(player());
    expect(screen.getByLabelText("Agachamento Livre com Barra série 1 carga")).toHaveValue(40);
    expect(screen.getByLabelText("Observações da sessão")).toHaveValue("Boa amplitude");
    expect(screen.getByRole("button", { name: /série 1: não conseguiu/ })).toBeInTheDocument();
  });
  it("isolates accounts and derives PR suggestions and previous sessions by week", () => {
    const view = render(player());
    fireEvent.change(screen.getByLabelText("Agachamento Livre com Barra série 1 carga"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "PRs" }));
    fireEvent.change(screen.getByLabelText("Agachamento Livre com Barra"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar PRs" }));
    expect(screen.getByText(/Sugestão: 70 kg/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "SEM 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Semana 5/ }));
    expect(screen.getByText(/Sugestão: 82.5 kg/)).toBeInTheDocument();
    expect(screen.getByText("Última sessão · Semana 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Agachamento Livre com Barra série 1 carga")).toHaveValue(null);
    view.rerender(player("bob"));
    expect(screen.getByRole("button", { name: "SEM 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Agachamento Livre com Barra série 1 carga")).toHaveValue(null);
    expect(screen.queryByText(/Sugestão:/)).not.toBeInTheDocument();
  });
  it("counts real elapsed time, pauses, resets presets and stops at the target", () => {
    vi.useFakeTimers();
    render(player());
    fireEvent.click(screen.getByText("⏱ Descanso"));
    fireEvent.click(screen.getByRole("button", { name: "1 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("timer")).toHaveTextContent("00:10");
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole("timer")).toHaveTextContent("00:10");
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    act(() => { vi.advanceTimersByTime(55000); });
    expect(screen.getByRole("timer")).toHaveTextContent("01:00");
    expect(screen.getByText(/Descanso concluído/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2 min" }));
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  });
  it("reports storage failures instead of claiming success", () => {
    render(player());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("status")).toHaveTextContent("Falha ao salvar");
  });
  it("sanitizes persisted values and refuses invalid JSON", () => {
    expect(readProgress(JSON.stringify({ week: 99, prs: { "Elevação Pélvica": "<script>" }, sessions: { s: { sets: [{ weight: "bad", reps: "8", status: "evil" }], note: 123 } } }))).toMatchObject({ week: 1, prs: { "Elevação Pélvica": "" }, sessions: { s: { sets: [{ weight: "", reps: "8", status: "" }], note: "" } } });
    expect(() => readProgress("invalid")).toThrow();
  });
});


describe("AMRAP", () => {
  it("persists rounds and notes and clears only circuit outcomes for the next round", () => {
    const home = [{ id:"home", name:"Casa", modality:"home" as const, circuitSeconds:900, exercises:[{name:"Polichinelo",phase:"warmup" as const,sets:1,repetitions:"1min",order:1,durationSeconds:60},{name:"Sumô",phase:"main" as const,sets:1,repetitions:"15",order:2}] }];
    const renderHome = () => <WorkoutPlayer userId="alice" programId="feminino:home" workouts={home} />;
    const view=render(renderHome());
    fireEvent.click(screen.getByRole("button",{name:/Polichinelo série 1: não marcada/}));
    fireEvent.click(screen.getByRole("button",{name:/Sumô série 1: não marcada/}));
    fireEvent.click(screen.getByRole("button",{name:"Concluir volta e iniciar próxima"}));
    expect(screen.getByText("1 voltas concluídas nesta semana")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Polichinelo série 1: conseguiu/})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Sumô série 1: não marcada/})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Observações do circuito"),{target:{value:"3 exercícios da volta parcial"}});
    view.unmount();render(renderHome());
    expect(screen.getByText("1 voltas concluídas nesta semana")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações do circuito")).toHaveValue("3 exercícios da volta parcial");
    fireEvent.click(screen.getByRole("button",{name:"Corrigir última volta"}));
    expect(screen.getByText("0 voltas concluídas nesta semana")).toBeInTheDocument();
  });
});
