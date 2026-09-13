"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type {
  Diet,
  WorkoutDefine,
  WorkoutHistoryEntry,
} from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";
import DietCheck from "./DietCheck";
import Feed from "./Feed";
import Ranking from "./Ranking";
import TodayWorkout from "./TodayWorkout";

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

type Tab = "treinos" | "dietas" | "comunidade";

export default function StudentDashboard() {
  const { getToken, profile, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("treinos");
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Treino escolhido pelo aluno: ele decide, não fica preso ao dia da semana.
  const [selectedId, setSelectedId] = useState<string>("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [w, d, h] = await Promise.all([
        api.listWorkouts(token),
        api.listDiets(token),
        api.listHistory(token),
      ]);
      setWorkouts(w.filter((x) => x.studentId === (profile?.id ?? "")));
      setDiets(d.filter((x) => x.studentId === (profile?.id ?? "")));
      setHistory(h);
    } catch {
      /* offline */
    } finally {
      setReady(true);
    }
  }, [getToken, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  // Treino de hoje: pelo dia da semana (só usado como padrão).
  const todayWorkouts = useMemo(() => {
    const today = WEEK_DAY_KEY[new Date().getDay()];
    return workouts.filter((w) => w.dayOfWeek === today);
  }, [workouts]);

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

  const todayDiet = diets.find(
    (d) =>
      (!d.startDate || d.startDate <= new Date().toISOString().slice(0, 10)) &&
      (!d.endDate || d.endDate >= new Date().toISOString().slice(0, 10))
  );

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
            <span>Seu espaço</span>
          </div>
        </div>
        <div id="header-right">
          <button type="button" className="hbtn ghost" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>

      <div className="student-tabs">
        {(
          [
            { id: "treinos", label: "🏋 Treinos" },
            { id: "dietas", label: "🥗 Dietas" },
            { id: "comunidade", label: "💬 Comunidade" },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`student-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="nut-main">
        {tab === "treinos" && (
          <div>
            <div className="page-head">
              <div>
                <h1>Seus treinos</h1>
                <div className="page-sub">
                  {new Date().toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </div>
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
                    const isToday =
                      w.dayOfWeek === WEEK_DAY_KEY[new Date().getDay()];
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
          </div>
        )}

        {tab === "dietas" && (
          <div>
            <div className="page-head">
              <div>
                <h1>Sua dieta</h1>
                <div className="page-sub">
                  {new Date().toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </div>
              </div>
            </div>

            {todayDiet ? (
              <>
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
                <div className="section-label">Acompanhamento de hoje</div>
                <DietCheck diet={todayDiet} />
              </>
            ) : (
              <div className="empty-box">
                Nenhuma dieta ativa no momento. Quando seu nutricionista cadastrar,
                aparece aqui.
              </div>
            )}
          </div>
        )}

        {tab === "comunidade" && (
          <div>
            <div className="page-head">
              <div>
                <h1>Comunidade</h1>
                <div className="page-sub">Feed e ranking do ciclo — muita gente treinando junto!</div>
              </div>
            </div>
            <div className="section-label">Classificação do ciclo</div>
            <Ranking />
            <div className="section-label" style={{ marginTop: 18 }}>Feed</div>
            <Feed />
          </div>
        )}

        {toast && <div id="toast" className="show">{toast}</div>}
      </div>
    </div>
  );
}