"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Diet, UserProfile, WorkoutDefine, WorkoutHistoryEntry } from "@/lib/types";
import { ProfileSkeleton } from "@/components/Skeleton";

export default function ProfilePage() {
  const { user, profile, getToken, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setName(profile?.name ?? "");
    setEmail(profile?.email ?? (user as { email?: string })?.email ?? "");
  }, [profile, user]);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [s, w, d, h] = await Promise.all([
        api.listStudents(token),
        api.listWorkouts(token),
        api.listDiets(token),
        api.listHistory(token),
      ]);
      setStudents(s);
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

  const save = async () => {
    if (!user || busy) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const token = await getToken();
      await api.putMe(
        {
          id: (user as { uid?: string }).uid || "",
          name: name.trim(),
          email: email.trim(),
          role: profile?.role ?? "nutritionist",
          status: profile?.status ?? "active",
          nutritionistID: profile?.nutritionistID,
        },
        token
      );
      await refreshProfile();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !profile) return <ProfileSkeleton />;

  const active = students.filter((s) => s.status === "active").length;
  const totalCompleted = history.length;
  const avgDuration = totalCompleted
    ? Math.round(history.reduce((a, b) => a + (b.duration || 0), 0) / totalCompleted)
    : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Meu perfil</h1>
          <div className="page-sub">Seus dados de nutricionista e estatísticas gerais.</div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}
      {saved && <div id="toast" className="show">✓ Perfil atualizado</div>}

      <div className="frm-card">
        <h3>Dados do nutricionista</h3>
        {profile.photoURL && (
          <div className="avatar" style={{ width: 64, height: 64, marginBottom: 10 }}>
            <img src={profile.photoURL} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          </div>
        )}
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="frm-row">
            <label>E-mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="frm-row">
          <label>Papel</label>
          <input value={profile.role} disabled />
        </div>
        <div className="btn-row">
          <button type="button" className="btn-p" disabled={busy || !name.trim()} onClick={() => void save()}>
            {busy ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>

      <div className="section-label">Suas estatísticas</div>
      <div className="stat-grid">
        <div className="stat-cell">
          <div className="stat-num">{students.length}</div>
          <div className="stat-lbl">Alunos ({active} ativos)</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{workouts.length}</div>
          <div className="stat-lbl">Treinos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{diets.length}</div>
          <div className="stat-lbl">Dietas</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{totalCompleted}</div>
          <div className="stat-lbl">Treinos concluídos</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{avgDuration}</div>
          <div className="stat-lbl">Duração média (min)</div>
        </div>
      </div>
    </div>
  );
}