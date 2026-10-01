"use client";

import Avatar from "@/components/Avatar";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type {
  UserProfile,
  WorkoutDefine,
  Diet,
  Status,
} from "@/lib/types";
import { ProfileSkeleton } from "@/components/Skeleton";

const WEEK_DAY_LABEL: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

interface Props {
  student: UserProfile;
  onStudentChange?: (s: UserProfile) => void;
}

export default function StudentDetail({ student, onStudentChange }: Props) {
  const { getToken } = useAuth();
  const router = useRouter();

  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  // Listas completas (incluem itens de biblioteca sem aluno) para permitir a
  // ATRIBUIÇÃO de treino/dieta existente a este aluno sem duplicar.
  const [allWorkouts, setAllWorkouts] = useState<WorkoutDefine[]>([]);
  const [allDiets, setAllDiets] = useState<Diet[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Atribuição de treino/dieta de biblioteca.
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  // Edição do nome e status do aluno.
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: student.name || "",
    status: student.status || "active",
  });
  const [editMsg, setEditMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [w, d] = await Promise.all([
        api.listWorkouts(token),
        api.listDiets(token),
      ]);
      setAllWorkouts(w);
      setAllDiets(d);
      setWorkouts(w.filter((x) => x.studentId === student.id));
      setDiets(d.filter((x) => x.studentId === student.id && x.kind !== "recipe"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setReady(true);
    }
  }, [getToken, student.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = () => router.push("/admin/students");

  const saveStudent = async () => {
    if (saving) return;
    setSaving(true);
    setEditMsg(null);
    try {
      const token = await getToken();
      await api.updateStudent(
        student.id,
        {
          name: editForm.name.trim() || student.name,
          status: editForm.status,
        },
        token
      );
      const updated = await api.getStudent(student.id, token);
      onStudentChange?.(updated);
      setEditMsg("✓ Dados do aluno atualizados.");
    } catch (e) {
      setEditMsg(`⚠ ${e instanceof Error ? e.message : "Falha ao salvar"}`);
    } finally {
      setSaving(false);
    }
  };

  // Itens de biblioteca (sem aluno) disponíveis para atribuir a este aluno.
  // Não listamos treinos/dietas de OUTROS alunos para evitar transferência.
  const assignableWorkouts = useMemo(
    () => allWorkouts.filter((w) => !w.studentId),
    [allWorkouts]
  );
  const assignableDiets = useMemo(
    () => allDiets.filter((d) => !d.studentId),
    [allDiets]
  );

  // ATRIBUIÇÃO: vincula um treino/dieta existente (biblioteca) a este aluno
  // pelo mecanismo existente (studentId no documento), sem duplicar.
  const assignWorkout = async (id: string) => {
    const w = allWorkouts.find((x) => x.id === id);
    if (!w || assigning) return;
    setAssigning(true);
    setAssignMsg(null);
    try {
      const token = await getToken();
      await api.updateWorkout(id, { ...w, studentId: student.id }, token);
      setAssignMsg("✓ Treino atribuído a este aluno.");
      void load();
    } catch (e) {
      setAssignMsg(`⚠ ${e instanceof Error ? e.message : "Falha ao atribuir treino"}`);
    } finally {
      setAssigning(false);
    }
  };

  const assignDiet = async (id: string) => {
    const d = allDiets.find((x) => x.id === id);
    if (!d || assigning) return;
    setAssigning(true);
    setAssignMsg(null);
    try {
      const token = await getToken();
      await api.updateDiet(id, { ...d, studentId: student.id }, token);
      setAssignMsg("✓ Dieta atribuída a este aluno.");
      void load();
    } catch (e) {
      setAssignMsg(`⚠ ${e instanceof Error ? e.message : "Falha ao atribuir dieta"}`);
    } finally {
      setAssigning(false);
    }
  };

  if (!ready) return <ProfileSkeleton />;


  return (
    <div>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" className="btn-sm" onClick={close}>
          ‹ Voltar para alunos
        </button>
      </div>

      <div className="page-head">
        <div>
          <h1>{student.name || "Aluno"}</h1>
          <div className="page-sub">{student.email}</div>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <Link className="btn-sm" href={`/admin/workouts?new=1&student=${student.id}`}>
            + Treino
          </Link>
          <Link className="btn-sm" href={`/admin/diets?new=1&student=${student.id}`}>
            + Dieta
          </Link>
          <Link className="btn-sm" href={`/admin/recipes?new=1&student=${student.id}`}>+ Receita</Link>
          <Link className="btn-sm acc" href={`/admin/print?student=${student.id}`}>
            🖨 Plano semanal
          </Link>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}
      {assignMsg && (
        <div
          className={assignMsg.startsWith("✓") ? "" : "err-text"}
          style={
            assignMsg.startsWith("✓")
              ? { color: "var(--ok, #2e7d32)", fontSize: 13, marginBottom: 8 }
              : {}
          }
        >
          {assignMsg}
        </div>
      )}

      {/* Dados do aluno */}
      <div className="section-label">Dados do aluno</div>
      {editing ? (
        <div className="nut-card" style={{ cursor: "default" }}>
          <div className="frm-row">
            <label className="frm-label">Nome</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div className="frm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="frm-row">
              <label className="frm-label">Status</label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value as Status })
                }
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
          </div>
          {editMsg && <div className={editMsg.startsWith("✓") ? "" : "err-text"} style={editMsg.startsWith("✓") ? { color: "var(--ok, #2e7d32)", fontSize: 12, marginTop: 6 } : {}}>{editMsg}</div>}
          <div className="btn-row">
            <button
              type="button"
              className="btn-sm acc"
              disabled={saving}
              onClick={() => void saveStudent()}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className="btn-sm" onClick={() => { setEditing(false); setEditMsg(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="detail-grid">
          <div className="detail-cell">
            <div className="k">Avatar</div>
            <div className="v">
              <div className="avatar">
                <Avatar alt={student.name} />
              </div>
            </div>
          </div>
          <div className="detail-cell">
            <div className="k">Status</div>
            <div className="v">
              <span className={`badge ${student.status || ""}`}>{student.status || "active"}</span>
            </div>
          </div>
          <div className="detail-cell">
            <div className="k">Treinos</div>
            <div className="v">{workouts.length}</div>
          </div>
          <div className="detail-cell" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn-sm acc" onClick={() => { setEditing(true); setEditMsg(null); }}>
              ✏ Editar
            </button>
          </div>
        </div>
      )}

      {/* Treinos */}
      <div className="section-label">Treinos</div>
      {assignableWorkouts.length > 0 && (
        <div className="nut-card" style={{ marginBottom: 12 }}>
          <div className="frm-row">
            <label className="frm-label">Atribuir treino existente (biblioteca)</label>
            <select
              value=""
              disabled={assigning}
              onChange={(e) => {
                if (e.target.value) void assignWorkout(e.target.value);
              }}
            >
              <option value="">— Selecionar treino da biblioteca —</option>
              {assignableWorkouts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {workouts.length === 0 ? (
        <div className="empty-box">Nenhum treino para este aluno ainda.</div>
      ) : (
        workouts.map((w) => (
          <div
            key={w.id}
            className="nut-card"
            style={{ cursor: "pointer" }}
            onClick={() => router.push(`/admin/workouts?edit=${w.id}`)}
          >
            <div className="nut-card-head">
              <div className="avatar">🏋</div>
              <div>
                <div className="nut-card-title">{w.name}</div>
                <div className="nut-card-sub">
                  {w.objective || "Sem objetivo"}
                  {w.dayOfWeek ? ` · ${WEEK_DAY_LABEL[w.dayOfWeek] || w.dayOfWeek}` : ""}·
                  {w.exercises?.length ?? 0} exercícios
                </div>
              </div>
            </div>
            <div className="btn-row">
              <Link
                className="btn-sm"
                href={`/admin/workouts?edit=${w.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                Editar
              </Link>
              <Link
                className="btn-sm"
                href={`/admin/workouts?new=1&student=${student.id}&copy=${w.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                Duplicar
              </Link>
            </div>
          </div>
        ))
      )}

      {/* Dietas */}
      <div className="section-label">Dietas</div>
      {assignableDiets.length > 0 && (
        <div className="nut-card" style={{ marginBottom: 12 }}>
          <div className="frm-row">
            <label className="frm-label">Atribuir dieta existente (biblioteca)</label>
            <select
              value=""
              disabled={assigning}
              onChange={(e) => {
                if (e.target.value) void assignDiet(e.target.value);
              }}
            >
              <option value="">— Selecionar dieta da biblioteca —</option>
              {assignableDiets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {diets.length === 0 ? (
        <div className="empty-box">Nenhuma dieta para este aluno ainda.</div>
      ) : (
        diets.map((d) => (
          <div
            key={d.id}
            className="nut-card"
            style={{ cursor: "pointer" }}
            onClick={() => router.push(`/admin/diets?edit=${d.id}`)}
          >
            <div className="nut-card-head">
              <div className="avatar">🥗</div>
              <div>
                <div className="nut-card-title">{d.name}</div>
                <div className="nut-card-sub">
                  {d.description || ""}
                  {d.content ? " · Texto livre" : ` · ${d.meals?.length ?? 0} refeições`}
                  {d.startDate ? ` · ${d.startDate} → ${d.endDate || "?"}` : ""}
                </div>
                {!d.description && d.content && (
                  <div className="nut-card-sub" style={{ marginTop: 4 }}>
                    {d.content.slice(0, 80)}
                    {d.content.length > 80 ? "…" : ""}
                  </div>
                )}
              </div>
            </div>
            <div className="btn-row">
              <Link
                className="btn-sm"
                href={`/admin/diets?edit=${d.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                Editar
              </Link>
              <Link
                className="btn-sm"
                href={`/admin/diets?new=1&student=${student.id}&copy=${d.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                Duplicar
              </Link>
            </div>
          </div>
        ))
      )}

    </div>
  );
}
