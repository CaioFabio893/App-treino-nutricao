"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Diet, WorkoutDefine, WorkoutHistoryEntry, HistoryExercise } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";

const WEEK_DAY_KEY: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const WEEK_DAY_LABEL: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

export default function StudentDashboard() {
  const { getToken, profile, logout } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Exercícios marcados como realizados no treino de hoje.
  const [done, setDone] = useState<Set<number>>(new Set());
  // Modal de conclusão: duração + séries executadas por exercício.
  const [modalFor, setModalFor] = useState<WorkoutDefine | null>(null);
  const [mDuration, setMDuration] = useState(60);
  const [mRows, setMRows] = useState<HistoryExercise[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const toggleDone = (i: number) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [w, d, h] = await Promise.all([
        api.listWorkouts(token),
        api.listDiets(token),
        api.listHistory(token),
      ]);
      setWorkouts(w);
      setDiets(d);
      setHistory(h);
    } catch {
      /* offline */
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Treino de hoje: pelo dia da semana.
  const todayWorkouts = useMemo(() => {
    const today = WEEK_DAY_KEY[new Date().getDay()];
    return workouts.filter((w) => w.dayOfWeek === today);
  }, [workouts]);

  // Treinos marcados para qualquer dia (fallback para listar todos).
  const scheduled = useMemo(() => {
    const byDay = new Map<string, WorkoutDefine[]>();
    for (const w of workouts) {
      const key = w.dayOfWeek || "other";
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(w);
    }
    return byDay;
  }, [workouts]);

  const todayDiet = diets.find(
    (d) =>
      (!d.startDate || d.startDate <= new Date().toISOString().slice(0, 10)) &&
      (!d.endDate || d.endDate >= new Date().toISOString().slice(0, 10))
  );

  const openComplete = (w: WorkoutDefine) => {
    const rows: HistoryExercise[] = (w.exercises ?? []).map((ex, i) => ({
      name: ex.name,
      order: ex.order ?? i,
      note: ex.notes,
      sets: Array.from({ length: ex.sets || 1 }, () => ({
        weight: ex.weight || "",
        reps: String(ex.repetitions ?? ""),
        done: done.has(i),
      })),
    }));
    setMRows(rows);
    setMDuration(60);
    setModalFor(w);
  };

  const finishComplete = async () => {
    const w = modalFor;
    if (!w || busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      const total = w.exercises?.length ?? 0;
      const exercisesCompleted = mRows.filter((ex) =>
        ex.sets?.some((s) => s.done)
      ).length;
      await api.completeWorkout(
        {
          workoutId: w.id!,
          duration: mDuration || 0,
          exercisesCompleted,
          totalExercises: total,
          exercises: mRows,
        },
        token
      );
      setModalFor(null);
      showToast("✓ Treino finalizado! Registrado no seu histórico.");
      void load();
    } catch {
      showToast("⚠ Falha ao finalizar treino.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <LoadingScreen />;

  const studentName = profile?.name || "Aluno";

  return (
    <div>
      <div className="nut-header">
        <div className="logo-wrap">
          <svg className="logo-svg" width="36" height="36" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="26" cy="7" rx="4" ry="2.5" fill="#7a8f4e" transform="rotate(-30 26 7)" />
            <ellipse cx="32" cy="6" rx="4" ry="2.5" fill="#5a6b3a" transform="rotate(20 32 6)" />
            <circle cx="30" cy="33" r="19" stroke="#c0622a" strokeWidth="2" fill="none" />
            <path d="M23 20 Q21 28 22 38 Q26 42 35 41" stroke="#c0622a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M22 38 Q30 35 37 37" stroke="#c0622a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
          <div className="logo-text">
            {studentName}
            <span>Seu treino</span>
          </div>
        </div>
        <div id="header-right">
          <button type="button" className="hbtn ghost" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>

      <div className="nut-main">
        <div className="page-head">
          <div>
            <h1>Treino de hoje</h1>
            <div className="page-sub">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </div>
          </div>
        </div>

        {todayWorkouts.length === 0 ? (
          <div className="empty-box">
            Nenhum treino agendado para hoje. Bora descansar ou veja a semana abaixo.
          </div>
        ) : (
          todayWorkouts.map((w) => (
            <div key={w.id} className="wod-box">
              <div className="wod-badge">{WEEK_DAY_LABEL[w.dayOfWeek!]}</div>
              <div className="wod-title">{w.name}</div>
              {w.objective && (
                <div style={{ fontSize: 12, color: "#ffe8d6", marginBottom: 8 }}>
                  Objetivo: {w.objective}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#ffe8d6", opacity: 0.85, marginBottom: 10 }}>
                Marque os exercícios que realizou: {done.size}/{w.exercises?.length ?? 0}
              </div>
              <ol className="ex-list" style={{ listStyle: "none", paddingLeft: 0 }}>
                {w.exercises?.map((ex, i) => (
                  <li
                    key={i}
                    onClick={() => toggleDone(i)}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.12)",
                      color: "#fff",
                      cursor: "pointer",
                      opacity: done.has(i) ? 0.55 : 1,
                      textDecoration: done.has(i) ? "line-through" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0" }}>
                      <input
                        type="checkbox"
                        checked={done.has(i)}
                        onChange={() => toggleDone(i)}
                        style={{ marginTop: 2, accentColor: "#7a8f4e", width: 18, height: 18 }}
                      />
                      <div>
                        <span className="ex-lbl" style={{ color: "#fff" }}>{ex.name}</span>
                        <div className="ex-desc" style={{ color: "#ffe8d6" }}>
                          {ex.sets} × {ex.repetitions}
                          {ex.weight ? ` · ${ex.weight}` : ""}
                          {ex.restSeconds ? ` · descanso ${ex.restSeconds}s` : ""}
                          {ex.notes ? ` · ${ex.notes}` : ""}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="btn-p"
                style={{ marginTop: 14, width: "100%", background: "var(--white)", color: "var(--terra)" }}
                disabled={busy}
                onClick={() => openComplete(w)}
              >
                {busy ? "Aguarde…" : "FINALIZAR TREINO"}
              </button>
            </div>
          ))
        )}

        {/* Semana */}
        <div className="section-label">Sua semana</div>
        <div className="cal-week">
          {Object.entries(WEEK_DAY_LABEL).map(([key, label]) => {
            const list = scheduled.get(key) ?? [];
            return (
              <div key={key} className={`cal-day ${list.length ? "has" : ""}`} title={list.map((w) => w.name).join(", ")}>
                <label>{label.slice(0, 3)}</label>
                {list.length ? list[0].name.replace(/^Treino\s*\w*\s*[—-]\s*/, "").slice(0, 7) : "—"}
              </div>
            );
          })}
        </div>

        {/* Dieta */}
        <div className="section-label">Sua dieta</div>
        {todayDiet ? (
          <div className="nut-card" style={{ cursor: "default" }}>
            <div className="nut-card-title">{todayDiet.name}</div>
            <div className="nut-card-sub">
              {todayDiet.description || ""}
              {todayDiet.startDate
                ? ` · ${todayDiet.startDate} → ${todayDiet.endDate || "..."}`
                : ""}
            </div>
            {todayDiet.meals?.map((meal, mi) => (
              <div key={mi} className="diet-meal" style={{ marginTop: 10, boxShadow: "none" }}>
                <div className="diet-meal-head">
                  <b>{meal.name}</b>
                  <span>{meal.time || "—"}</span>
                </div>
                {meal.foods?.map((f, fi) => (
                  <div key={fi} style={{ fontSize: 12, color: "var(--text)", padding: "2px 0" }}>
                    • {f.name} — {f.quantity || ""} {f.unit}
                    {f.notes ? ` (${f.notes})` : ""}
                  </div>
                ))}
                {meal.notes && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {meal.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-box">Nenhuma dieta ativa no momento.</div>
        )}

        {/* Histórico do aluno */}
        <div className="section-label">Seu histórico</div>
        {history.length === 0 ? (
          <div className="empty-box">
            Você ainda não concluiu nenhum treino. Ao finalizar, aparece aqui.
          </div>
        ) : (
          <div className="timeline">
            {history.slice(0, 6).map((h) => {
              const w = workouts.find((x) => x.id === h.workoutId);
              const when = h.completedAt
                ? new Date(h.completedAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <div key={h.id} className="tl-item">
                  <div className="tl-date">{when}</div>
                  <div className="tl-text">
                    <b>{w?.name ?? "Treino"}</b> concluído
                    {h.duration ? ` em ${h.duration} min` : ""} —{" "}
                    {h.exercisesCompleted}/{h.totalExercises} exercícios
                  </div>
                  {h.exercises && h.exercises.length > 0 && (
                    <div className="tl-exercises">
                      {h.exercises.map((ex) => (
                        <span key={ex.order} className="tl-ex-chip">
                          {ex.name}
                          {ex.sets?.length
                            ? ` · ${ex.sets.filter((s) => s.done).length}/${ex.sets.length}`
                            : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {toast && <div id="toast" className="show">{toast}</div>}

        {/* Modal: finalizar treino com séries executadas */}
        {modalFor && (
          <div className="modal-bg open" onClick={(e) => e.target === e.currentTarget && !busy && setModalFor(null)}>
            <div className="modal-box" style={{ maxHeight: "85vh", overflowY: "auto" }}>
              <div className="modal-handle" />
              <div className="modal-title">Finalizar: {modalFor.name}</div>
              <div className="frm-row" style={{ marginTop: 8 }}>
                <label className="frm-label">Duração (minutos)</label>
                <input
                  type="number"
                  min={1}
                  value={mDuration}
                  onChange={(e) => setMDuration(Number(e.target.value) || 0)}
                />
              </div>
              <div className="section-label" style={{ marginTop: 10 }}>
                Séries executadas
              </div>
              {mRows.map((ex, i) => {
                const anyDone = ex.sets?.some((s) => s.done);
                return (
                  <div
                    key={i}
                    className="wod-box"
                    style={{
                      marginBottom: 8,
                      opacity: anyDone ? 1 : 0.6,
                      background: "var(--terra)",
                    }}
                  >
                    <div className="wod-title" style={{ fontSize: 12.5 }}>
                      {ex.name}
                    </div>
                    <div className="set-list">
                      {ex.sets?.map((s, si) => (
                        <div key={si} className="set-row">
                          <input
                            type="checkbox"
                            checked={s.done}
                            onChange={() => {
                              const next = [...mRows];
                              next[i] = {
                                ...ex,
                                sets: ex.sets?.map((x, xi) =>
                                  xi === si ? { ...x, done: !x.done } : x
                                ),
                              };
                              setMRows(next);
                            }}
                            style={{ accentColor: "#7a8f4e" }}
                          />
                          <span className="set-lbl">Série {si + 1}</span>
                          <input
                            type="text"
                            placeholder="Peso"
                            value={s.weight || ""}
                            onChange={(ev) => {
                              const next = [...mRows];
                              next[i] = {
                                ...ex,
                                sets: ex.sets?.map((x, xi) =>
                                  xi === si ? { ...x, weight: ev.target.value } : x
                                ),
                              };
                              setMRows(next);
                            }}
                            style={{ width: 64 }}
                          />
                          <input
                            type="text"
                            placeholder="Reps"
                            value={s.reps || ""}
                            onChange={(ev) => {
                              const next = [...mRows];
                              next[i] = {
                                ...ex,
                                sets: ex.sets?.map((x, xi) =>
                                  xi === si ? { ...x, reps: ev.target.value } : x
                                ),
                              };
                              setMRows(next);
                            }}
                            style={{ width: 52 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="modal-acts">
                <button
                  type="button"
                  className="btn-p"
                  disabled={busy}
                  onClick={() => void finishComplete()}
                >
                  {busy ? "Salvando…" : "Salvar e finalizar"}
                </button>
                <button
                  type="button"
                  className="btn-s full"
                  disabled={busy}
                  onClick={() => setModalFor(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}