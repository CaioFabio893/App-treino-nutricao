"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Plan, UserProfile } from "@/lib/types";
import { AdminSkeleton } from "@/components/Skeleton";
import Avatar from "@/components/Avatar";
import PendingApprovals from "@/components/admin/PendingApprovals";
import PlansManager from "@/components/admin/PlansManager";

const emptyUser = (): UserProfile => ({
  id: "",
  name: "",
  email: "",
  role: "student",
  status: "active",
  planID: "",
});

export default function AdminPage() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [nutritionists, setNutritionists] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<UserProfile>(emptyUser());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const all = await api.listUsers(token);
      setUsers(all);
      setNutritionists(all.filter((u) => u.role === "nutritionist" || u.role === "admin"));
      setPlans(await api.listPlans(token));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar usuários");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      // planID/features são definidos via assignPlan (snapshot validado no
      // backend) — não podem ir no corpo do create/update, que sobrescreveria
      // ou limparia o snapshot atual.
      const payload: UserProfile = { ...form };
      delete payload.planID;
      delete payload.features;
      const targetId = editingId ?? payload.id;
      if (editingId) {
        await api.updateUser(editingId, { ...payload, id: editingId }, token);
        showToast("✓ Usuário atualizado");
      } else {
        if (!targetId.trim()) {
          setError("O campo ID (uid do Firebase) é obrigatório");
          setBusy(false);
          return;
        }
        await api.createUser(payload, token);
        showToast("✓ Usuário criado");
      }
      // Atribui plano (e snapshot das features) quando o admin escolheu um.
      if (form.role === "student" && form.planID) {
        await api.assignPlan(targetId, form.planID, token);
      }
      setForm(emptyUser());
      setEditingId(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (deleting || !confirmUser) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await api.deleteUser(confirmUser.id, token);
      showToast("✓ Usuário excluído");
      setConfirmUser(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir");
      setConfirmUser(null);
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (u: UserProfile) => {
    setEditingId(u.id);
    setForm({ ...u });
    window.scrollTo(0, 0);
  };

  if (!ready) return <AdminSkeleton />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Usuários</h1>
          <div className="page-sub">
            Crie e defina os papéis (admin, nutricionista, aluno) e vincule alunos
            aos nutricionistas.
          </div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}
      {toast && <div id="toast" className="show">{toast}</div>}

      {/* Fila de aprovação + planos (novos blocos admin) */}
      <PendingApprovals />
      <PlansManager />

      {/* Formulário criar/editar */}
      <div className="frm-card">
        <h3>{editingId ? `Editando: ${form.name || editingId}` : "Novo usuário"}</h3>
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>UID (Firebase)</label>
            <input
              value={form.id}
              disabled={!!editingId}
              placeholder="uid do usuário no Firebase Auth"
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
          </div>
          <div className="frm-row">
            <label>Nome</label>
            <input
              value={form.name}
              placeholder="Nome do usuário"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
        </div>
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>E-mail</label>
            <input
              value={form.email ?? ""}
              placeholder="email@exemplo.com"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="frm-row">
            <label>Papel (role)</label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as UserProfile["role"] })
              }
            >
              <option value="student">Aluno</option>
              <option value="nutritionist">Nutricionista</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        {form.role === "student" && (
          <div className="frm-row">
            <label>Nutricionista responsável</label>
            <select
              value={form.nutritionistID ?? ""}
              onChange={(e) => setForm({ ...form, nutritionistID: e.target.value })}
            >
              <option value="">— Sem nutricionista —</option>
              {nutritionists.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name || n.id}
                </option>
              ))}
            </select>
          </div>
        )}
        {form.role === "student" && (
          <div className="frm-row" style={{ marginTop: 10 }}>
            <label>Plano (features liberadas)</label>
            <select
              value={form.planID ?? ""}
              onChange={(e) => setForm({ ...form, planID: e.target.value })}
            >
              <option value="">— Sem plano —</option>
              {plans
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.features?.length ? ` (${p.features.join(", ")})` : ""}
                  </option>
                ))}
            </select>
            <div className="page-sub">
              O plano é aplicado via atribuição e fixa as features no perfil do aluno.
            </div>
          </div>
        )}
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>Status</label>
            <select
              value={form.status ?? "active"}
              onChange={(e) => setForm({ ...form, status: e.target.value as UserProfile["status"] })}
            >
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div className="frm-row">
            <label>Término do acesso</label>
            <input
              type="date"
              value={form.endDate ?? ""}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn-p" disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando…" : editingId ? "Salvar alterações" : "Criar usuário"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-s"
              onClick={() => {
                setEditingId(null);
                setForm(emptyUser());
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="section-label">Usuários ({users.length})</div>
      {users.length === 0 ? (
        <div className="empty-box">Nenhum usuário cadastrado ainda.</div>
      ) : (
        users.map((u) => (
          <div key={u.id} className="nut-card">
            <div className="nut-card-head">
              <div className="avatar">
                {u.photoURL ? (
                  <Avatar src={u.photoURL} alt={u.name} />
                ) : (
                  u.name?.charAt(0)?.toUpperCase() || "?"
                )}
              </div>
              <div>
                <div className="nut-card-title">{u.name || u.id}</div>
                <div className="nut-card-sub">
                  {u.email} · {u.id.slice(0, 12)}…
                </div>
              </div>
            </div>
            <div className="nut-meta">
              <span className="badge">{u.role}</span>
              <span className={`badge ${u.status || ""}`}>{u.status || "active"}</span>
              {u.nutritionistID && <span className="badge">Nutr.: {u.nutritionistID.slice(0, 10)}…</span>}
              {u.endDate && <span className="badge">Até: {u.endDate}</span>}
            </div>
            <div className="btn-row">
              <button type="button" className="btn-sm acc" onClick={() => startEdit(u)}>
                Editar
              </button>
              <button type="button" className="btn-sm danger" onClick={() => setConfirmUser(u)}>
                Excluir
              </button>
            </div>
          </div>
        ))
      )}

      {/* Confirmação de exclusão */}
      <div
        className={`modal-bg${confirmUser ? " open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && !deleting && setConfirmUser(null)}
      >
        <div className="modal-box">
          <div className="modal-handle" />
          <div className="modal-title">Excluir usuário</div>
          <div className="modal-sub">
            Tem certeza que deseja excluir{" "}
            <strong>{confirmUser?.name || confirmUser?.id || ""}</strong>?
            <br />
            Essa ação não pode ser desfeita.
          </div>
          <div className="btn-row">
            {deleting ? (
              <button type="button" className="btn-sm danger" disabled>
                Excluindo…
              </button>
            ) : (
              <button
                type="button"
                className="btn-sm danger"
                onClick={() => void remove()}
              >
                Excluir
              </button>
            )}
            <button
              type="button"
              className="btn-s"
              disabled={deleting}
              onClick={() => setConfirmUser(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}