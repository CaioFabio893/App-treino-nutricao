"use client";

import { useCallback, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import * as api from "@/lib/api";
import type { Check, HistoryExercise, WorkoutDefine, WorkoutHistoryEntry } from "@/lib/types";
import RestTimer from "./RestTimer";

const WEEK_DAY_LABEL: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

interface DraftSet {
  w: string;
  r: string;
  c: Check;
}

interface DraftEx {
  sets: DraftSet[];
  note: string;
}

const DRAFT_KEY = (id: string) => `twd_${id}`;

function emptyDraft(workout: WorkoutDefine): DraftEx[] {
  return (workout.exercises ?? []).map((ex) => ({
    note: "",
    sets: Array.from({ length: ex.sets || 1 }, () => ({ w: "", r: "", c: "" as Check })),
  }));
}

// Recupera o rascunho em tempo real salvo no localStorage (sobrevive a recarregar).
function loadDraft(workout: WorkoutDefine): DraftEx[] | null {
  const exs = workout.exercises ?? [];
  try {
    const raw = localStorage.getItem(DRAFT_KEY(workout.id!));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!Array.isArray(d) || d.length !== exs.length) return null;
    return d.map((ex, i) => ({
      note: ex && typeof ex.note === "string" ? ex.note : "",
      sets: Array.from({ length: exs[i].sets || 1 }, (_, si) => {
        const s = ex?.sets?.[si] || {};
        return {
          w: typeof s.w === "string" ? s.w : typeof s.w === "number" && Number.isFinite(s.w) ? String(s.w) : "",
          r: typeof s.r === "string" ? s.r : typeof s.r === "number" && Number.isFinite(s.r) ? String(s.r) : "",
          c: s.c === "ok" || s.c === "fail" ? s.c : "",
        };
      }),
    }));
  } catch {
    return null;
  }
}

function VideoLink({ url }: { url?: string }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  const embed =
    url.includes("youtu.be/") || url.includes("youtube.com/watch")
      ? url
          .replace("youtu.be/", "www.youtube.com/embed/")
          .replace("watch?v=", "embed/")
          .split("&")[0]
      : url;
  return (
    <div className="video-link">
      <button type="button" className="btn-sm" onClick={() => setOpen((o) => !o)}>
        {open ? "▲ Ocultar vídeo" : "▶ Ver vídeo (YouTube)"}
      </button>
      {open && (
        <div className="video-frame">
          <iframe
            src={embed}
            title="Vídeo do exercício"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

interface TodayWorkoutProps {
  workout: WorkoutDefine;
  history: WorkoutHistoryEntry[];
  getToken: () => Promise<string>;
  onToast: (msg: string) => void;
  onCompleted: () => void;
}

export default function TodayWorkout({
  workout,
  history,
  getToken,
  onToast,
  onCompleted,
}: TodayWorkoutProps) {
  const exs = useMemo(() => workout.exercises ?? [], [workout.exercises]);
  // Carrega o rascunho em tempo real do localStorage (sobrevive a recarregar a página).
  const [draft, setDraft] = useState<DraftEx[] | null>(() =>
    typeof window !== "undefined" ? loadDraft(workout) ?? emptyDraft(workout) : emptyDraft(workout)
  );
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [timerVisible, setTimerVisible] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const persist = useCallback(
    (next: DraftEx[]) => {
      setDraft(next);
      try {
        localStorage.setItem(DRAFT_KEY(workout.id!), JSON.stringify(next));
      } catch {
        /* storage indisponível — segue só em memória */
      }
    },
    [workout.id]
  );

  const updSet = useCallback(
    (ei: number, si: number, field: "w" | "r", value: string) => {
      if (!draft) return;
      const next = structuredClone(draft);
      next[ei].sets[si][field] = value;
      persist(next);
    },
    [draft, persist]
  );

  const cycleChk = useCallback(
    (ei: number, si: number) => {
      if (!draft) return;
      const next = structuredClone(draft);
      const cur = next[ei].sets[si].c;
      next[ei].sets[si].c = cur === "" ? "ok" : cur === "ok" ? "fail" : "";
      persist(next);
    },
    [draft, persist]
  );

  const updNote = useCallback(
    (ei: number, note: string) => {
      if (!draft) return;
      const next = structuredClone(draft);
      next[ei].note = note;
      persist(next);
    },
    [draft, persist]
  );

  const toggleOpen = useCallback((ei: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(ei)) next.delete(ei);
      else next.add(ei);
      return next;
    });
  }, []);

  const openTimer = useCallback((e: MouseEvent, ei: number) => {
    e.stopPropagation();
    setOpen((prev) => new Set(prev).add(ei));
    setTimerVisible((prev) => new Set(prev).add(ei));
  }, []);

  // Progresso em tempo real (séries marcadas como ok).
  const total = exs.reduce((acc, ex) => acc + (ex.sets || 1), 0);
  const done = draft
    ? draft.reduce((acc, ex) => acc + ex.sets.filter((s) => s.c === "ok").length, 0)
    : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Última sessão (histórico mais recente com séries para o exercício).
  const lastFor = useCallback(
    (order: number): HistoryExercise | null => {
      const sorted = [...history].sort(
        (a, b) =>
          new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
      );
      for (const h of sorted) {
        if (h.workoutId !== workout.id) continue;
        const ex = h.exercises?.find((x) => x.order === order);
        if (ex?.sets?.length) return ex;
      }
      return null;
    },
    [history, workout.id]
  );

  const finish = useCallback(async () => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      // Monta o histórico direto do que o aluno preencheu na página do treino.
      const rows: HistoryExercise[] = exs.map((ex, i) => ({
        name: ex.name,
        order: ex.order ?? i,
        note: draft[i].note.trim() || ex.notes,
        sets: draft[i].sets.map((s) => ({
          weight: s.w || ex.weight || "",
          reps: s.r || "",
          done: s.c === "ok",
        })),
      }));
      const totalExercises = exs.length;
      const exercisesCompleted = rows.filter((ex) =>
        ex.sets?.some((s) => s.done)
      ).length;
      await api.completeWorkout(
        {
          workoutId: workout.id!,
          duration: 60,
          exercisesCompleted,
          totalExercises,
          exercises: rows,
        },
        token
      );
      try {
        localStorage.removeItem(DRAFT_KEY(workout.id!));
      } catch {
        /* ignorar */
      }
      setDraft(emptyDraft(workout));
      onToast("✓ Treino finalizado! Publicado no feed e pontuação atualizada.");
      onCompleted();
    } catch {
      onToast("⚠ Falha ao finalizar treino.");
    } finally {
      setBusy(false);
    }
  }, [draft, busy, getToken, exs, workout, onToast, onCompleted]);

  if (!draft) return null;

  return (
    <div>
      <div className="wod-box">
        <div className="wod-badge">{WEEK_DAY_LABEL[workout.dayOfWeek!] || "Treino"}</div>
        <div className="wod-title">{workout.name}</div>
        {workout.objective && (
          <div style={{ fontSize: 12, color: "#E6F7EF", marginBottom: 8 }}>
            Objetivo: {workout.objective}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#E6F7EF", opacity: 0.85 }}>
          Registre cada série em tempo real — peso, reps e ✓ ao concluir.
        </div>
      </div>

      <div className="prog-bar">
        <div className="prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="prog-lbl">
        {done} de {total} séries · {pct}%
      </div>

      <div className="section-label">Exercícios</div>

      {exs.map((ex, ei) => {
        const last = lastFor(ex.order ?? ei);
        const exD = draft[ei];
        const isOpen = open.has(ei);
        return (
          <div className="ex-card" key={ex.id || `${ex.name}-${ei}`}>
            <div className={`ex-hd${isOpen ? " open" : ""}`} onClick={() => toggleOpen(ei)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ex-name">{ex.name}</div>
                <div className="ex-meta">
                  {ex.sets}× · {ex.repetitions}
                  {ex.weight ? ` · ${ex.weight}` : ""}
                  {ex.restSeconds ? ` · descanso ${ex.restSeconds}s` : ""}
                  {ex.notes ? ` · ${ex.notes}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="hbtn" onClick={(e) => openTimer(e, ei)}>
                  ⏱ Descanso
                </button>
                <span className={`chev${isOpen ? " open" : ""}`}>▼</span>
              </div>
            </div>

            <div className={`ex-body${isOpen ? " open" : ""}`}>
              {last && last.sets && (
                <div className="last-session">
                  <div className="last-session-title">Última sessão</div>
                  <div className="last-chips">
                    {last.sets.map((s, si) => (
                      <span key={si} className={`chip${s.done ? " done" : ""}`}>
                        S{si + 1}: {s.weight || "—"} × {s.reps || "—"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <RestTimer visible={timerVisible.has(ei)} />
              <VideoLink url={ex.videoUrl} />

              <div className="s-labels">
                <span>#</span>
                <span>Carga (kg)</span>
                <span>Reps</span>
                <span>Alvo</span>
                <span>✓</span>
              </div>

              {exD.sets.map((s, si) => (
                <div className="s-row" key={si}>
                  <span className="s-num">{si + 1}</span>
                  <input
                    className="w-inp"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    placeholder={ex.weight || "kg"}
                    value={s.w}
                    onChange={(e) => updSet(ei, si, "w", e.target.value)}
                  />
                  <input
                    className="r-inp"
                    type="number"
                    inputMode="numeric"
                    placeholder="reps"
                    value={s.r}
                    onChange={(e) => updSet(ei, si, "r", e.target.value)}
                  />
                  <span className="s-tgt" style={{ fontSize: 10 }}>
                    {ex.repetitions}
                  </span>
                  <button
                    type="button"
                    className={`chk-btn${s.c === "ok" ? " ok" : s.c === "fail" ? " fail" : ""}`}
                    onClick={() => cycleChk(ei, si)}
                  >
                    {s.c === "ok" ? "✓" : s.c === "fail" ? "✗" : "·"}
                  </button>
                </div>
              ))}

              <textarea
                className="note-ta"
                placeholder="Anotações…"
                value={exD.note}
                onChange={(e) => updNote(ei, e.target.value)}
              />
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className="btn-p"
        style={{ marginTop: 14, width: "100%" }}
        disabled={busy}
        onClick={() => void finish()}
      >
        {busy ? "Salvando…" : "FINALIZAR TREINO"}
      </button>
    </div>
  );
}