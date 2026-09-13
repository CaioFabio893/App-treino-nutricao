"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { Diet, DietDailyLog, MealCheck } from "@/lib/types";
import { useAuth } from "@/lib/auth";

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function DietCheck({ diet }: { diet: Diet | undefined }) {
  const { getToken, profile } = useAuth();
  const [log, setLog] = useState<DietDailyLog | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const me = profile?.id ?? "";
      const logs = await api.listDietLogs(me, token, todayKey(), todayKey());
      const today = logs.find((l) => l.date === todayKey()) ?? null;
      setLog(today);
      setCaption(today?.caption ?? "");
      setNote(today?.note ?? "");
    } catch {
      /* offline */
    } finally {
      setReady(true);
    }
  }, [getToken, profile]);

  useEffect(() => {
    void load();
  }, [load, diet]);

  if (!diet || !diet.meals?.length) return null;

  const meals = diet.meals;
  const checks = (log?.mealChecks ?? []).filter(
    (c) => c.mealId || c.mealName
  );
  const followed = (i: number) =>
    checks.find(
      (c) =>
        (c.mealId && c.mealId === meals[i].id) ||
        (!c.mealId && c.mealName && c.mealName === meals[i].name)
    )?.followed ?? false;

  const toggle = async (i: number) => {
    if (busy) return;
    const nextChecks: MealCheck[] = meals.map((m, mi) => ({
      mealId: m.id,
      mealName: m.name,
      followed: mi === i ? !followed(mi) : followed(mi),
    }));
    setBusy(true);
    try {
      const token = await getToken();
      const updated = await api.putDietLog(
        {
          studentId: profile?.id,
          date: todayKey(),
          mealChecks: nextChecks,
          status: nextChecks.every((c) => c.followed)
            ? "followed"
            : nextChecks.some((c) => c.followed)
              ? "partial"
              : "not_followed",
          caption: caption || undefined,
          note: note || undefined,
        },
        token
      );
      setLog(updated);
    } catch {
      /* silencioso */
    } finally {
      setBusy(false);
    }
  };

  const allDone = meals.every((_, i) => followed(i));
  const anyDone = meals.some((_, i) => followed(i));

  return (
    <div className="nut-card" style={{ cursor: "default" }}>
      <div className="nut-card-title">
        Marcar refeições de hoje
        <span
          className={`diet-day-status ${log?.status ?? "not_followed"}`}
        >
          {log?.status === "followed"
            ? "✓ Dia seguido"
            : log?.status === "partial"
              ? "◐ Dia parcial"
              : "○ Dia não marcado"}
        </span>
      </div>
      <div className="nut-card-sub">
        Toque nas refeições conforme for cumprindo o plano.
      </div>
      <div className="diet-check-list">
        {meals.map((m, i) => (
          <button
            key={i}
            type="button"
            className={`diet-check-row ${followed(i) ? "done" : ""}`}
            onClick={() => void toggle(i)}
            disabled={busy}
          >
            <span className="diet-check-name">
              {m.time ? <i>{m.time}</i> : null} {m.name}
            </span>
            <span className="diet-check-mark">{followed(i) ? "✓" : "○"}</span>
          </button>
        ))}
      </div>
      <div className="frm-row" style={{ marginTop: 8 }}>
        <label className="frm-label">Legenda (publicada no feed)</label>
        <input
          type="text"
          placeholder="Ex.: Dia seguido à risca! 🥗"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
      <div className="frm-row" style={{ marginTop: 4 }}>
        <label className="frm-label">Observação (só para você e o nutricionista)</label>
        <textarea
          rows={2}
          placeholder="Dormi mal, comi fora… (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="btn-row">
        <button
          type="button"
          className={`btn-p ${allDone ? "" : "ghost"}`}
          disabled={busy || allDone}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              const token = await getToken();
              const updated = await api.putDietLog(
                {
                  studentId: profile?.id,
                  date: todayKey(),
                  mealChecks: meals.map((m) => ({
                    mealId: m.id,
                    mealName: m.name,
                    followed: true,
                  })),
                  status: "followed",
                  caption: caption || undefined,
                  note: note || undefined,
                },
                token
              );
              setLog(updated);
            } catch {
              /* silencioso */
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Salvando…" : allDone ? "✓ Dia completo" : "Marcar dia todo"}
        </button>
        {anyDone && (
          <button
            type="button"
            className="btn-s full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const token = await getToken();
                const updated = await api.putDietLog(
                  {
                    studentId: profile?.id,
                    date: todayKey(),
                    mealChecks: [],
                    status: "not_followed",
                    caption: "",
                    note: "",
                  },
                  token
                );
                setLog(updated);
                setCaption("");
                setNote("");
              } catch {
                /* silencioso */
              } finally {
                setBusy(false);
              }
            }}
          >
            Desmarcar dia
          </button>
        )}
      </div>
    </div>
  );
}