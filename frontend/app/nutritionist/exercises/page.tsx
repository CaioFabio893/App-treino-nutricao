"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Exercise } from "@/lib/types";
import ConfirmModal from "@/components/ConfirmModal";

// Biblioteca de exercícios (F5) — catálogo GLOBAL compartilhado.
// Nutricionista/admin mantêm (criar/editar/duplicar/excluir); alunos apenas
// consultam via API. O treino continua armazenando uma CÓPIA (snapshot) do
// exercício selecionado — alterar/excluir aqui não afeta treinos existentes.

interface FormState {
  name: string;
  description: string;
  muscleGroup: string;
  equipment: string;
  videoUrl: string;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  muscleGroup: "",
  equipment: "",
  videoUrl: "",
};

export default function ExercisesPage() {
  const { getToken } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      setExercises(await api.listExercises(token));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar exercícios");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.muscleGroup?.toLowerCase().includes(q) ||
        e.equipment?.toLowerCase().includes(q)
    );
  }, [exercises, query]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (e: Exercise) => {
    setEditingId(e.id ?? null);
    setForm({
      name: e.name ?? "",
      description: e.description ?? "",
      muscleGroup: e.muscleGroup ?? "",
      equipment: e.equipment ?? "",
      videoUrl: e.videoUrl ?? "",
    });
    setFormOpen(true);
  };

  const openDuplicate = (e: Exercise) => {
    setEditingId(null);
    setForm({
      name: `${e.name ?? ""} (cópia)`,
      description: e.description ?? "",
      muscleGroup: e.muscleGroup ?? "",
      equipment: e.equipment ?? "",
      videoUrl: e.videoUrl ?? "",
    });
    setFormOpen(true);
  };

  const canSave = Boolean(form.name.trim()) && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const payload: Exercise = {
        name: form.name.trim(),
        description: form.description.trim(),
        muscleGroup: form.muscleGroup.trim(),
        equipment: form.equipment.trim(),
        videoUrl: form.videoUrl.trim(),
      };
      if (editingId) {
        await api.updateExercise(editingId, payload, token);
      } else {
        await api.createExercise(payload, token);
      }
      setFormOpen(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar exercício");
    } finally {
      setBusy(false);
    }
  };

  const performDelete = async () => {
    if (deleting || !deleteTarget?.id) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await api.deleteExercise(deleteTarget.id, token);
      setDeleteTarget(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir exercício");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (!ready) return <div className="empty-box">Carregando…</div>;

  if (formOpen) {
    return (
      <div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
            ‹ Voltar
          </button>
        </div>
        <div className="page-head">
          <div>
            <h1>{editingId ? "Editar exercício" : "Novo exercício"}</h1>
            <div className="page-sub">Preencha os dados do exercício da biblioteca.</div>
          </div>
        </div>

        {error && <div className="err-text">{error}</div>}

        <div className="frm-card">
          <h3>Dados do exercício</h3>
          <div className="frm-row">
            <label>Nome</label>
            <input
              value={form.name}
              placeholder="Ex.: Supino reto"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="frm-row-inline">
            <div className="frm-row">
              <label>Grupo muscular</label>
              <input
                value={form.muscleGroup}
                placeholder="Ex.: Peito"
                onChange={(e) => setForm((f) => ({ ...f, muscleGroup: e.target.value }))}
              />
            </div>
            <div className="frm-row">
              <label>Equipamento</label>
              <input
                value={form.equipment}
                placeholder="Ex.: Barra"
                onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))}
              />
            </div>
          </div>
          <div className="frm-row">
            <label>Descrição (opcional)</label>
            <textarea
              value={form.description}
              placeholder="Observações do exercício…"
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="frm-row">
            <label>Link de vídeo (opcional)</label>
            <input
              value={form.videoUrl}
              placeholder="https://www.youtube.com/watch?v=…"
              onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
            />
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn-p"
            disabled={!canSave}
            onClick={() => void save()}
          >
            {busy ? "Salvando…" : "Salvar exercício"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Exercícios</h1>
          <div className="page-sub">{exercises.length} exercício(s) na biblioteca</div>
        </div>
        <button type="button" className="btn-sm acc" onClick={openNew}>
          + Novo exercício
        </button>
      </div>

      {error && <div className="err-text">{error}</div>}

      {exercises.length > 0 && (
        <div className="dash-filters">
          <div className="frm-row dash-filter-search">
            <input
              type="search"
              placeholder="Buscar por nome, grupo muscular ou equipamento…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {exercises.length === 0 ? (
        <div className="empty-box">
          Nenhum exercício cadastrado. Clique em &quot;+ Novo exercício&quot; para começar.
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-box">Nenhum exercício encontrado com essa busca.</div>
      ) : (
        <>
          <div className="cards-view">
            {filtered.map((e) => (
              <div key={e.id} className="nut-card">
                <div className="nut-card-head">
                  <div className="avatar">🏋</div>
                  <div>
                    <div className="nut-card-title">{e.name}</div>
                    <div className="nut-card-sub">
                      {[e.muscleGroup, e.equipment].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </div>
                {e.description && (
                  <div className="nut-meta">
                    <span>{e.description}</span>
                  </div>
                )}
                <div className="btn-row">
                  <button type="button" className="btn-sm acc" onClick={() => openEdit(e)}>
                    Editar
                  </button>
                  <button type="button" className="btn-sm" onClick={() => openDuplicate(e)}>
                    Duplicar
                  </button>
                  <button type="button" className="btn-sm danger" onClick={() => setDeleteTarget(e)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="table-view">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Exercício</th>
                  <th>Grupo muscular</th>
                  <th>Equipamento</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="dash-cell-title">{e.name}</span>
                      {e.description && <div className="dash-cell-sub">{e.description}</div>}
                    </td>
                    <td>{e.muscleGroup || "—"}</td>
                    <td>{e.equipment || "—"}</td>
                    <td>
                      <div className="btn-row">
                        <button type="button" className="btn-sm acc" onClick={() => openEdit(e)}>
                          Editar
                        </button>
                        <button type="button" className="btn-sm" onClick={() => openDuplicate(e)}>
                          Duplicar
                        </button>
                        <button type="button" className="btn-sm danger" onClick={() => setDeleteTarget(e)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir exercício"
        message={
          <>
            Tem certeza que deseja excluir <strong>{deleteTarget?.name || ""}</strong>? Os
            treinos existentes não são afetados (eles guardam uma cópia do exercício).
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
