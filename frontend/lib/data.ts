import type { DayPlan, Phase } from "./types";

export const WEEK_COUNT = 8;

export const PHASES: (Phase | null)[] = [
  null,
  { pct: 70, label: "Semana 1 · 70%" },
  { pct: 70, label: "Semana 2 · 70%" },
  { pct: 75, label: "Semana 3 · 75%" },
  { pct: 75, label: "Semana 4 · 75%" },
  { pct: 82.5, label: "Semana 5 · 82,5%" },
  { pct: 82.5, label: "Semana 6 · 82,5%" },
  { pct: 90, label: "Semana 7 · 90%" },
  { pct: 70, label: "Semana 8 · Deload" },
];

export const PR_MAP: Record<string, "a" | "b" | "c"> = {
  "Agachamento Livre com Barra": "a",
  "Elevação Pélvica": "b",
  "Leg Press 45°": "c",
};

export const DAYS: DayPlan[] = [
  {
    id: "ta",
    label: "Treino A",
    name: "Pernas · Quadríceps",
    ex: [
      { n: "Agachamento Livre com Barra", s: 4, r: "6-8", o: "Foco em força/carga" },
      { n: "Hack Squat", s: 4, r: "10", o: "Amplitude total" },
      { n: "Leg Press 45°", s: 4, r: "10-12", o: "Cadência controlada" },
      { n: "Cadeira Extensora", s: 3, r: "12", o: "Drop-set na última série" },
      { n: "Panturrilha Sentada", s: 4, r: "15", o: "Iso 3s no topo" },
    ],
  },
  {
    id: "tb",
    label: "Treino B",
    name: "Costas · Bíceps",
    ex: [
      { n: "Puxada Alta Pronada", s: 4, r: "8-10" },
      { n: "Remada Curvada com Barra", s: 4, r: "10" },
      { n: "Remada Baixa no Cabo", s: 3, r: "12" },
      { n: "Rosca Direta com Barra", s: 3, r: "10" },
      { n: "Rosca Martelo com Halteres", s: 3, r: "12" },
    ],
    cardio: [
      {
        op: "Opção 1 · 4 rounds",
        items: [
          "Subida de escada — 2 min",
          "Burpees — 10 reps",
          "Afundo caminhando — 20 reps (10 cada perna)",
          "Descanso 1 min entre rounds",
        ],
      },
      {
        op: "Opção 2 · 3 rounds",
        items: [
          "Subida de escada — 3 min",
          "Burpees — 15 reps",
          "Afundo com salto — 16 reps (8 cada perna)",
          "Descanso 90s entre rounds",
        ],
      },
      {
        op: "Opção 3 · AMRAP 12'",
        items: [
          "1 min subida de escada",
          "8 burpees",
          "12 afundos (6 cada perna)",
          "Repetir o quanto der em 12 minutos",
        ],
      },
    ],
  },
  {
    id: "tc",
    label: "Treino C",
    name: "Pernas · Glúteo/Posterior",
    ex: [
      { n: "Agachamento Livre com Barra", s: 4, r: "8-10", o: "Faixa moderada" },
      { n: "Elevação Pélvica", s: 4, r: "10-12", o: "Iso 2s no topo" },
      { n: "Stiff Romeno com Barra", s: 4, r: "8-10", o: "Descida lenta" },
      { n: "Glúteo na Polia", s: 3, r: "12", o: "Cada perna" },
      { n: "Mesa Flexora", s: 4, r: "10-12" },
      { n: "Cadeira Abdutora", s: 3, r: "15-20" },
      { n: "Panturrilha em Pé", s: 4, r: "20", o: "Parciais após a falha" },
    ],
  },
  {
    id: "td",
    label: "Treino D",
    name: "Peito · Ombro · Tríceps",
    ex: [
      { n: "Supino com Barra", s: 4, r: "8" },
      { n: "Supino Inclinado com Halteres", s: 3, r: "10" },
      { n: "Desenvolvimento com Halteres", s: 3, r: "10-12" },
      { n: "Elevação Lateral", s: 3, r: "15" },
      { n: "Tríceps na Polia (Corda)", s: 3, r: "12" },
      { n: "Tríceps Testa com Halteres", s: 3, r: "10" },
    ],
    cardio: [
      {
        op: "Opção 1 · 4 rounds",
        items: [
          "Subida de escada — 2 min",
          "Burpees — 10 reps",
          "Afundo caminhando — 20 reps (10 cada perna)",
          "Descanso 1 min entre rounds",
        ],
      },
      {
        op: "Opção 2 · 3 rounds",
        items: [
          "Subida de escada — 3 min",
          "Burpees — 15 reps",
          "Afundo com salto — 16 reps (8 cada perna)",
          "Descanso 90s entre rounds",
        ],
      },
      {
        op: "Opção 3 · AMRAP 12'",
        items: [
          "1 min subida de escada",
          "8 burpees",
          "12 afundos (6 cada perna)",
          "Repetir o quanto der em 12 minutos",
        ],
      },
    ],
  },
  {
    id: "te",
    label: "Treino E",
    name: "Pernas · Búlgaro/Unilateral",
    ex: [
      { n: "Agachamento Búlgaro com Halteres", s: 4, r: "8-10", o: "Cada perna" },
      { n: "Leg Press 45° (pés baixos)", s: 3, r: "12-15" },
      { n: "Afundo com Passada", s: 3, r: "10-12", o: "Cada perna" },
      { n: "Cadeira Extensora", s: 3, r: "15" },
      { n: "Coice na Polia", s: 3, r: "12-15", o: "Cada perna" },
      { n: "Cadeira Abdutora", s: 3, r: "15-20" },
      { n: "Panturrilha no Leg Press", s: 3, r: "15-20" },
    ],
  },
];

// Sugestão de carga: % do PR para a fase atual.
export function suggestion(kg: number, pct: number): number | null {
  return kg && kg > 0 ? Math.round(kg * (pct / 100) * 2) / 2 : null;
}