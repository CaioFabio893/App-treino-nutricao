"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import SetupNeeded, { LoadingScreen } from "@/components/SetupNeeded";

function friendly(code?: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/email-already-in-use":
      return "Esse e-mail já está cadastrado.";
    case "auth/weak-password":
      return "Senha muito fraca (mínimo 6 caracteres).";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/too-many-requests":
      return "Muitas tentativas — aguarde um pouco.";
    case "auth/network-request-failed":
      return "Falha de conexão.";
    default:
      return "Não foi possível entrar. Tente novamente.";
  }
}

export default function LoginPage() {
  const { user, initializing, configured, login, signup } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
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
      if (mode === "login") await login(email, password);
      else await signup(email, password);
    } catch (err) {
      setError(friendly((err as { code?: string })?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-logo">
        <svg width="56" height="56" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="26" cy="7" rx="4" ry="2.5" fill="#7a8f4e" transform="rotate(-30 26 7)" />
          <ellipse cx="32" cy="6" rx="4" ry="2.5" fill="#5a6b3a" transform="rotate(20 32 6)" />
          <circle cx="30" cy="33" r="19" stroke="#c0622a" strokeWidth="2" fill="none" />
          <path d="M23 20 Q21 28 22 38 Q26 42 35 41" stroke="#c0622a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M22 38 Q30 35 37 37" stroke="#c0622a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
        <div className="logo-text">
          Louise Lima
          <span>Nutricionista</span>
        </div>
        <h2>{mode === "login" ? "Bem-vinda de volta" : "Criar conta"}</h2>
        <p className="login-sub">Acompanhe seu treino Ciclo 2</p>
      </div>

      <form className="login-card" onSubmit={submit}>
        {error && <div className="login-err">{error}</div>}
        <div className="inp-row">
          <label>E-mail</label>
          <input
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
          <label>Senha</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ fontSize: 16 }}
          />
        </div>
        <div className="modal-acts">
          <button type="submit" className="btn-p" disabled={busy}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </div>
        <div className="mode-switch">
          {mode === "login" ? (
            <>
              Ainda não tem conta?{" "}
              <button type="button" onClick={() => setMode("signup")}>
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <button type="button" onClick={() => setMode("login")}>
                Entrar
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}