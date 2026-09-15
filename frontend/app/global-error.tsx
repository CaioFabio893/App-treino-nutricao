"use client";

// Error boundary GLOBAL: captura erros no LAYOUT RAIZ (o error.tsx comum não
// envolve o próprio root layout). Por exigência do Next, renderiza um
// documento completo próprio (<html>/<body>) com estilos inline — ele não
// herda o CSS global.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F1F5F3",
          color: "#172420",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px", color: "#0B6B52" }}>
            Ops! Algo deu errado
          </h1>
          <p style={{ margin: "0 0 16px", color: "#63736C" }}>
            Ocorreu um erro inesperado. Tente recarregar a página.{" "}
            {error.digest ? `(Código: ${error.digest})` : ""}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              padding: "10px 20px",
              border: 0,
              borderRadius: 10,
              background: "#0B6B52",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}