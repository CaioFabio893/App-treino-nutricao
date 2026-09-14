"use client";

import type { ReactNode } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmação reutilizável (padrão .modal-bg/.modal-box).
 * Usado para exclusões e ações destrutivas no painel.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  busyLabel = "Aguarde…",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className={`modal-bg${open ? " open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div className="modal-box">
        <div className="modal-handle" />
        <div className="modal-title">{title}</div>
        <div className="modal-sub">{message}</div>
        <div className="btn-row">
          {busy ? (
            <button type="button" className="btn-sm danger" disabled>
              {busyLabel}
            </button>
          ) : (
            <button type="button" className="btn-sm danger" onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
          <button type="button" className="btn-s" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}