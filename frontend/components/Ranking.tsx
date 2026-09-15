"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import type { RankingResponse } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { RankingSkeleton } from "./Skeleton";
import LoadError from "./LoadError";

export default function Ranking() {
  const { getToken } = useAuth();
  const [data, setData] = useState<RankingResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      setData(await api.getRanking(token));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <RankingSkeleton />;
  if (loadError) {
    return (
      <LoadError
        message="Não foi possível carregar o ranking."
        onRetry={() => void load()}
      />
    );
  }
  if (!data) return <div className="empty-box">Ranking indisponível.</div>;

  const medal = (rank: number) =>
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);

  const renderEntry = (e: { studentId: string; name: string; photoURL?: string; score: number; rank: number }, highlight = false) => (
    <Link
      key={e.studentId}
      href={`/profile/${e.studentId}`}
      className={`rank-row ${highlight ? "me" : ""}`}
    >
      <span className="rank-pos">{medal(e.rank)}</span>
      <span className="rank-name">{e.name}</span>
      <span className="rank-score">{e.score.toFixed(1)}</span>
    </Link>
  );

  return (
    <div className="ranking-wrap">
      <div className="page-head">
        <div>
          <h1>Ranking do ciclo</h1>
          <div className="page-sub">
            {data.cycleId} · {data.cycleStart} → {data.cycleEnd}
          </div>
        </div>
      </div>

      <div className="rank-legend">
        Nota média diária (treino + dieta) — reset a cada trimestre. Top{" "}
        {data.top.length} de {data.total} alunos.
      </div>

      <div className="rank-list">
        {data.top.length === 0 && <div className="empty-box">Nenhum aluno pontuou ainda neste ciclo.</div>}
        {data.top.map((e) => renderEntry(e))}
      </div>

      {data.self && !data.top.some((t) => t.studentId === data.self!.studentId) && (
        <>
          <div className="rank-divider">…</div>
          <div className="rank-list">{renderEntry(data.self, true)}</div>
        </>
      )}

      {data.full && (
        <div className="section-label" style={{ marginTop: 18 }}>
          Todos os meus alunos
        </div>
      )}
      {data.full && (
        <div className="rank-list">
          {data.full.map((e) => renderEntry(e, data.self?.studentId === e.studentId))}
        </div>
      )}
    </div>
  );
}