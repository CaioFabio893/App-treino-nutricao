"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Diet, UserProfile, WorkoutDefine } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";

const WEEK_DAY_LABEL: Record<string, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};

export default function PrintPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PrintInner />
    </Suspense>
  );
}

function PrintInner() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutId = searchParams.get("workout") || "";
  const dietId = searchParams.get("diet") || "";

  const [workout, setWorkout] = useState<WorkoutDefine | null>(null);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [student, setStudent] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (workoutId) {
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
  }, [getToken, workoutId, dietId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Imprime automaticamente depois que carrega.
    if (ready && (workout || diet)) {
      const t = window.setTimeout(() => window.print(), 300);
      return () => window.clearTimeout(t);
    }
  }, [ready, workout, diet]);

  if (!ready) return <LoadingScreen />;

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

      {!workout && !diet && (
        <div className="empty-box no-print">Nada para imprimir.</div>
      )}

      {/* Treino */}
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
        </div>
      )}

      {/* Dieta */}
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
        </div>
      )}
    </div>
  );
}