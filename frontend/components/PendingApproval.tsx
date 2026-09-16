"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Tela exibida quando o cadastro está aguardando aprovação do admin
 * (status pending_approval) ou foi recusado (status rejected).
 *
 * Enquanto pendente, recarrega o perfil a cada 30s: assim que o admin
 * aprovar, o status muda para active e este componente sai de cena
 * (o app/page.tsx redireciona para a área do usuário automaticamente).
 */
export default function PendingApproval() {
  const { profile, refreshProfile, logout } = useAuth();
  const rejected = profile?.status === "rejected";
  const reason = profile?.rejectedReason;

  useEffect(() => {
    const timer = window.setInterval(() => void refreshProfile(), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshProfile]);

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo-text" style={{ marginBottom: 4 }}>
          {rejected ? "Cadastro recusado" : "Cadastro em análise"}
          <span>{rejected ? "Informe sua equipe" : "Aguarde a liberação do acesso"}</span>
        </div>
        <p className="login-sub">
          {rejected ? (
            reason ? (
              <>Motivo: <strong>{reason}</strong>. Se achar que foi um engano,
                procure sua equipe de nutrição.</>
            ) : (
              "Seu cadastro não foi aprovado. Procure sua equipe de nutrição."
            )
          ) : (
            <>
              Seu cadastro foi enviado e está{" "}
              <strong>aguardando aprovação</strong>. Assim que a equipe liberar
              seu acesso, você será redirecionado automaticamente para cá.
            </>
          )}
        </p>
        <div className="modal-acts">
          <button type="button" className="btn-p" disabled>
            {rejected ? "Sem acesso" : "Aguardando aprovação…"}
          </button>
        </div>
        <div className="mode-switch">
          <button type="button" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}