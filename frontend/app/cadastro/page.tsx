"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import PasswordInput from "@/components/PasswordInput";
import SetupNeeded, { LoadingScreen } from "@/components/SetupNeeded";
import { friendlyAuthError } from "@/lib/auth-errors";

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function validate(email: string, password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email) errors.email = "Informe seu e-mail.";
  else if (!EMAIL_RE.test(email)) errors.email = "E-mail inválido.";
  if (!password) errors.password = "Crie uma senha (mínimo 6 caracteres).";
  else if (password.length < 6) errors.password = "Senha muito fraca (mínimo 6 caracteres).";
  if (!confirm) errors.confirm = "Confirme sua senha.";
  else if (password !== confirm) errors.confirm = "As senhas não coincidem.";
  return errors;
}

export default function CadastroPage() {
  const { user, initializing, configured, signup } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Só valida ao vivo (ao digitar) depois da primeira tentativa de submit,
  // para não mostrar erros antes de o usuário ter chance de preencher.
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  if (!configured) return <SetupNeeded />;
  if (initializing) return <LoadingScreen />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate(email, password, confirm);
    setTried(true);
    setErrors(next);
    setFormError(null);
    // Senha ≠ confirmação: bloqueia o cadastro aqui (sem chamar o Firebase).
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await signup(email, password);
      // user passa a existir via onAuthStateChanged → redirect para "/",
      // onde o fluxo de perfil (ProfileSetup / aprovação) segue.
    } catch (err) {
      setFormError(
        friendlyAuthError((err as { code?: string })?.code, "Não foi possível criar a conta. Tente novamente.")
      );
    } finally {
      setBusy(false);
    }
  };

  // Validação ao vivo após a primeira tentativa.
  const onEmailChange = (v: string) => {
    setEmail(v);
    if (tried) setErrors(validate(v, password, confirm));
  };
  const onPasswordChange = (v: string) => {
    setPassword(v);
    if (tried) setErrors(validate(email, v, confirm));
  };
  const onConfirmChange = (v: string) => {
    setConfirm(v);
    if (tried) setErrors(validate(email, password, v));
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
        <h2>Criar conta</h2>
        <p className="login-sub">Comece a acompanhar seu treino Ciclo 2</p>
      </div>

      <form className="login-card" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="login-err" role="alert">
            {formError}
          </div>
        )}

        <div className="inp-row">
          <label htmlFor="cadastro-email">E-mail</label>
          <input
            id="cadastro-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "cadastro-email-error" : undefined}
            style={{ fontSize: 16 }}
          />
          {errors.email && (
            <p id="cadastro-email-error" className="field-err" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        <div className="inp-row">
          <label htmlFor="cadastro-senha">Senha</label>
          <PasswordInput
            id="cadastro-senha"
            value={password}
            onChange={onPasswordChange}
            autoComplete="new-password"
            minLength={6}
            required
            placeholder="••••••"
            invalid={!!errors.password}
            describedBy={errors.password ? "cadastro-senha-error" : undefined}
          />
          {errors.password && (
            <p id="cadastro-senha-error" className="field-err" role="alert">
              {errors.password}
            </p>
          )}
        </div>

        <div className="inp-row">
          <label htmlFor="cadastro-senha-confirmacao">Confirmar senha</label>
          <PasswordInput
            id="cadastro-senha-confirmacao"
            value={confirm}
            onChange={onConfirmChange}
            autoComplete="new-password"
            minLength={6}
            required
            placeholder="••••••"
            invalid={!!errors.confirm}
            describedBy={errors.confirm ? "cadastro-senha-confirmacao-error" : undefined}
          />
          {errors.confirm && (
            <p id="cadastro-senha-confirmacao-error" className="field-err" role="alert">
              {errors.confirm}
            </p>
          )}
        </div>

        <div className="modal-acts">
          <button type="submit" className="btn-p" disabled={busy}>
            {busy ? "Aguarde…" : "Criar conta"}
          </button>
        </div>

        <p className="mode-switch">
          Já tem conta?{" "}
          <Link href="/login" className="mode-switch-link">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}