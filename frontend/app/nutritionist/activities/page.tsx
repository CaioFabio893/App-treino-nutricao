"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine, WorkoutHistoryEntry } from "@/lib/types";
import { ActivitiesSkeleton } from "@/components/Skeleton";

export default function ActivitiesPage() {
  const { getToken } = useAuth();
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [filter, setFilter] = useState(""); // "" = todos
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
      setError(e instanceof Error ? e.message : "Falha ao carregar atividades");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter ? history.filter((h) => h.studentId === filter) : history),
    [history, filter]
  );

  // Estatísticas por aluno.
  const perStudent = useMemo(() => {
    return students
      .map((s) => {
        const h = history.filter((x) => x.studentId === s.id);
        const total = h.length;
        const avgPct = total
          ? Math.round(
              h.reduce((acc, x) => acc + (x.exercisesCompleted / Math.max(x.totalExercises, 1)), 0) /
                total *
                100
            )
          : 0;
        const avgDuration = total
          ? Math.round(h.reduce((acc, x) => acc + (x.duration || 0), 0) / total)
          : 0;
        return { student: s, total, avgPct, avgDuration };
      })
      .sort((a, b) => b.total - a.total);
  }, [students, history]);

  if (!ready) return <ActivitiesSkeleton />;

  const studentName = (id: string) => students.find((s) => s.id === id)?.name || id.slice(0, 8);
  const workoutName = (id: string) => workouts.find((w) => w.id === id)?.name || "Treino";

  // Exporta o log filtrado em CSV (separador ; e BOM para o Excel pt-BR).
  const exportCSV = () => {
    const rows: string[][] = [
      ["Aluno", "Treino", "Data", "Duração (min)", "Exercícios", "% concluído"],
      ...visible.map((h) => [
        studentName(h.studentId),
        workoutName(h.workoutId),
        h.completedAt ? new Date(h.completedAt).toLocaleString("pt-BR") : "",
        String(h.duration || ""),
        `${h.exercisesCompleted}/${h.totalExercises}`,
        h.totalExercises
          ? Math.round((h.exercisesCompleted / h.totalExercises) * 100) + "%"
          : "0%",
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atividades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Atividades</h1>
          <div className="page-sub">
            Conclusões de treino dos seus alunos e estatísticas de adesão.
          </div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      {/* Estatísticas por aluno */}
      <div className="section-label">Adesão por aluno</div>
      <div className="stat-grid">
        <div className="stat-cell">
          <div className="stat-num">{history.length}</div>
          <div className="stat-lbl">Treinos concluídos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">
            {perStudent.length
              ? Math.round(
                  perStudent.reduce((a, b) => a + b.avgPct, 0) / perStudent.length
                )
              : 0}%
          </div>
          <div className="stat-lbl">Conclusão média</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">
            {history.length
              ? Math.round(history.reduce((a, b) => a + (b.duration || 0), 0) / history.length)
              : 0}
          </div>
          <div className="stat-lbl">Duração média (min)</div>
        </div>
      </div>

      {perStudent.map(({ student, total, avgPct, avgDuration }) => (
        <div key={student.id} className="nut-card">
          <div className="nut-card-head">
            <div className="avatar">
              {student.photoURL ? (
                <img src={student.photoURL} alt={student.name} />
              ) : (
                student.name?.charAt(0)?.toUpperCase() || "?"
              )}
            </div>
            <div>
              <Link
                href={`/nutritionist/students/${student.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <div className="nut-card-title">{student.name || "Sem nome"}</div>
              </Link>
              <div className="nut-card-sub">
                {total} treino(s) concluído(s) · {avgPct}% dos exercícios · média{" "}
                {avgDuration} min
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Feed com filtro */}
      <div className="section-label" style={{ marginBottom: 10 }}>
        Log de atividades
        <button
          type="button"
          className="btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={exportCSV}
          disabled={visible.length === 0}
        >
          ⬇ Exportar CSV
        </button>
      </div>
      <div className="frm-row" style={{ maxWidth: 300 }}>
        <label>Filtrar por aluno</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos os alunos</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.id}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="empty-box">
          Nenhuma atividade registrada. Quando um aluno concluir um treino, aparece aqui.
        </div>
      ) : (
        <div className="timeline">
          {visible.map((h) => {
            const when = h.completedAt
              ? new Date(h.completedAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            return (
              <div key={h.id} className="tl-item">
                <div className="tl-date">{when}</div>
                <div className="tl-text">
                  <b>{studentName(h.studentId)}</b> concluiu{" "}
                  <b>{workoutName(h.workoutId)}</b>
                  {h.duration ? ` em ${h.duration} min` : ""} — {h.exercisesCompleted}/
                  {h.totalExercises} exercícios
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}