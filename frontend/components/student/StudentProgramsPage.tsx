"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { TrainingProgram, WorkoutDefine } from "@/lib/types";
import { PROGRAM_DAY_SHORT, programExerciseCount } from "@/lib/programDays";
import { LoadingScreen } from "@/components/SetupNeeded";
import styles from "@/components/programs/TrainingPresentation.module.css";
import LoadError from "@/components/LoadError";

/**
 * Área única de Treino: programas completos atribuídos e execução pessoal.
 * O aluno registra seu progresso, mas não edita a prescrição.
 */
export default function StudentProgramsPage() {
  const { getToken, profile } = useAuth();
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [p, w] = await Promise.all([api.listPrograms(token), api.listWorkouts(token)]);
      // O backend já filtra por aluno; o filtro local é só uma segunda rede
      // de segurança (o demo devolve o escopo pelo token).
      const me = profile?.id ?? "";
      setPrograms(p.filter((x) => !me || x.studentId === me));
      setWorkouts(w);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, [getToken, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <LoadingScreen />;

  if (loadError) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Treino</h1>
            <div className="page-sub">O plano de treinos da sua nutricionista.</div>
          </div>
        </div>
        <LoadError message="Não foi possível carregar seu treino." onRetry={() => void load()} />
      </div>
    );
  }

  const counts: Record<string, number> = {};
  for (const w of workouts) if (w.id) counts[w.id] = w.exercises?.length ?? 0;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div>
          <span className={styles.kicker}>SEU MOVIMENTO, SUA EVOLUÇÃO</span>
          <h1>Meus treinos</h1>
          <p>
            {programs.length > 0
              ? "O plano de treinos da sua nutricionista."
              : "Você ainda não tem um treino completo atribuído."}
          </p>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="empty-box">
          Nenhum treino completo atribuído a você ainda. Peça ao responsável para associar seu programa de treino.
        </div>
      ) : (
        <div className={styles.programGrid}>{programs.map((p) => {
          const days = (p.workouts ?? [])
            .map((r) => PROGRAM_DAY_SHORT[r.dayOfWeek ?? ""] ?? "")
            .filter(Boolean)
            .join(" · ");
          return (
            <article key={p.id} className={styles.programCard}>
              <div className={styles.programTop}>
                <span className={styles.programSymbol} aria-hidden="true"><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12" /></svg></span>
                <div><span className={styles.programLabel}>PROGRAMA DE TREINO</span><h2>{p.name}</h2></div>
              </div>
              {p.objective && <p>{p.objective}</p>}
              <div className={styles.programStats}>
                <div><strong>{p.workouts?.length ?? 0}</strong>treinos no programa</div>
                <div><strong>{programExerciseCount(p.workouts, counts)}</strong>exercícios</div>
              </div>
              {days && <div className={styles.programDays}>Dias: {days}</div>}
              <Link href={`/treinos/${p.id}`} className={styles.openButton}>Abrir meu treino <span aria-hidden="true">→</span></Link>
            </article>
          );
        })}</div>
      )}
    </div>
  );
}
