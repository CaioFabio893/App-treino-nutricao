import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProtectedDietViewer from "@/components/ProtectedDietViewer";
import DietForm from "@/components/DietForm";

const mocks = vi.hoisted(() => ({
  profile: { id: "student-uid", name: "Ana", role: "student", status: "active" } as { id: string; name: string; role: string; status: string } | null,
  token: vi.fn(), page: vi.fn(), update: vi.fn(), create: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ profile: mocks.profile, getToken: mocks.token }) }));
vi.mock("@/lib/api", () => ({ getDietPage: mocks.page, friendlyError: () => "Falha ao abrir", updateDiet: mocks.update, createDiet: mocks.create }));

describe("Visualização privada de dieta", () => {
  const close = vi.fn();
  const fillText = vi.fn();
  beforeEach(() => {
    mocks.profile = { id: "student-uid", name: "Ana", role: "student", status: "active" };
    mocks.token.mockResolvedValue("private-token");
    mocks.page.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    mocks.update.mockResolvedValue(undefined);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 900, height: 1200, close }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), fillText,
    } as unknown as CanvasRenderingContext2D);
  });

  it("carrega sete páginas contínuas sem marca e fecha bitmaps, sem link para arquivo", async () => {
    const { unmount, container } = render(<ProtectedDietViewer dietId="d1" pageCount={7} />);
    await waitFor(() => expect(mocks.page).toHaveBeenCalledWith("d1", 7, "private-token", expect.any(AbortSignal)));
    expect(container.querySelectorAll("canvas")).toHaveLength(7);
    expect(fillText).not.toHaveBeenCalled();
    expect(mocks.page).toHaveBeenCalledWith("d1", 1, "private-token", expect.any(AbortSignal));
    expect(container.querySelector("a, img, iframe, object, embed")).toBeNull();
    expect(screen.queryByRole("button", { name: /Próxima/ })).toBeNull();
    await waitFor(() => expect(mocks.page).toHaveBeenCalledWith("d1", 2, "private-token", expect.any(AbortSignal)));
    unmount();
    expect(close).toHaveBeenCalled();
  });

  it("limpa a página ao perder o perfil e não busca sem sessão", async () => {
    const { rerender, container } = render(<ProtectedDietViewer dietId="d1" pageCount={7} />);
    await waitFor(() => expect(container.querySelector("canvas")?.width).toBe(900));
    mocks.profile = null;
    rerender(<ProtectedDietViewer dietId="d1" pageCount={7} />);
    expect(container.querySelector("canvas")?.width).toBe(1);
  });

  it("salva uma dieta de documento sem texto e preserva o documento", async () => {
    render(<DietForm initial={{ id: "d1", name: "Plano Mulheres", document: { id: "doc1", pageCount: 7 } }} students={[]} getToken={mocks.token} onDone={() => {}} onCancel={() => {}} />);
    const save = screen.getByRole("button", { name: "Salvar dieta" });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("d1", expect.objectContaining({ document: { id: "doc1", pageCount: 7 }, content: "" }), "private-token"));
    expect(screen.queryByRole("textbox", { name: /Plano alimentar/ })).toBeNull();
  });
});
