"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import PasswordInput from "@/components/PasswordInput";
import SetupNeeded, { LoadingScreen } from "@/components/SetupNeeded";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function LoginPage() {
  const { user, initializing, configured, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  if (!configured) return <SetupNeeded />;
  if (initializing) return <LoadingScreen />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(friendlyAuthError((err as { code?: string })?.code, "Não foi possível entrar. Tente novamente."));
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
        <h2>Bem-vinda de volta</h2>
        <p className="login-sub">Acompanhe seu treino Ciclo 2</p>
      </div>

      <form className="login-card" onSubmit={submit} noValidate>
        {error && (
          <div className="login-err" role="alert">
            {error}
          </div>
        )}

        <div className="inp-row">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ fontSize: 16 }}
          />
        </div>

        <div className="inp-row">
          <div className="inp-head">
            <label htmlFor="login-password">Senha</label>
            <Link href="/recuperar-senha" className="forgot-link">
              Esqueci minha senha
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            minLength={6}
            required
            placeholder="••••••"
          />
        </div>

        <div className="modal-acts">
          <button type="submit" className="btn-p" disabled={busy}>
            {busy ? "Aguarde…" : "Entrar"}
          </button>
        </div>

        <p className="mode-switch">
          Não possui uma conta?{" "}
          <Link href="/cadastro" className="mode-switch-link">
            Criar nova conta
          </Link>
        </p>
      </form>
    </div>
  );
}