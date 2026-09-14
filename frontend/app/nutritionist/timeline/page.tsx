"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine, WorkoutHistoryEntry } from "@/lib/types";
import AdherenceChart from "@/components/AdherenceChart";
import { TimelinePageSkeleton } from "@/components/Skeleton";

const PAGE_SIZE = 20;

export default function TimelinePage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<WorkoutHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [page, w, s] = await Promise.all([
        api.listHistoryPage(token, { limit: PAGE_SIZE, offset: 0 }),
        api.listWorkouts(token),
        api.listStudents(token),
      ]);
      setItems(page.entries);
      setTotal(page.total);
      setHasMore(page.hasMore);
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

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const token = await getToken();
      const page = await api.listHistoryPage(token, {
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...page.entries]);
      setTotal(page.total);
      setHasMore(page.hasMore);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar mais");
    } finally {
      setLoadingMore(false);
    }
  };

  const studentName = (id: string) => students.find((s) => s.id === id)?.name || id.slice(0, 8);
  const workoutName = (id: string) => workouts.find((w) => w.id === id)?.name || "Treino";

  const exportCsv = async () => {
    try {
      const token = await getToken();
      const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      const rows: string[][] = [];
      let offset = 0;
      for (;;) {
        const page = await api.listHistoryPage(token, { limit: 200, offset });
        for (const h of page.entries) {
          rows.push([
            h.completedAt
              ? new Date(h.completedAt).toLocaleString("pt-BR")
              : "",
            studentName(h.studentId),
            h.workoutName ?? workoutName(h.workoutId),
            String(h.duration ?? ""),
            String(h.exercisesCompleted ?? ""),
            String(h.totalExercises ?? ""),
          ]);
        }
        offset += page.entries.length;
        if (offset === 0 || !page.hasMore) break;
      }
      const csv =
        "\uFEFF" +
        ["Data;Aluno;Treino;Duração (min);Exercícios;Total"]
          .concat(rows.map((r) => r.map(esc).join(";")))
          .join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timeline-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao exportar");
    }
  };

  if (!ready) return <TimelinePageSkeleton />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Timeline</h1>
          <div className="page-sub">Atividades de todos os seus alunos</div>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn-sm acc"
            disabled={total === 0}
            onClick={() => void exportCsv()}
          >
            ⬇ Exportar CSV
          </button>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      <AdherenceChart />

      {items.length === 0 ? (
        <div className="empty-box">
          Nenhuma atividade registrada ainda. Quando seus alunos concluírem
          treinos, eles aparecem aqui.
        </div>
      ) : (
        <>
          <div className="timeline">
            {items.map((h) => {
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

          <div className="btn-row" style={{ justifyContent: "center" }}>
            {hasMore && (
              <button
                type="button"
                className="btn-sm acc"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Carregando…" : "Carregar mais"}
                {!loadingMore && total > 0 ? ` (${items.length} de ${total})` : ""}
              </button>
            )}
            {!hasMore && total > PAGE_SIZE && (
              <div className="page-sub" style={{ textAlign: "center", width: "100%" }}>
                Fim da lista — {total} atividade(s) no total.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}