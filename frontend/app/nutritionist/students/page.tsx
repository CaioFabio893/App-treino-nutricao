"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Diet, UserProfile, WorkoutDefine, WorkoutHistoryEntry } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";

export default function StudentsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <StudentsInner />
    </Suspense>
  );
}

function StudentsInner() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [list, w, d, h] = await Promise.all([
        api.listStudents(token),
        api.listWorkouts(token),
        api.listDiets(token),
        api.listHistory(token),
      ]);
      setStudents(list);
      setWorkouts(w);
      setDiets(d);
      setHistory(h);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar alunos");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Stats por aluno.
  const statsFor = (id: string) => {
    const w = workouts.filter((x) => x.studentId === id);
    const d = diets.filter((x) => x.studentId === id);
    const h = history.filter((x) => x.studentId === id);
    const today = new Date().toISOString().slice(0, 10);
    const currentDiet = d.find(
      (x) => (!x.startDate || x.startDate <= today) && (!x.endDate || x.endDate >= today)
    );
    const last = h[0] ?? null;
    const lastWorkoutName = last
      ? w.find((x) => x.id === last.workoutId)?.name ?? "Treino"
      : null;
    return { workoutCount: w.length, currentDiet: currentDiet?.name ?? null, lastWorkoutName, lastDate: last?.completedAt ?? null };
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    );
  }, [students, query]);

  if (!ready) return <LoadingScreen />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Meus Alunos</h1>
          <div className="page-sub">{students.length} aluno(s) vinculado(s) a você</div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      <div className="frm-row" style={{ maxWidth: 360 }}>
        <input
          type="search"
          placeholder="Buscar aluno por nome ou e-mail…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-box">
          {query
            ? "Nenhum aluno encontrado com essa busca."
            : "Nenhum aluno vinculado ainda."}
          <div className="btn-row">
            <button
              type="button"
              className="btn-sm"
              onClick={() => router.push("/nutritionist/workouts")}
            >
              Ir para Treinos
            </button>
          </div>
        </div>
      ) : (
        filtered.map((s) => {
          const stats = statsFor(s.id);
          return (
            <div
              key={s.id}
              className="nut-card"
              onClick={() => router.push(`/nutritionist/students/${s.id}`)}
            >
              <div className="nut-card-head">
                <div className="avatar">
                  {s.photoURL ? (
                    <img src={s.photoURL} alt={s.name} />
                  ) : (
                    s.name?.charAt(0)?.toUpperCase() || "?"
                  )}
                </div>
                <div>
                  <div className="nut-card-title">{s.name || "Sem nome"}</div>
                  <div className="nut-card-sub">{s.email}</div>
                </div>
              </div>
              <div className="nut-meta">
                <span className={`badge ${s.status || ""}`}>{s.status || "active"}</span>
                {s.startDate && <span className="badge">Início: {s.startDate}</span>}
                {s.endDate && <span className="badge">Término: {s.endDate}</span>}
                <span className="badge">{stats.workoutCount} treinos</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
                <div>🥗 Dieta atual: <b style={{ color: "var(--text)" }}>{stats.currentDiet ?? "—"}</b></div>
                <div>🏋 Último treino: <b style={{ color: "var(--text)" }}>
                  {stats.lastWorkoutName
                    ? `${stats.lastWorkoutName}${stats.lastDate ? ` · ${new Date(stats.lastDate).toLocaleDateString("pt-BR")}` : ""}`
                    : "—"}
                </b></div>
              </div>
              <div className="btn-row">
                <button type="button" className="btn-sm acc">
                  Ver perfil
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}