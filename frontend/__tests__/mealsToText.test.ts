import { describe, expect, it } from "vitest";
import { mealsToText } from "@/components/DietForm";

describe("mealsToText — conversão de dieta legada (refeições) em texto livre", () => {
  it("converte refeições com horário, alimentos (quantidade/unit/notes) e observações", () => {
    const text = mealsToText([
      {
        id: "m1",
        name: "Café da manhã",
        time: "07:00",
        order: 1,
        foods: [
          { name: "Ovo", quantity: 2, unit: "unidades", notes: "cozidos" },
          { name: "Banana", quantity: 1, unit: "unidade" },
        ],
      },
      {
        id: "m2",
        name: "Almoço",
        time: "12:30",
        order: 2,
        notes: "Sem fritura",
        foods: [{ name: "Frango", quantity: 200, unit: "g", notes: "" }],
      },
    ]);

    // O nome da refeição é preservado como estava no legado (capitalização não
    // é normalizada — é apresentação), e o horário entra no cabeçalho quando existe.
    expect(text).toContain("Café da manhã (07:00)");
    expect(text).toContain("• Ovo — 2 unidades (cozidos)");
    expect(text).toContain("• Banana — 1 unidade");
    expect(text).toContain("Almoço (12:30)");
    expect(text).toContain("• Frango — 200 g");
    expect(text).toContain("Obs: Sem fritura");
  });

  it("mantém cabeçalho mesmo sem horário e omite quantidade quando ausente", () => {
    const text = mealsToText([
      {
        id: "m1",
        name: "Lanche",
        time: "",
        order: 1,
        foods: [{ name: "Maçã", quantity: 0, unit: "" }],
      },
    ]);
    expect(text).toBe("Lanche\n• Maçã");
  });

  it("usa a unidade mesmo sem quantidade", () => {
    const text = mealsToText([
      { id: "m1", name: "Chá", time: "15:00", order: 1, foods: [{ name: "Chá verde", quantity: 0, unit: "xícara" }] },
    ]);
    expect(text).toContain("• Chá verde — xícara");
  });

  it("filtra alimentos e refeições sem nome (linhas vazias não poluem o texto)", () => {
    const text = mealsToText([
      { id: "m1", name: "Almoço", time: "12:00", order: 1, foods: [{ name: "", quantity: 0, unit: "" }, { name: "Feijão", quantity: 100, unit: "g" }] },
      { id: "m2", name: "", time: "18:00", order: 2, foods: [] },
    ]);
    // Nome preservado como no legado; refeições/alimentos sem nome são descartados.
    expect(text).toBe("Almoço (12:00)\n• Feijão — 100 g");
  });

  it("retorna string vazia para entrada vazia/undefined", () => {
    expect(mealsToText(undefined)).toBe("");
    expect(mealsToText([])).toBe("");
  });
});