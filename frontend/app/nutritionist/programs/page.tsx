"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { TrainingProgram, UserProfile, WorkoutDefine } from "@/lib/types";
import { PROGRAM_DAY_SHORT, programExerciseCount } from "@/lib/programDays";
import { WorkoutsPageSkeleton } from "@/components/Skeleton";
import ConfirmModal from "@/components/ConfirmModal";
import ProgramDetail from "@/components/programs/ProgramDetail";
import ProgramForm from "@/components/programs/ProgramForm";
import ProgramImport from "@/components/programs/ProgramImport";

export default function ProgramsPage() {
  return (
    <Suspense fallback={<WorkoutsPageSkeleton />}>
      <ProgramsInner />
    </Suspense>
  );
}

function ProgramsInner() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit") || "";
  const openId = searchParams.get("id") || "";
  const importing = searchParams.get("import") === "1";

  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingProgram | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [p, s, w] = await Promise.all([
        api.listPrograms(token),
        api.listStudents(token),
        api.listWorkouts(token),
      ]);
      setPrograms(p);
      setStudents(s);
      setWorkouts(w);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar programas");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const studentName = (id?: string) =>
    !id ? "Biblioteca (sem aluno)" : students.find((s) => s.id === id)?.name || id.slice(0, 8);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const w of workouts) if (w.id) acc[w.id] = w.exercises?.length ?? 0;
    return acc;
  }, [workouts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.objective?.toLowerCase().includes(q) ||
        studentName(p.studentId).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs, query, students]);

  const editing = useMemo(
    () => (editId ? programs.find((p) => p.id === editId) ?? null : null),
    [programs, editId]
  );

  const backToList = () => router.push("/nutritionist/programs");

  if (importing) {
    return (
      <ProgramImport
        getToken={getToken}
        students={students}
        onImported={(p) => {
          showToast(`Programa "${p.name}" importado com ${p.workouts?.length ?? 0} treino(s).`);
          router.push(`/nutritionist/programs?id=${p.id}`);
          void load();
        }}
        onCancel={backToList}
      />
    );
  }

  if (editId) {
    if (!ready) return <WorkoutsPageSkeleton />;
    if (!editing) {
      return (
        <div>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button type="button" className="btn-sm" onClick={backToList}>
              ‹ Voltar
            </button>
          </div>
          <div className="empty-box">Programa não encontrado.</div>
        </div>
      );
    }
    return (
      <ProgramForm
        initial={editing}
        workouts={workouts}
        getToken={getToken}
        onDone={() => {
          showToast("Programa salvo.");
          router.push(`/nutritionist/programs?id=${editing.id}`);
          void load();
        }}
        onCancel={() => router.push(`/nutritionist/programs?id=${editing.id}`)}
      />
    );
  }

  if (openId) {
    return (
      <ProgramDetail
        programId={openId}
        backHref="/nutritionist/programs"
        backLabel="Programas"
      />
    );
  }

  const performDelete = async () => {
    if (deleting || !deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await api.deleteProgram(deleteTarget.id!, token);
      showToast("Programa excluído. Os treinos foram mantidos.");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      setError(api.friendlyError(e));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (p: TrainingProgram) => {
    if (busyId) return;
    setBusyId(p.id!);
    setError(null);
    try {
      const token = await getToken();
      const clone = await api.duplicateProgram(p.id!, {}, token);
      showToast(`"${clone.name}" criado como programa de biblioteca.`);
      void load();
    } catch (e) {
      setError(api.friendlyError(e));
    } finally {
      setBusyId("");
    }
  };

  const handleAssign = async (p: TrainingProgram, studentId: string) => {
    if (busyId) return;
    setBusyId(p.id!);
    setError(null);
    try {
      const token = await getToken();
      await api.assignProgram(p.id!, studentId, token);
      showToast(`Programa atribuído a ${studentName(studentId)}.`);
      void load();
    } catch (e) {
      setError(api.friendlyError(e));
    } finally {
      setBusyId("");
    }
  };

  const renderCard = (p: TrainingProgram) => {
    const total = programExerciseCount(p.workouts, counts);
    const days = (p.workouts ?? [])
      .map((r) => PROGRAM_DAY_SHORT[r.dayOfWeek ?? ""] ?? "")
      .filter(Boolean)
      .join(" · ");
    return (
      <div key={`card-${p.id}`} className="nut-card">
        <div className="nut-card-head">
          <div className="avatar">📋</div>
          <div>
            <div className="nut-card-title">{p.name}</div>
            <div className="nut-card-sub">
              {studentName(p.studentId)}
              {p.objective ? ` · ${p.objective}` : ""}
            </div>
          </div>
        </div>
        <div className="nut-meta">
          <span className="badge">{p.workouts?.length ?? 0} treinos</span>
          <span className="badge">{total} exercícios</span>
          {days && <span className="badge">{days}</span>}
          {p.source && <span className="badge">importado de {p.source}</span>}
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn-sm acc"
            onClick={() => router.push(`/nutritionist/programs?id=${p.id}`)}
          >
            Abrir
          </button>
          <button
            type="button"
            className="btn-sm"
            onClick={() => router.push(`/nutritionist/programs?edit=${p.id}`)}
          >
            Editar
          </button>
          <button
            type="button"
            className="btn-sm"
            disabled={busyId === p.id}
            onClick={() => void handleDuplicate(p)}
          >
            {busyId === p.id ? "…" : "Duplicar"}
          </button>
          {p.studentId ? (
            <span className="badge">atribuído</span>
          ) : (
            <AssignPicker
              students={students}
              onPick={(sid) => void handleAssign(p, sid)}
              busy={busyId === p.id}
            />
          )}
          <button
            type="button"
            className="btn-sm danger"
            onClick={() => setDeleteTarget(p)}
          >
            Excluir
          </button>
        </div>
      </div>
    );
  };

  const renderRow = (p: TrainingProgram) => (
    <tr key={`row-${p.id}`}>
      <td>
        <span className="dash-cell-title">{p.name}</span>
        {p.objective && <div className="dash-cell-sub">{p.objective}</div>}
      </td>
      <td>{studentName(p.studentId)}</td>
      <td className="num">{p.workouts?.length ?? 0}</td>
      <td className="num">{programExerciseCount(p.workouts, counts)}</td>
      <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
      <td>
        <div className="btn-row">
          <button
            type="button"
            className="btn-sm acc"
            onClick={() => router.push(`/nutritionist/programs?id=${p.id}`)}
          >
            Abrir
          </button>
          <button
            type="button"
            className="btn-sm"
            onClick={() => router.push(`/nutritionist/programs?edit=${p.id}`)}
          >
            Editar
          </button>
          <button
            type="button"
            className="btn-sm"
            disabled={busyId === p.id}
            onClick={() => void handleDuplicate(p)}
          >
            Duplicar
          </button>
          {p.studentId ? (
            <span className="badge">atribuído</span>
          ) : (
            <AssignPicker
              students={students}
              onPick={(sid) => void handleAssign(p, sid)}
              busy={busyId === p.id}
            />
          )}
          <button
            type="button"
            className="btn-sm danger"
            onClick={() => setDeleteTarget(p)}
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
          <h1>Programas</h1>
          <div className="page-sub">
            {programs.length} programa(s) · {programs.filter((p) => !p.studentId).length} na biblioteca
          </div>
        </div>
        <button
          type="button"
          className="btn-sm acc"
          onClick={() => router.push("/nutritionist/programs?import=1")}
        >
          Importar de .md
        </button>
      </div>

      {error && <div className="err-text">{error}</div>}

      {!ready ? (
        <WorkoutsPageSkeleton />
      ) : programs.length === 0 ? (
        <div className="empty-box">
          Nenhum programa ainda. Importe um arquivo markdown para criar todos os treinos de uma vez.
        </div>
      ) : (
        <>
          <div className="dash-filters">
            <div className="frm-row dash-filter-search">
              <input
                type="search"
                placeholder="Buscar programa por nome, objetivo ou aluno…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-box">Nenhum programa encontrado com essa busca.</div>
          ) : (
            <>
              <div className="cards-view">{filtered.map(renderCard)}</div>
              <div className="table-view">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Programa</th>
                      <th>Aluno</th>
                      <th className="num">Treinos</th>
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
        </>
      )}

      {toast && <div id="toast" className="show">{toast}</div>}

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir programa"
        message={
          <>
            Tem certeza que deseja excluir <strong>{deleteTarget?.name || ""}</strong>? Os treinos
            continuam existindo — apenas o agrupamento é removido.
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

/** Botão que pergunta para qual aluno atribuir o programa. */
function AssignPicker({
  students,
  onPick,
  busy,
}: {
  students: UserProfile[];
  onPick: (sid: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-sm" disabled={busy} onClick={() => setOpen(true)}>
        Atribuir
      </button>
      {open && (
        <div className="modal-bg open" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Atribuir programa</div>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Os treinos do programa serão copiados para o aluno. O modelo original continua na
              biblioteca.
            </p>
            {students.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Nenhum aluno disponível.</p>
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
