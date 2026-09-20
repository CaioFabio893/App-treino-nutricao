import React from "react";

interface Props {
  onAction?: () => void;
}

/**
 * Estado vazio da tela de Dietas.
 *
 * Usa somente os tokens/classes do design system do app (`--white`, `--border`,
 * `--peach`, `--terra`, `.btn-sm.acc`) para manter as mesmas bordas, raios,
 * tipografia e hover já usados no restante da interface. O botão de ação só
 * aparece quando um callback de cadastro é fornecido.
 */
export function EmptyDietState({ onAction }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" stroke="var(--border)" strokeWidth="1" />
          <path d="M18 8h-3a3 3 0 0 0-3 3v3" />
          <path d="M6 12h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6v-6z" />
          <path
            d="M12 11c0-1.5 1-3 2.5-3S17 9.5 17 11s-1 3-2.5 3S12 12.5 12 11z"
            fill="var(--ok)"
            fillOpacity="0.12"
            stroke="none"
          />
        </svg>
      </div>

      <h3 className="empty-state-title">Nenhuma dieta cadastrada</h3>

      <p className="empty-state-text">
        Adicione uma refeição ou plano alimentar para acompanhar a nutrição do
        aluno.
      </p>

      {onAction && (
        <button type="button" className="btn-sm acc" onClick={onAction}>
          Cadastrar Dieta
        </button>
      )}
    </div>
  );
}
