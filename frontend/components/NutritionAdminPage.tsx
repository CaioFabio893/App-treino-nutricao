"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Diet, UserProfile } from "@/lib/types";
import { DietsPageSkeleton } from "@/components/Skeleton";
import DietForm from "@/components/DietForm";
import ConfirmModal from "@/components/ConfirmModal";
import StudentAssignmentPicker, { assignSelectedStudents } from "@/components/StudentAssignmentPicker";
import { EmptyDietState } from "@/components/EmptyDietState";

export default function DietsPage({ recipe = false }: { recipe?: boolean }) {
  return (
    <Suspense fallback={<DietsPageSkeleton />}>
      <DietsInner recipe={recipe} />
    </Suspense>
  );
}

function DietsInner({ recipe }: { recipe: boolean }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const base = recipe ? "/admin/recipes" : "/admin/diets";
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
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [d, s] = await Promise.all([api.listDiets(token), api.listStudents(token)]);
      setDiets(d.filter(item => recipe ? item.kind === "recipe" : item.kind !== "recipe"));
      setStudents(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dietas");
    } finally {
      setReady(true);
    }
  }, [getToken, recipe]);

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
        recipe={recipe}
        initial={editing ?? undefined}
        presetStudent={presetStudent}
        copyId={copyId}
        students={students}
        getToken={getToken}
        onDone={() => {
          router.push(base);
          void load();
        }}
        onCancel={() => router.push(base)}
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

  const handleAssign = async (diet: Diet, ids: string[], _pending: Record<string, string>, progress: (done: number) => void) => {
    void _pending;
    if (assigning) return ids;
    setAssigning(true); setError(null); setNotice("");
    try {
      const token = await getToken();
      const failed = await assignSelectedStudents(ids, async studentId => {
        await api.duplicateDiet(diet.id!, { newStudentId: studentId, newName: diet.name }, token);
      }, progress);
      await load();
      setNotice(`Plano alimentar associado a ${ids.length - failed.length} aluno(s). Modelo original preservado.`);
      return failed;
    } catch (e) { setError(api.friendlyError(e)); return ids; }
    finally { setAssigning(false); }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{recipe ? "Receitas" : "Dietas"}</h1>
          <div className="page-sub">{diets.length} {recipe ? "receita(s) cadastrada(s)" : "dieta(s) cadastrada(s)"}</div>
        </div>
        <button
          type="button"
          className="btn-sm acc"
          onClick={() => router.push(`${base}?new=1`)}
        >
          {recipe ? "+ Nova receita" : "+ Nova dieta"}
        </button>
      </div>

      {error && <div className="err-text">{error}</div>}
      {notice && <div className="empty-box" role="status">{notice}</div>}

      {diets.length === 0 ? (
        recipe ? <div className="empty-box">Nenhuma receita cadastrada. Use Nova receita para disponibilizar conteúdo para todos os alunos.</div> : <EmptyDietState onAction={() => router.push(`${base}?new=1`)} />
      ) : (
        diets.map((d) => (
          <div key={d.id} className="nut-card">
            <div className="nut-card-head">
              <div className="avatar">🥗</div>
              <div>
                <div className="nut-card-title">{d.name}</div>
                <div className="nut-card-sub">
                  {recipe ? "Disponível para todos os alunos" : studentName(d.studentId)}
                  {d.description ? ` · ${d.description}` : ""}
                </div>
              </div>
            </div>
            <div className="nut-meta">
              <span className="badge">
                {d.document ? `Documento protegido · ${d.document.pageCount} páginas` : d.content ? "Texto livre" : `${d.meals?.length ?? 0} refeições`}
              </span>
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
                onClick={() => router.push(`${base}?edit=${d.id}`)}
              >
                Editar
              </button>
              {!d.document && <button
                type="button"
                className="btn-sm"
                onClick={() => router.push(`/admin/print?diet=${d.id}`)}
              >
                Imprimir
              </button>}
              {!recipe && <StudentAssignmentPicker title="Associar plano alimentar" description="Selecione os alunos que receberão este plano, incluindo seu documento. Cada aluno terá sua própria cópia; o modelo continua disponível." students={students.filter(s => s.id !== d.studentId)} busy={assigning} onPick={(ids, pending, progress) => handleAssign(d, ids, pending, progress)} />}
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
        title={recipe ? "Excluir receita" : "Excluir dieta"}
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

