"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine, WorkoutExercise } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";
import WorkoutForm from "@/components/WorkoutForm";

const WEEK_DAY_LABEL: Record<string, string> = {
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
  sunday: "Dom",
};

export default function WorkoutsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <WorkoutsInner />
    </Suspense>
  );
}

function WorkoutsInner() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isNew = searchParams.get("new") === "1";
  const presetStudent = searchParams.get("student") || "";
  const copyId = searchParams.get("copy") || "";

  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [w, s] = await Promise.all([api.listWorkouts(token), api.listStudents(token)]);
      setWorkouts(w);
      setStudents(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar treinos");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const studentName = (id: string) =>
    students.find((s) => s.id === id)?.name || id.slice(0, 8);

  const editing = useMemo(
    () => (editId ? workouts.find((w) => w.id === editId) ?? null : null),
    [workouts, editId]
  );

  if (!ready) return <LoadingScreen />;

  // Modo formulário (criar novo / editar existente).
  if (isNew || editId) {
    return (
      <WorkoutForm
        initial={editing ?? undefined}
        presetStudent={presetStudent}
        copyId={copyId}
        students={students}
        getToken={getToken}
        onDone={() => {
          router.push("/nutritionist/workouts");
          void load();
        }}
        onCancel={() => router.push("/nutritionist/workouts")}
      />
    );
  }

  const handleDelete = async (w: WorkoutDefine) => {
    if (!confirm(`Tem certeza que deseja excluir "${w.name}"?`)) return;
    try {
      const token = await getToken();
      await api.deleteWorkout(w.id!, token);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir");
    }
  };

  const handleDuplicate = async (w: WorkoutDefine, targetStudentId: string) => {
    try {
      const token = await getToken();
      await api.duplicateWorkout(w.id!, { newStudentId: targetStudentId, newName: `${w.name} (copia)` }, token);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao duplicar");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Treinos</h1>
          <div className="page-sub">{workouts.length} treino(s) cadastrado(s)</div>
        </div>
        <button
          type="button"
          className="btn-sm acc"
          onClick={() => router.push("/nutritionist/workouts?new=1")}
        >
          + Novo treino
        </button>
      </div>

      {error && <div className="err-text">{error}</div>}

      {workouts.length === 0 ? (
        <div className="empty-box">
          Nenhum treino cadastrado. Clique em "+ Novo treino" para começar.
        </div>
      ) : (
        workouts.map((w) => (
          <div key={w.id} className="nut-card">
            <div className="nut-card-head">
              <div className="avatar">🏋</div>
              <div>
                <div className="nut-card-title">{w.name}</div>
                <div className="nut-card-sub">
                  {studentName(w.studentId)}
                  {w.objective ? ` · ${w.objective}` : ""}
                  {w.dayOfWeek ? ` · ${WEEK_DAY_LABEL[w.dayOfWeek] || w.dayOfWeek}` : ""}
                </div>
              </div>
            </div>
            <div className="nut-meta">
              <span className="badge">{w.exercises?.length ?? 0} exercícios</span>
              {w.createdAt && (
                <span className="badge">
                  Criado: {new Date(w.createdAt).toLocaleDateString("pt-BR")}
                </span>
              )}
              {w.updatedAt && (
                <span className="badge">
                  Atualizado: {new Date(w.updatedAt).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn-sm acc"
                onClick={() => router.push(`/nutritionist/workouts?edit=${w.id}`)}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn-sm"
                onClick={() => router.push(`/nutritionist/print?workout=${w.id}`)}
              >
                Imprimir
              </button>
              <Duplicator students={students} onPick={(sid) => void handleDuplicate(w, sid)} />
              <button
                type="button"
                className="btn-sm danger"
                onClick={() => void handleDelete(w)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Botão que pergunta para qual aluno duplicar.
function Duplicator({
  students,
  onPick,
}: {
  students: UserProfile[];
  onPick: (sid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn-sm"
        onClick={() => setOpen(true)}
      >
        Duplicar
      </button>
      {open && (
        <div className="modal-bg open" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Duplicar treino</div>
            {students.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>
                Nenhum aluno disponível.
              </p>
            ) : (
              students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="btn-sm full"
                  style={{ marginBottom: 8 }}
                  onClick={() => {
                    onPick(s.id);
                    setOpen(false);
                  }}
                >
                  {s.name || s.id}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}