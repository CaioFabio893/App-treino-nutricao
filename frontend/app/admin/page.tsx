"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";

const emptyUser = (): UserProfile => ({
  id: "",
  name: "",
  email: "",
  role: "student",
  status: "active",
});

export default function AdminPage() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [nutritionists, setNutritionists] = useState<UserProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<UserProfile>(emptyUser());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
      if (editingId) {
        const p: UserProfile = { ...form, id: editingId };
        await api.updateUser(editingId, p, token);
        showToast("✓ Usuário atualizado");
      } else {
        if (!form.id.trim()) {
          setError("O campo ID (uid do Firebase) é obrigatório");
          setBusy(false);
          return;
        }
        await api.createUser(form, token);
        showToast("✓ Usuário criado");
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

  const remove = async (u: UserProfile) => {
    if (!confirm(`Excluir o usuário "${u.name || u.id}"?`)) return;
    try {
      const token = await getToken();
      await api.deleteUser(u.id, token);
      showToast("✓ Usuário excluído");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir");
    }
  };

  const startEdit = (u: UserProfile) => {
    setEditingId(u.id);
    setForm({ ...u });
    window.scrollTo(0, 0);
  };

  if (!ready) return <LoadingScreen />;

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
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>Status</label>
            <select
              value={form.status ?? "active"}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
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
                  <img src={u.photoURL} alt={u.name} />
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
              <button type="button" className="btn-sm danger" onClick={() => void remove(u)}>
                Excluir
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}