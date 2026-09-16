"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { FEATURES } from "@/lib/types";
import type { Feature, Plan } from "@/lib/types";

const emptyPlan = (): Plan => ({
  name: "",
  description: "",
  features: ["workouts"],
  active: true,
});

/**
 * CRUD de planos (pacotes de features) — admin.
 * As features são snapshotadas no perfil do aluno na atribuição; alterar um
 * plano NÃO muda os alunos já vinculados (a menos que você re-atribua).
 */
export default function PlansManager() {
  const { getToken } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<Plan>(emptyPlan());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inUse, setInUse] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      setPlans(await api.listPlans(token));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar planos");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFeature = (f: Feature) => {
    setForm((p) => {
      const has = p.features.includes(f);
      return {
        ...p,
        features: has ? p.features.filter((x) => x !== f) : [...p.features, f],
      };
    });
  };

  const save = async () => {
    if (busy || !form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (editingId) {
        await api.updatePlan(editingId, form, token);
      } else {
        await api.createPlan(form, token);
      }
      setForm(emptyPlan());
      setEditingId(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar plano");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Plan) => {
    setEditingId(p.id ?? null);
    setForm({ ...p, features: p.features ?? [] });
  };

  const confirmDelete = async (p: Plan) => {
    if (busy || !p.id) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await api.deletePlan(p.id, token); // 409 (plano em uso) vira ApiError
      void load();
    } catch (e) {
      // Plano em uso: mostra o número de alunos vinculados (resposta 409).
      const apiErr = e as { status?: number; message: string };
      if (apiErr.status === 409) {
        setInUse(p);
      } else {
        setError(apiErr.message || "Falha ao excluir plano");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="section-label">Planos e features ({plans.length})</div>
      {error && <div className="err-text">{error}</div>}

      {/* Formulário criar/editar */}
      <div className="frm-card">
        <h3>{editingId ? `Editando: ${form.name}` : "Novo plano"}</h3>
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>Nome</label>
            <input
              value={form.name}
              placeholder="ex.: Completo"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="frm-row">
            <label>Descrição</label>
            <input
              value={form.description ?? ""}
              placeholder="O que o plano libera"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <div className="frm-row" style={{ marginTop: 10 }}>
          <label>Features incluídas</label>
          {FEATURES.map((f) => {
            const checked = form.features.includes(f.value);
            return (
              <label
                key={f.value}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 13,
                  marginBottom: 6,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  style={{ marginTop: 2 }}
                  onChange={() => toggleFeature(f.value)}
                />
                <span>
                  <strong>{f.label}</strong>
                  <span className="page-sub" style={{ display: "block" }}>
                    {f.desc}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="frm-row" style={{ marginTop: 10 }}>
          <label className="chk-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              style={{ marginTop: 0 }}
            />
            Plano ativo (pode ser atribuído)
          </label>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn-p" disabled={busy || !form.name.trim()} onClick={() => void save()}>
            {busy ? "Salvando…" : editingId ? "Salvar alterações" : "Criar plano"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-s"
              onClick={() => {
                setEditingId(null);
                setForm(emptyPlan());
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {plans.length === 0 ? (
        <div className="empty-box">Nenhum plano criado ainda. Crie um acima.</div>
      ) : (
        plans.map((p) => (
          <div key={p.id} className="nut-card" style={{ cursor: "default" }}>
            <div className="nut-card-head">
              <div>
                <div className="nut-card-title">{p.name}</div>
                {p.description && <div className="nut-card-sub">{p.description}</div>}
              </div>
            </div>
            <div className="nut-meta">
              <span className={`badge ${p.active ? "active" : "inactive"}`}>
                {p.active ? "ativo" : "inativo"}
              </span>
              <span className="badge">{p.features?.length ?? 0} features</span>
              {p.features?.map((f) => (
                <span key={f} className="badge">{f}</span>
              ))}
            </div>
            <div className="btn-row">
              <button type="button" className="btn-sm acc" onClick={() => startEdit(p)}>
                Editar
              </button>
              <button type="button" className="btn-sm danger" onClick={() => void confirmDelete(p)}>
                Excluir
              </button>
            </div>
          </div>
        ))
      )}

      {/* Aviso: plano em uso não pode ser excluído */}
      <div
        className={`modal-bg${inUse ? " open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setInUse(null)}
      >
        <div className="modal-box">
          <div className="modal-handle" />
          <div className="modal-title">Plano em uso</div>
          <div className="modal-sub">
            O plano <strong>{inUse?.name}</strong> está vinculado a alunos e não pode
            ser excluído. Você pode desativá-lo (ele deixa de ser atribuível a novos
            cadastros) ou trocar o plano dos alunos existentes.
          </div>
          <div className="btn-row">
            <button type="button" className="btn-s" onClick={() => setInUse(null)}>
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}