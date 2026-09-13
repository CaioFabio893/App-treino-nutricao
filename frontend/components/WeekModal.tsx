"use client";

import { WEEK_COUNT } from "@/lib/data";

interface WeekModalProps {
  open: boolean;
  week: number;
  onClose: () => void;
  onSelect: (week: number) => void;
}

export default function WeekModal({ open, week, onClose, onSelect }: WeekModalProps) {
  return (
    <div className={`modal-bg${open ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ paddingBottom: 40 }}>
        <div className="modal-handle" />
        <div className="modal-title">Semana atual</div>
        <div className="week-grid">
          {Array.from({ length: WEEK_COUNT }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              type="button"
              className={`wk-btn${w === week ? " active" : ""}`}
              onClick={() => onSelect(w)}
            >
              Sem {w}
            </button>
          ))}
        </div>
        <button type="button" className="btn-s full" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}