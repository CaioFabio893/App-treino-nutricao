"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";

export default function ProfileSetup() {
  const { user, getToken, refreshProfile, logout, configured } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await api.putMe(
        {
          id: (user as { uid?: string }).uid || "",
          name: name.trim(),
          email: (user as { email?: string }).email || "",
          role: "student",
          status: "active",
        },
        token
      );
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };

  if (!configured) return null;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo-text" style={{ marginBottom: 4 }}>
          Bem-vindo!
          <span>Complete seu cadastro</span>
        </div>
        <p className="login-sub">
          Para começar, digite seu nome. (A vinculação com seu nutricionista e o
          tipo de acesso são definidos pela sua equipe.)
        </p>
        <form onSubmit={(e) => void submit(e)}>
          {error && <div className="login-err">{error}</div>}
          <div className="inp-row">
            <label>Nome</label>
            <input
              value={name}
              required
              placeholder="Seu nome"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="modal-acts">
            <button type="submit" className="btn-p" disabled={busy || !name.trim()}>
              {busy ? "Salvando…" : "Continuar"}
            </button>
          </div>
          <div className="mode-switch">
            <button type="button" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}