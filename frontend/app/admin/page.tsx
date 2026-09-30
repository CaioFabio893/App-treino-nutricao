"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine, Diet } from "@/lib/types";
import { DashboardSkeleton } from "@/components/Skeleton";

interface Stats {
  students: UserProfile[];
  workouts: WorkoutDefine[];
  diets: Diet[];
}

const empty: Stats = { students: [], workouts: [], diets: [] };

export default function AdminDashboard() {
  const { getToken, profile } = useAuth();
  const [data, setData] = useState<Stats>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [students, workouts, diets] = await Promise.all([
        api.listStudents(token),
        api.listWorkouts(token),
        api.listDiets(token),
      ]);
      setData({ students, workouts, diets });
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

  if (!ready) return <DashboardSkeleton />;

  const activeStudents = data.students.filter((s) => s.status === "active").length;


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
      </div>

      <div className="section-label">Atalhos</div>
      <Link href="/admin/students" className="nut-card">
        <div className="nut-card-head">
          <div className="avatar">👥</div>
          <div>
            <div className="nut-card-title">Meus Alunos</div>
            <div className="nut-card-sub">Ver alunos, treinos e dietas de cada um</div>
          </div>
        </div>
      </Link>
      <Link href="/admin/workouts" className="nut-card">
        <div className="nut-card-head">
          <div className="avatar">🏋</div>
          <div>
            <div className="nut-card-title">Treinos</div>
            <div className="nut-card-sub">Criar e gerenciar treinos dos alunos</div>
          </div>
        </div>
      </Link>
      <Link href="/admin/diets" className="nut-card">
        <div className="nut-card-head">
          <div className="avatar">🥗</div>
          <div>
            <div className="nut-card-title">Dietas</div>
            <div className="nut-card-sub">Criar e gerenciar planos alimentares</div>
          </div>
        </div>
      </Link>

    </div>
  );
}
