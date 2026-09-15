"use client";

import { useEffect } from "react";

// Error boundary raiz (App Router): quando qualquer página/layout abaixo do
// layout raiz lançar erro em runtime, mostra esta UI em vez de tela branca.
// Convenção Next 16: props `error` + `retry` (estável desde v16.3).
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Registro no console para diagnóstico (pode ser ligado a um serviço
    // de monitoramento de erros no futuro).
    console.error(error);
  }, [error]);

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo-text" style={{ marginBottom: 4 }}>
          Ops!
          <span>Algo deu errado</span>
        </div>
        <p className="login-sub">
          Ocorreu um erro inesperado ao carregar esta página. Tente novamente —
          na maioria dos casos é só um problema temporário de conexão.
        </p>
        {error.digest && (
          <p className="login-sub" style={{ fontSize: 11 }}>
            Código: {error.digest}
          </p>
        )}
        <div className="modal-acts">
          <button type="button" className="btn-p" onClick={() => retry()}>
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}