"use client";

import Avatar from "@/components/Avatar";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile } from "@/lib/types";

interface ApproveTarget {
  id: string;
  name: string;
}

/**
 * Fila de cadastros aguardando aprovação (admin).
 * Aprovar = concede papel de aluno e libera o acesso;
 * Recusar = marca rejected e exclui a conta do Firebase Auth (decisão SB-001).
 */
export default function PendingApprovals() {
  const { getToken } = useAuth();
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [approving, setApproving] = useState<ApproveTarget | null>(null);
  const [rejecting, setRejecting] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const p = await api.listPendingUsers(token);
      setPending(p);
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
          // Aprovação de cadastro concede SEMPRE role=student: não há
          // promoção para admin por esta rota. O admin cria outro admin
          // explicitamente em /admin/usuarios.
          role: "student",
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
                <Avatar alt={u.name} />
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

      {/* Modal de aprovação de aluno */}
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
            {/* A aprovação de cadastro SEMPRE concede role=student (a API Go
                rejeita qualquer outro valor). O admin cria outro admin
                explicitamente em /admin/usuarios — por isso não há seletor
                aqui: offer Choices seria UI mentirosa. */}
            <select value="student" disabled>
              <option value="student">Aluno</option>
            </select>
          </div>
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
