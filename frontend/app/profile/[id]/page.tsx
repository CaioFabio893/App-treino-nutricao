"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import type { PublicProfile as PublicProfileType } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/SetupNeeded";
import Avatar from "@/components/Avatar";

// Rota /profile/[id] — página pública de qualquer usuário autenticado.
export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getToken, role } = useAuth();
  const [prof, setProf] = useState<PublicProfileType | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      setProf(await api.getPublicProfile(id, token));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perfil não encontrado");
    } finally {
      setReady(true);
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <LoadingScreen />;
  if (!prof || error) {
    return (
      <div className="empty-box">
        {error || "Perfil não encontrado."}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <Link className="btn-sm" href={role === "student" ? "/" : "/nutritionist"}>
            ‹ Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-public">
      <div className="profile-public-card">
        <div className="profile-public-avatar">
          {prof.photoURL ? (
            <Avatar src={prof.photoURL} alt={prof.name} />
          ) : (
            <span>{prof.name.charAt(0).toUpperCase() || "?"}</span>
          )}
        </div>
        <h2>{prof.name}</h2>
        <div className="profile-public-role">
          {prof.role === "student" ? "Aluno(a)" : prof.role === "nutritionist" ? "Nutricionista" : "Administrador"}
        </div>
        {prof.bio && <p className="profile-public-bio">{prof.bio}</p>}

        {(prof.streak !== undefined || prof.score !== undefined) && (
          <div className="profile-public-stats">
            {prof.streak !== undefined && (
              <div className="profile-public-stat">
                <b>{prof.streak}</b>
                <span>dias seguidos</span>
              </div>
            )}
            {prof.score !== undefined && (
              <div className="profile-public-stat">
                <b>{prof.score.toFixed(1)}</b>
                <span>nota · {prof.cycleId ?? "ciclo"}</span>
              </div>
            )}
            {prof.rank !== undefined && (
              <div className="profile-public-stat">
                <b>#{prof.rank}</b>
                <span>posição</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="btn-row" style={{ justifyContent: "center", marginTop: 12 }}>
        <button type="button" className="btn-sm" onClick={() => window.history.back()}>
          ‹ Voltar
        </button>
      </div>
    </div>
  );
}