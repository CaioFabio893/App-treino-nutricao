"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { suggestion } from "@/lib/data";
import type { ExerciseData, ExercisePlan, Phase, PRs, SetData } from "@/lib/types";
import RestTimer from "./RestTimer";
import SetRow from "./SetRow";

interface LastChips {
  week: number;
  sets: SetData[];
}

interface ExerciseCardProps {
  ei: number;
  week: number;
  dayId: string;
  plan: ExercisePlan;
  phase: Phase | null;
  prKey?: "a" | "b" | "c";
  prs: PRs;
  data: ExerciseData | undefined;
  getToken: () => Promise<string>;
  onSet: (ei: number, si: number, field: "w" | "r", value: number | undefined) => void;
  onChk: (ei: number, si: number) => void;
  onNote: (ei: number, text: string) => void;
}

export default function ExerciseCard(props: ExerciseCardProps) {
  const { ei, week, dayId, plan, phase, prKey, prs, data, getToken, onSet, onChk, onNote } = props;
  const [open, setOpen] = useState(false);
  const [timerVisible, setTimerVisible] = useState(false);
  const [last, setLast] = useState<LastChips | null>(null);

  const exd = data ?? { sets: [] as SetData[] };
  const suggested = prKey && phase ? suggestion(prs[prKey], phase.pct) : null;

  // Busca a sessão anterior (semana mais próxima que tiver dados) quando o card abre.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        for (let w = week - 1; w >= 1; w--) {
          const sess = await api.getSession(w, dayId, token);
          const sets = sess?.exercise?.[ei]?.sets?.filter(
            (s) => s && (s.w !== undefined || s.r !== undefined)
          );
          if (sets && sets.length) {
            if (!cancelled) setLast({ week: w, sets });
            return;
          }
        }
        if (!cancelled) setLast(null);
      } catch {
        if (!cancelled) setLast(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, week, dayId, ei, getToken]);

  const openBody = () => setOpen((o) => !o);
  const openTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
    setTimerVisible(true);
  };

  return (
    <div className="ex-card">
      <div className={`ex-hd${open ? " open" : ""}`} onClick={openBody}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ex-name">{plan.n}</div>
          <div className="ex-meta">
            {plan.s}× · {plan.r}
            {plan.o ? ` · ${plan.o}` : ""}
            {prKey && suggested ? ` · Sugestão: ${suggested}kg` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="hbtn" onClick={openTimer}>
            ⏱ Descanso
          </button>
          <span className={`chev${open ? " open" : ""}`}>▼</span>
        </div>
      </div>
      <div className={`ex-body${open ? " open" : ""}`}>
        {last && (
          <div className="last-session">
            <div className="last-session-title">Última sessão (Sem {last.week})</div>
            <div className="last-chips">
              {last.sets.map((s, si) => (
                <span key={si} className={`chip${s.c === "ok" ? " done" : ""}`}>
                  S{si + 1}: {s.w ?? "—"}kg × {s.r ?? "—"}
                </span>
              ))}
            </div>
          </div>
        )}
        <RestTimer visible={timerVisible} />
        <div className="s-labels">
          <span>#</span>
          <span>Carga (kg)</span>
          <span>Reps</span>
          <span>Alvo</span>
          <span>✓</span>
        </div>
        {Array.from({ length: plan.s }, (_, si) => (
          <SetRow
            key={si}
            num={si + 1}
            set={exd.sets[si] ?? {}}
            target={plan.r}
            placeholderKg={suggested ? String(suggested) : undefined}
            onValue={(field, value) => onSet(ei, si, field, value)}
            onCycle={() => onChk(ei, si)}
          />
        ))}
        <textarea
          className="note-ta"
          placeholder="Anotações…"
          value={exd.note ?? ""}
          onChange={(e) => onNote(ei, e.target.value)}
        />
      </div>
    </div>
  );
}