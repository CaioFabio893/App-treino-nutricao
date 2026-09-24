"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import SetupNeeded, { LoadingScreen } from "@/components/SetupNeeded";
import { friendlyResetError } from "@/lib/auth-errors";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function RecuperarSenhaPage() {
  const { configured, initializing, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!configured) return <SetupNeeded />;
  if (initializing) return <LoadingScreen />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setEmailError("Informe seu e-mail.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setEmailError("E-mail inválido.");
      return;
    }
    setEmailError(null);
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      // user-not-found retorna null: vira sucesso genérico (anti-enumeração).
      const msg = friendlyResetError((err as { code?: string })?.code);
      if (msg === null) {
        setSent(true);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-logo">
        <svg width="56" height="56" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="26" cy="7" rx="4" ry="2.5" fill="#56A685" transform="rotate(-30 26 7)" />
          <ellipse cx="32" cy="6" rx="4" ry="2.5" fill="#3A7D66" transform="rotate(20 32 6)" />
          <circle cx="30" cy="33" r="19" stroke="#0B6B52" strokeWidth="2" fill="none" />
          <path d="M23 20 Q21 28 22 38 Q26 42 35 41" stroke="#0B6B52" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M22 38 Q30 35 37 37" stroke="#0B6B52" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
        <div className="logo-text">
          Louise Lima
          <span>Nutricionista</span>
        </div>
        <h2>Recuperar senha</h2>
        <p className="login-sub">
          Informe seu e-mail cadastrado e enviaremos as instruções para redefinir sua senha.
        </p>
      </div>

      <div className="login-card">
        {sent ? (
          <div className="recover-sent" role="status">
            <p className="login-ok">
              Se o e-mail estiver cadastrado, enviaremos as instruções para redefinir sua senha.
            </p>
            <p className="recover-hint">
              Confira também a caixa de spam. Você pode fechar esta tela e voltar ao login.
            </p>
            <div className="modal-acts">
              <Link href="/login" className="btn-p recover-back-link">
                Voltar para o login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="login-err" role="alert">
                {error}
              </div>
            )}

            <div className="inp-row">
              <label htmlFor="recover-email">E-mail</label>
              <input
                id="recover-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "recover-email-error" : undefined}
                style={{ fontSize: 16 }}
              />
              {emailError && (
                <p id="recover-email-error" className="field-err" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            <div className="modal-acts">
              <button type="submit" className="btn-p" disabled={busy}>
                {busy ? "Enviando…" : "Enviar"}
              </button>
            </div>

            <p className="mode-switch">
              Lembrou a senha?{" "}
              <Link href="/login" className="mode-switch-link">
                Voltar para o login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}