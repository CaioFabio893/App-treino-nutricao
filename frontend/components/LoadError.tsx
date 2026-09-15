"use client";

// Estado de erro de carregamento reutilizável: mensagem amigável + botão
// "Tentar novamente". Substitui o estado vazio enganoso quando a carga falhou
// (ex.: API fora do ar) — o usuário vê o erro real e pode recuperar.
export default function LoadError({
  message = "Não foi possível carregar os dados.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="load-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn-sm" onClick={() => onRetry()}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}