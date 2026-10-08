import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NutritionAdminPage from "@/components/NutritionAdminPage";
const mocks = vi.hoisted(() => ({ listDiets: vi.fn(), listStudents: vi.fn(), duplicateDiet: vi.fn(), getToken: vi.fn(async () => "tok") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ getToken: mocks.getToken }) }));
vi.mock("@/lib/api", () => ({ ...mocks, friendlyError: (e: unknown) => String(e) }));
beforeEach(() => {
  mocks.listDiets.mockResolvedValue([{ id: "diet", name: "Plano PDF", document: { pageCount: 3 } }]);
  mocks.listStudents.mockResolvedValue([{ id: "ana", name: "Ána", email: "ana@x" }, { id: "bia", name: "Bia", email: "bia@x" }]);
  mocks.duplicateDiet.mockReset().mockResolvedValue({});
});
it("associa plano documental aos alunos selecionados e repete somente falhas", async () => {
  mocks.duplicateDiet.mockImplementation(async (_id: string, request: {newStudentId: string}) => { if (request.newStudentId === "bia" && mocks.duplicateDiet.mock.calls.length <= 2) throw Error("falha"); return {}; });
  render(<NutritionAdminPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Associar a vários alunos" }));
  await userEvent.click(screen.getByRole("button", { name: "Selecionar todos os alunos" }));
  await userEvent.click(screen.getByRole("button", { name: /Associar a 2 aluno/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("1 aluno(s) não receberam");
  expect(mocks.duplicateDiet).toHaveBeenCalledWith("diet", {newStudentId: "ana", newName: "Plano PDF"}, "tok");
  await userEvent.click(screen.getByRole("button", { name: /Associar a 1 aluno/ }));
  await waitFor(() => expect(mocks.duplicateDiet).toHaveBeenCalledTimes(3));
  expect(mocks.duplicateDiet.mock.calls.filter(c => c[1].newStudentId === "ana")).toHaveLength(1);
});
it("busca sem acentos e preserva seleção ao mudar busca", async () => {
  render(<NutritionAdminPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Associar a vários alunos" }));
  const search = screen.getByRole("searchbox");
  await userEvent.type(search, "ana");
  await userEvent.click(screen.getByRole("button", { name: "Selecionar todos da busca" }));
  await userEvent.clear(search);
  expect(screen.getByRole("checkbox", {name: /Ána/})).toBeChecked();
  expect(screen.getByRole("checkbox", {name: /Bia/})).not.toBeChecked();
});
