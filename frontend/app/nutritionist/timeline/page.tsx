"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine, WorkoutHistoryEntry } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";

export default function TimelinePage() {
  const { getToken } = useAuth();
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [h, w, s] = await Promise.all([
        api.listHistory(token),
        api.listWorkouts(token),
        api.listStudents(token),
      ]);
      setHistory(h);
      setWorkouts(w);
      setStudents(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar timeline");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <LoadingScreen />;

  const studentName = (id: string) => students.find((s) => s.id === id)?.name || id.slice(0, 8);
  const workoutName = (id: string) => workouts.find((w) => w.id === id)?.name || "Treino";

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Timeline</h1>
          <div className="page-sub">Atividades de todos os seus alunos</div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      {history.length === 0 ? (
        <div className="empty-box">
          Nenhuma atividade registrada ainda. Quando seus alunos concluírem
          treinos, eles aparecem aqui.
        </div>
      ) : (
        <div className="timeline">
          {history.map((h) => {
            const when = h.completedAt
              ? new Date(h.completedAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "";
            return (
              <div key={h.id} className="tl-item">
                <div className="tl-date">{when}</div>
                <div className="tl-text">
                  <Link
                    href={`/nutritionist/students/${h.studentId}`}
                    style={{ color: "var(--terra)", fontWeight: 600, textDecoration: "none" }}
                  >
                    {studentName(h.studentId)}
                  </Link>{" "}
                  concluiu <b>{workoutName(h.workoutId)}</b>
                  {h.duration ? ` em ${h.duration} min` : ""} — {h.exercisesCompleted}/
                  {h.totalExercises} exercícios.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}