"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { TrainingProgram, WorkoutDefine } from "@/lib/types";
import { PROGRAM_DAY_SHORT, programExerciseCount } from "@/lib/programDays";
import { LoadingScreen } from "@/components/SetupNeeded";
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
    <div>
      <div className="page-head">
        <div>
          <h1>Treino</h1>
          <div className="page-sub">
            {programs.length > 0
              ? "O plano de treinos da sua nutricionista."
              : "Você ainda não tem um treino completo atribuído."}
          </div>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="empty-box">
          Nenhum treino completo atribuído a você ainda. Peça ao responsável para associar seu programa de treino.
        </div>
      ) : (
        programs.map((p) => {
          const days = (p.workouts ?? [])
            .map((r) => PROGRAM_DAY_SHORT[r.dayOfWeek ?? ""] ?? "")
            .filter(Boolean)
            .join(" · ");
          return (
            <div key={p.id} className="stu-card">
              <div className="stu-card-title">{p.name}</div>
              {p.objective && <div className="stu-card-sub">{p.objective}</div>}
              <div className="nut-meta">
                <span className="badge">{p.workouts?.length ?? 0} treinos</span>
                <span className="badge">{programExerciseCount(p.workouts, counts)} exercícios</span>
                {days && <span className="badge">{days}</span>}
              </div>
              <div className="btn-row">
                <Link href={`/treinos/${p.id}`} className="btn-sm acc">
                  Abrir treino
                </Link>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
