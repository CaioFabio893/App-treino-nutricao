"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine, Diet, WorkoutHistoryEntry } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";
import { useNewCompletions } from "@/lib/useNewCompletions";

interface Stats {
  students: UserProfile[];
  workouts: WorkoutDefine[];
  diets: Diet[];
  history: WorkoutHistoryEntry[];
}

const empty: Stats = { students: [], workouts: [], diets: [], history: [] };

export default function NutritionistDashboard() {
  const { getToken, profile } = useAuth();
  const router = useRouter();
  const { count, consume } = useNewCompletions();
  const [data, setData] = useState<Stats>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [students, workouts, diets, history] = await Promise.all([
        api.listStudents(token),
        api.listWorkouts(token),
        api.listDiets(token),
        api.listHistory(token),
      ]);
      setData({ students, workouts, diets, history });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <LoadingScreen />;

  const activeStudents = data.students.filter((s) => s.status === "active").length;

  // Últimos 5 eventos (treinos concluídos).
  const recent = data.history.slice(0, 5);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Painel</h1>
          <div className="page-sub">
            {profile?.name ? `Olá, ${profile.name}.` : "Bem-vindo."} Resumo da sua gestão:
          </div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      {count > 0 && (
        <button
          type="button"
          className="notif-banner"
          onClick={() => {
            consume();
            router.push("/nutritionist/timeline");
          }}
        >
          🔔 {count} novo(s) treino(s) concluído(s) desde a sua última visita —
          clique para ver na Timeline.
        </button>
      )}

      <div className="stat-grid">
        <div className="stat-cell">
          <div className="stat-num">{data.students.length}</div>
          <div className="stat-lbl">Alunos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{activeStudents}</div>
          <div className="stat-lbl">Ativos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{data.workouts.length}</div>
          <div className="stat-lbl">Treinos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{data.diets.length}</div>
          <div className="stat-lbl">Dietas</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{data.history.length}</div>
          <div className="stat-lbl">Concluídos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">
            {data.history.length
              ? Math.round(
                  data.history.reduce((a, b) => a + (b.duration || 0), 0) /
                    data.history.length
                )
              : 0}
          </div>
          <div className="stat-lbl">Duração média (min)</div>
        </div>
      </div>

      <div className="section-label">Atalhos</div>
      <Link href="/nutritionist/students" className="nut-card">
        <div className="nut-card-head">
          <div className="avatar">👥</div>
          <div>
            <div className="nut-card-title">Meus Alunos</div>
            <div className="nut-card-sub">Ver alunos, treinos e dietas de cada um</div>
          </div>
        </div>
      </Link>
      <Link href="/nutritionist/workouts" className="nut-card">
        <div className="nut-card-head">
          <div className="avatar">🏋</div>
          <div>
            <div className="nut-card-title">Treinos</div>
            <div className="nut-card-sub">Criar e gerenciar treinos dos alunos</div>
          </div>
        </div>
      </Link>
      <Link href="/nutritionist/diets" className="nut-card">
        <div className="nut-card-head">
          <div className="avatar">🥗</div>
          <div>
            <div className="nut-card-title">Dietas</div>
            <div className="nut-card-sub">Criar e gerenciar planos alimentares</div>
          </div>
        </div>
      </Link>

      <div className="section-label">Atividade recente</div>
      {recent.length === 0 ? (
        <div className="empty-box">Nenhum treino concluído ainda.</div>
      ) : (
        <div className="timeline">
          {recent.map((h) => {
            const student = data.students.find((s) => s.id === h.studentId);
            const workout = data.workouts.find((w) => w.id === h.workoutId);
            const when = h.completedAt
              ? new Date(h.completedAt).toLocaleDateString("pt-BR")
              : "—";
            return (
              <div key={h.id} className="tl-item">
                <div className="tl-date">{when}</div>
                <div className="tl-text">
                  <b>{student?.name ?? "Aluno"}</b> concluiu{" "}
                  <b>{workout?.name ?? "treino"}</b>
                  {h.duration ? ` em ${h.duration} min` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}