"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Diet, UserProfile, WorkoutDefine } from "@/lib/types";
import { Skeleton } from "@/components/Skeleton";

const WEEK_DAY_LABEL: Record<string, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};
const WEEK_DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function PrintPage() {
  return (
    <Suspense fallback={<PrintSkeleton />}>
      <PrintInner />
    </Suspense>
  );
}

function PrintSkeleton() {
  return (
    <div className="print-page" role="status" aria-label="Carregando…">
      <div className="print-card">
        <Skeleton width={160} height={13} />
        <div style={{ marginTop: 10 }}>
          <Skeleton width="60%" height={22} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Skeleton height={16} width="92%" />
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} width="87%" />
          <Skeleton height={16} width="70%" />
        </div>
      </div>
    </div>
  );
}

function PrintInner() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutId = searchParams.get("workout") || "";
  const dietId = searchParams.get("diet") || "";
  // Plano semanal do aluno: /print?student=<id> (treinos por dia + dietas)
  const studentId = searchParams.get("student") || "";

  const [workout, setWorkout] = useState<WorkoutDefine | null>(null);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [student, setStudent] = useState<UserProfile | null>(null);
  const [planWorkouts, setPlanWorkouts] = useState<WorkoutDefine[]>([]);
  const [planDiets, setPlanDiets] = useState<Diet[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (studentId) {
        const [s, ws, ds] = await Promise.all([
          api.getStudent(studentId, token),
          api.listWorkouts(token),
          api.listDiets(token),
        ]);
        setStudent(s);
        setPlanWorkouts(ws.filter((w) => w.studentId === studentId));
        setPlanDiets(ds.filter((d) => d.studentId === studentId));
      } else if (workoutId) {
        const w = await api.getWorkout(workoutId, token);
        setWorkout(w);
        const s = await api.getStudent(w.studentId, token);
        setStudent(s);
      } else if (dietId) {
        const d = await api.getDiet(dietId, token);
        setDiet(d);
        const s = await api.getStudent(d.studentId, token);
        setStudent(s);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setReady(true);
    }
  }, [getToken, workoutId, dietId, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPlan = planWorkouts.length > 0 || planDiets.length > 0;

  useEffect(() => {
    // Imprime automaticamente depois que carrega.
    if (ready && (workout || diet || hasPlan)) {
      const t = window.setTimeout(() => window.print(), 300);
      return () => window.clearTimeout(t);
    }
  }, [ready, workout, diet, hasPlan]);

  if (!ready) return <PrintSkeleton />;

  const workoutsByDay = (day: string) =>
    planWorkouts.filter((w) => w.dayOfWeek === day);
  const freeWorkouts = planWorkouts.filter((w) => !w.dayOfWeek);

  return (
    <div className="print-page">
      <div className="print-actions no-print">
        <button type="button" className="btn-sm" onClick={() => router.back()}>
          ‹ Voltar
        </button>
        <button type="button" className="btn-sm acc" onClick={() => window.print()}>
          🖨 Imprimir
        </button>
      </div>

      {error && <div className="err-text no-print">{error}</div>}

      {!workout && !diet && !hasPlan && (
        <div className="empty-box no-print">Nada para imprimir.</div>
      )}

      {/* Treino individual */}
      {workout && (
        <div className="print-card">
          <div className="print-head">
            <div className="print-logo">💪 Treino Louise</div>
            <div className="print-title">{workout.name}</div>
            {workout.objective && (
              <div className="print-sub">Objetivo: {workout.objective}</div>
            )}
            <div className="print-meta">
              Aluno: <b>{student?.name || workout.studentId}</b>
              {workout.dayOfWeek
                ? ` · Dia: ${WEEK_DAY_LABEL[workout.dayOfWeek] || workout.dayOfWeek}`
                : ""}
            </div>
            {workout.description && (
              <div className="print-desc">{workout.description}</div>
            )}
          </div>
          <PrintExercises workout={workout} />
        </div>
      )}

      {/* Dieta individual */}
      {diet && (
        <div className="print-card">
          <div className="print-head">
            <div className="print-logo">🥗 Nutrição</div>
            <div className="print-title">{diet.name}</div>
            {diet.description && <div className="print-sub">{diet.description}</div>}
            <div className="print-meta">
              Aluno: <b>{student?.name || diet.studentId}</b>
              {diet.startDate
                ? ` · ${diet.startDate} → ${diet.endDate || "..."}`
                : ""}
            </div>
          </div>
          <PrintMeals diet={diet} />
        </div>
      )}

      {/* Plano semanal do aluno: treinos agrupados por dia + dietas */}
      {!workout && !diet && hasPlan && (
        <>
          <div className="print-card">
            <div className="print-head">
              <div className="print-logo">💪 Treino Louise</div>
              <div className="print-title">Plano semanal</div>
              {student && <div className="print-sub">Aluno: {student.name}</div>}
              <div className="print-meta">
                {new Date().toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            </div>

            {planWorkouts.length === 0 && (
              <div className="print-ex">Nenhum treino cadastrado.</div>
            )}

            {WEEK_DAY_ORDER.map((day) => {
              const dayWorkouts = workoutsByDay(day);
              if (dayWorkouts.length === 0) return null;
              return (
                <div key={day} className="print-day">
                  <div className="print-day-head">{WEEK_DAY_LABEL[day]}</div>
                  {dayWorkouts.map((w) => (
                    <div key={w.id} className="print-day-workout">
                      <div className="print-ex-name">🏋 {w.name}</div>
                      {w.objective && (
                        <div className="print-ex-meta">Objetivo: {w.objective}</div>
                      )}
                      {w.description && (
                        <div className="print-ex-note">{w.description}</div>
                      )}
                      <PrintExercises workout={w} nested />
                    </div>
                  ))}
                </div>
              );
            })}

            {freeWorkouts.length > 0 && (
              <div className="print-day">
                <div className="print-day-head">Dia livre / plano livre</div>
                {freeWorkouts.map((w) => (
                  <div key={w.id} className="print-day-workout">
                    <div className="print-ex-name">🏋 {w.name}</div>
                    {w.objective && (
                      <div className="print-ex-meta">Objetivo: {w.objective}</div>
                    )}
                    <PrintExercises workout={w} nested />
                  </div>
                ))}
              </div>
            )}
          </div>

          {planDiets.map((d) => (
            <div key={d.id} className="print-card">
              <div className="print-head">
                <div className="print-logo">🥗 Nutrição</div>
                <div className="print-title">{d.name}</div>
                {d.description && <div className="print-sub">{d.description}</div>}
              </div>
              <PrintMeals diet={d} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function PrintExercises({
  workout,
  nested = false,
}: {
  workout: WorkoutDefine;
  nested?: boolean;
}) {
  return (
    <>
      {workout.exercises?.map((ex, i) => (
        <div key={i} className="print-ex">
          <div className="print-ex-name">
            {i + 1}. {ex.name}
          </div>
          <div className="print-ex-meta">
            {ex.sets} séries × {ex.repetitions}
            {ex.weight ? ` · ${ex.weight}` : ""}
            {ex.restSeconds ? ` · ${ex.restSeconds}s descanso` : ""}
          </div>
          {ex.description && <div className="print-ex-note">{ex.description}</div>}
          {ex.notes && <div className="print-ex-note">Obs: {ex.notes}</div>}
        </div>
      ))}
      {nested && (workout.exercises?.length ?? 0) > 0 && (
        <div className="print-tick" />
      )}
    </>
  );
}

function PrintMeals({ diet }: { diet: Diet }) {
  return (
    <>
      {diet.meals?.map((meal, mi) => (
        <div key={mi} className="print-meal">
          <div className="print-meal-head">
            <b>{meal.name}</b>
            <span>{meal.time || "—"}</span>
          </div>
          {meal.foods?.map((f, fi) => (
            <div key={fi} className="print-food">
              • {f.name} — {f.quantity || ""} {f.unit}
              {f.notes ? ` (${f.notes})` : ""}
            </div>
          ))}
          {meal.notes && <div className="print-ex-note">Obs: {meal.notes}</div>}
        </div>
      ))}
    </>
  );
}