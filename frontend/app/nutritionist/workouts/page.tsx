"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine } from "@/lib/types";
import { WorkoutsPageSkeleton } from "@/components/Skeleton";
import WorkoutForm from "@/components/WorkoutForm";
import ConfirmModal from "@/components/ConfirmModal";

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
    <Suspense fallback={<WorkoutsPageSkeleton />}>
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
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkoutDefine | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const studentName = (id?: string) =>
    !id ? "Sem aluno (biblioteca)" : students.find((s) => s.id === id)?.name || id.slice(0, 8);

  const editing = useMemo(
    () => (editId ? workouts.find((w) => w.id === editId) ?? null : null),
    [workouts, editId]
  );

  // Busca client-side por nome do treino ou do aluno.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workouts;
    return workouts.filter(
      (w) =>
        w.name?.toLowerCase().includes(q) ||
        studentName(w.studentId).toLowerCase().includes(q) ||
        w.objective?.toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, query, students]);

  if (!ready) return <WorkoutsPageSkeleton />;

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

  const performDelete = async () => {
    if (deleting || !deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await api.deleteWorkout(deleteTarget.id!, token);
      setDeleteTarget(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
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

  const renderCard = (w: WorkoutDefine) => (
    <div key={`card-${w.id}`} className="nut-card">
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
          onClick={() => setDeleteTarget(w)}
        >
          Excluir
        </button>
      </div>
    </div>
  );

  const renderRow = (w: WorkoutDefine) => (
    <tr key={`row-${w.id}`}>
      <td>
        <span className="dash-cell-title">{w.name}</span>
        {w.objective && <div className="dash-cell-sub">{w.objective}</div>}
      </td>
      <td>{studentName(w.studentId)}</td>
      <td>{w.dayOfWeek ? WEEK_DAY_LABEL[w.dayOfWeek] || w.dayOfWeek : "—"}</td>
      <td className="num">{w.exercises?.length ?? 0}</td>
      <td>
        {w.createdAt ? new Date(w.createdAt).toLocaleDateString("pt-BR") : "—"}
      </td>
      <td>
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
            onClick={() => setDeleteTarget(w)}
          >
            Excluir
          </button>
        </div>
      </td>
    </tr>
  );

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

      {workouts.length > 0 && (
        <div className="dash-filters">
          <div className="frm-row dash-filter-search">
            <input
              type="search"
              placeholder="Buscar treino por nome, aluno ou objetivo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {workouts.length === 0 ? (
        <div className="empty-box">
          Nenhum treino cadastrado. Clique em &quot;+ Novo treino&quot; para começar.
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-box">Nenhum treino encontrado com essa busca.</div>
      ) : (
        <>
          <div className="cards-view">{filtered.map(renderCard)}</div>
          <div className="table-view">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Treino</th>
                  <th>Aluno</th>
                  <th>Dia</th>
                  <th className="num">Exercícios</th>
                  <th>Criado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>{filtered.map(renderRow)}</tbody>
            </table>
          </div>
        </>
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir treino"
        message={
          <>
            Tem certeza que deseja excluir{" "}
            <strong>{deleteTarget?.name || ""}</strong>? Essa ação não pode ser
            desfeita.
          </>
        }
        confirmLabel="Excluir"
        busyLabel="Excluindo…"
        busy={deleting}
        onConfirm={() => void performDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
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