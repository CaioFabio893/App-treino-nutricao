"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Diet, UserProfile } from "@/lib/types";
import { DietsPageSkeleton } from "@/components/Skeleton";
import DietForm from "@/components/DietForm";
import ConfirmModal from "@/components/ConfirmModal";

export default function DietsPage() {
  return (
    <Suspense fallback={<DietsPageSkeleton />}>
      <DietsInner />
    </Suspense>
  );
}

function DietsInner() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isNew = searchParams.get("new") === "1";
  const presetStudent = searchParams.get("student") || "";
  const copyId = searchParams.get("copy") || "";

  const [diets, setDiets] = useState<Diet[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Diet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [d, s] = await Promise.all([api.listDiets(token), api.listStudents(token)]);
      setDiets(d);
      setStudents(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dietas");
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
    () => (editId ? diets.find((d) => d.id === editId) ?? null : null),
    [diets, editId]
  );

  if (!ready) return <DietsPageSkeleton />;

  if (isNew || editId) {
    return (
      <DietForm
        initial={editing ?? undefined}
        presetStudent={presetStudent}
        copyId={copyId}
        students={students}
        getToken={getToken}
        onDone={() => {
          router.push("/nutritionist/diets");
          void load();
        }}
        onCancel={() => router.push("/nutritionist/diets")}
      />
    );
  }

  const performDelete = async () => {
    if (deleting || !deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await api.deleteDiet(deleteTarget.id!, token);
      setDeleteTarget(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (d: Diet, targetStudentId: string) => {
    try {
      const token = await getToken();
      await api.duplicateDiet(d.id!, { newStudentId: targetStudentId, newName: `${d.name} (copia)` }, token);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao duplicar");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dietas</h1>
          <div className="page-sub">{diets.length} dieta(s) cadastrada(s)</div>
        </div>
        <button
          type="button"
          className="btn-sm acc"
          onClick={() => router.push("/nutritionist/diets?new=1")}
        >
          + Nova dieta
        </button>
      </div>

      {error && <div className="err-text">{error}</div>}

      {diets.length === 0 ? (
        <div className="empty-box">
          Nenhuma dieta cadastrada. Clique em "+ Nova dieta" para começar.
        </div>
      ) : (
        diets.map((d) => (
          <div key={d.id} className="nut-card">
            <div className="nut-card-head">
              <div className="avatar">🥗</div>
              <div>
                <div className="nut-card-title">{d.name}</div>
                <div className="nut-card-sub">
                  {studentName(d.studentId)}
                  {d.description ? ` · ${d.description}` : ""}
                </div>
              </div>
            </div>
            <div className="nut-meta">
              <span className="badge">{d.meals?.length ?? 0} refeições</span>
              {d.startDate && (
                <span className="badge">
                  {d.startDate} → {d.endDate || "…"}
                </span>
              )}
              {d.createdAt && (
                <span className="badge">
                  Criado: {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                </span>
              )}
              {d.updatedAt && (
                <span className="badge">
                  Atualizado: {new Date(d.updatedAt).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn-sm acc"
                onClick={() => router.push(`/nutritionist/diets?edit=${d.id}`)}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn-sm"
                onClick={() => router.push(`/nutritionist/print?diet=${d.id}`)}
              >
                Imprimir
              </button>
              <Duplicator students={students} onPick={(sid) => void handleDuplicate(d, sid)} />
              <button
                type="button"
                className="btn-sm danger"
                onClick={() => setDeleteTarget(d)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir dieta"
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
      <button type="button" className="btn-sm" onClick={() => setOpen(true)}>
        Duplicar
      </button>
      {open && (
        <div className="modal-bg open" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Duplicar dieta</div>
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