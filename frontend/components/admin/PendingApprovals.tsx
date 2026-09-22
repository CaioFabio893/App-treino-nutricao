"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Plan, UserProfile } from "@/lib/types";
import Avatar from "@/components/Avatar";

interface ApproveTarget {
  id: string;
  name: string;
  role: "student" | "nutritionist";
  planID: string;
}

/**
 * Fila de cadastros aguardando aprovação (admin).
 * Aprovar = define papel (e plano, para aluno) e libera o acesso;
 * Recusar = marca rejected e exclui a conta do Firebase Auth (decisão SB-001).
 */
export default function PendingApprovals() {
  const { getToken } = useAuth();
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(false);
  const [approving, setApproving] = useState<ApproveTarget | null>(null);
  const [rejecting, setRejecting] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [p, pl] = await Promise.all([api.listPendingUsers(token), api.listPlans(token)]);
      setPending(p);
      setPlans(pl);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar cadastros pendentes");
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const doApprove = async () => {
    if (!approving || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await api.approveUser(
        approving.id,
        {
          role: approving.role,
          planID: approving.role === "student" ? approving.planID || undefined : undefined,
        },
        token
      );
      setApproving(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao aprovar");
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!rejecting || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await api.rejectUser(rejecting.id, { reason: reason.trim() || undefined }, token);
      setRejecting(null);
      setReason("");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao recusar");
    } finally {
      setBusy(false);
    }
  };

  const activePlans = plans.filter((p) => p.active);
  const featuresLabel = (planID: string) =>
    plans.find((p) => p.id === planID)?.features.join(", ") ?? "";

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-label">Cadastros pendentes ({pending.length})</div>
      {error && <div className="err-text">{error}</div>}
      {!ready ? (
        <div className="empty-box">Carregando cadastros…</div>
      ) : pending.length === 0 ? (
        <div className="empty-box">Nenhum cadastro aguardando aprovação. Tudo em dia!</div>
      ) : (
        pending.map((u) => (
          <div key={u.id} className="nut-card" style={{ cursor: "default" }}>
            <div className="nut-card-head">
              <div className="avatar">
                {u.photoURL ? (
                  <Avatar src={u.photoURL} alt={u.name} />
                ) : (
                  u.name?.charAt(0)?.toUpperCase() || "?"
                )}
              </div>
              <div>
                <div className="nut-card-title">{u.name || "Sem nome"}</div>
                <div className="nut-card-sub">
                  {u.email ?? u.id.slice(0, 12)}… ·{" "}
                  {u.authProvider === "google.com" ? "login Google" : "login e-mail"}
                </div>
              </div>
            </div>
            <span className="badge pending_approval">aguardando aprovação</span>
            <div className="btn-row">
              <button
                type="button"
                className="btn-sm acc"
                onClick={() =>
                  setApproving({
                    id: u.id,
                    name: u.name || u.id,
                    role: "student",
                    planID: activePlans[0]?.id ?? "",
                  })
                }
              >
                Aprovar
              </button>
              <button type="button" className="btn-sm danger" onClick={() => setRejecting(u)}>
                Recusar
              </button>
            </div>
          </div>
        ))
      )}

      {/* Modal de aprovação: papel + plano (aluno) */}
      <div
        className={`modal-bg${approving ? " open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && !busy && setApproving(null)}
      >
        <div className="modal-box">
          <div className="modal-handle" />
          <div className="modal-title">Aprovar cadastro</div>
          <div className="modal-sub">
            Liberar acesso para <strong>{approving?.name}</strong>?
          </div>
          <div className="frm-row" style={{ marginTop: 12 }}>
            <label>Papel</label>
            <select
              value={approving?.role ?? "student"}
              onChange={(e) =>
                setApproving((a) =>
                  a ? { ...a, role: e.target.value as "student" | "nutritionist" } : a
                )
              }
            >
              <option value="student">Aluno</option>
              <option value="nutritionist">Nutricionista</option>
            </select>
          </div>
          {approving?.role === "student" && (
            <div className="frm-row" style={{ marginTop: 10 }}>
              <label>Plano (define as features liberadas)</label>
              <select
                value={approving.planID}
                onChange={(e) =>
                  setApproving((a) => (a ? { ...a, planID: e.target.value } : a))
                }
              >
                <option value="">— Sem plano —</option>
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.description ? ` — ${p.description}` : ""}
                  </option>
                ))}
              </select>
              {approving.planID && (
                <div className="page-sub">Features: {featuresLabel(approving.planID)}</div>
              )}
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 14 }}>
            {busy ? (
              <button type="button" className="btn-sm acc" disabled>
                Aprovando…
              </button>
            ) : (
              <button type="button" className="btn-sm acc" onClick={() => void doApprove()}>
                Aprovar
              </button>
            )}
            <button
              type="button"
              className="btn-s"
              disabled={busy}
              onClick={() => setApproving(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de recusa: motivo + aviso de exclusão da conta */}
      <div
        className={`modal-bg${rejecting ? " open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && !busy && setRejecting(null)}
      >
        <div className="modal-box">
          <div className="modal-handle" />
          <div className="modal-title">Recusar cadastro</div>
          <div className="modal-sub">
            Você confirma a recusa de <strong>{rejecting?.name || rejecting?.id || ""}</strong>?
            <br />
            A conta do Firebase Auth será <strong>excluída</strong> e a pessoa não
            conseguirá mais entrar. O registro fica salvo como recusado.
          </div>
          <div className="frm-row" style={{ marginTop: 12 }}>
            <label>Motivo (opcional)</label>
            <input
              value={reason}
              placeholder="ex.: e-mail de outra pessoa, documento divergente"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            {busy ? (
              <button type="button" className="btn-sm danger" disabled>
                Recusando…
              </button>
            ) : (
              <button type="button" className="btn-sm danger" onClick={() => void doReject()}>
                Recusar e excluir conta
              </button>
            )}
            <button
              type="button"
              className="btn-s"
              disabled={busy}
              onClick={() => setRejecting(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}