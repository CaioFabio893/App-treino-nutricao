"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { WorkoutDefine, WorkoutHistoryEntry } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";
import TodayWorkout from "@/components/TodayWorkout";
import LoadError from "@/components/LoadError";
import { WEEK_DAY_KEY, WEEK_DAY_LABEL, todayDateLabel } from "@/lib/days";

/** Página "Treinos" do aluno: escolha do treino, semana e histórico. */
export default function StudentWorkoutsPage() {
  const { getToken, profile } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Treino escolhido pelo aluno: ele decide, não fica preso ao dia da semana.
  const [selectedId, setSelectedId] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [w, h] = await Promise.all([
        api.listWorkouts(token),
        api.listHistory(token),
      ]);
      setWorkouts(w.filter((x) => x.studentId === (profile?.id ?? "")));
      setHistory(h);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, [getToken, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const todayKey = WEEK_DAY_KEY[new Date().getDay()];
  const todayWorkouts = useMemo(
    () => workouts.filter((w) => w.dayOfWeek === todayKey),
    [workouts, todayKey]
  );

  // Treino ativo: o que o aluno escolheu, ou "o de hoje" como padrão.
  const activeWorkout = useMemo(
    () =>
      workouts.find((w) => w.id === selectedId) ??
      todayWorkouts[0] ??
      workouts[0],
    [workouts, selectedId, todayWorkouts]
  );

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

  if (!ready) return <LoadingScreen />;

  if (loadError) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Seus treinos</h1>
            <div className="page-sub">{todayDateLabel()}</div>
          </div>
        </div>
        <LoadError
          message="Não foi possível carregar seus treinos."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Seus treinos</h1>
          <div className="page-sub">{todayDateLabel()}</div>
        </div>
      </div>

      {workouts.length === 0 ? (
        <div className="empty-box">
          Nenhum treino cadastrado para você ainda. Quando seu nutricionista criar,
          aparece aqui e você escolhe o que quiser treinar.
        </div>
      ) : (
        <>
          <div className="section-label">Escolha o treino de hoje</div>
          <div className="wod-picker">
            {workouts.map((w) => {
              const active = w.id === activeWorkout?.id;
              const isToday = w.dayOfWeek === todayKey;
              return (
                <button
                  key={w.id}
                  type="button"
                  className={`wod-chip ${active ? "active" : ""} ${
                    isToday && !active ? "today" : ""
                  }`}
                  onClick={() => setSelectedId(w.id!)}
                >
                  <b>{w.name}</b>
                  <span>
                    {w.dayOfWeek ? WEEK_DAY_LABEL[w.dayOfWeek] : "Livre"}
                    {isToday ? " · hoje" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {activeWorkout && (
            <TodayWorkout
              key={activeWorkout.id}
              workout={activeWorkout}
              history={history}
              getToken={getToken}
              onToast={showToast}
              onCompleted={() => void load()}
            />
          )}
        </>
      )}

      {/* Semana */}
      <div className="section-label">Sua semana</div>
      <div className="stu-week">
        {Object.entries(WEEK_DAY_LABEL).map(([key, label]) => {
          const list = scheduled.get(key) ?? [];
          const names = list.map((w) =>
            w.name.replace(/^Treino\s*\w*\s*[—-]\s*/, "")
          );
          return (
            <div
              key={key}
              className={`stu-week-day${list.length ? " has" : ""}`}
              title={names.join(", ") || undefined}
            >
              <label>{label.slice(0, 3)}</label>
              {list.length ? (
                <span className="name">{names.join(", ")}</span>
              ) : (
                <span className="empty">—</span>
              )}
            </div>
          );
        })}
      </div>

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
                  <b>{h.workoutName || w?.name || "Treino"}</b> concluído
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
    </div>
  );
}