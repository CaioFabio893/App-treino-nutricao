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
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Janela fechada antes de concluir o login. Tente novamente.";
    case "auth/account-exists-with-different-credential":
      return "Já existe uma conta com este e-mail (senha). Entre com e-mail e senha.";
    case "auth/popup-blocked":
      return "O navegador bloqueou o popup do Google. Permita popups e tente novamente.";
    default:
      return "Não foi possível entrar. Tente novamente.";
  }
}

export default function LoginPage() {
  const { user, initializing, configured, login, signup, loginWithGoogle } = useAuth();
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

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
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
        <h2>{mode === "login" ? "Bem-vinda de volta" : "Criar conta"}</h2>
        <p className="login-sub">Acompanhe seu treino Ciclo 2</p>
      </div>

      <form className="login-card" onSubmit={submit}>
        {error && <div className="login-err">{error}</div>}
        {/* Login com conta Google (cadastro novo já cai no fluxo de aprovação) */}
        <button
          type="button"
          className="btn-google"
          disabled={busy}
          onClick={() => void handleGoogle()}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>
          {busy ? "Aguarde…" : "Entrar com Google"}
        </button>

        <div className="login-divider" role="separator">
          <span>ou continue com e-mail</span>
        </div>

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