"use client";

import { useEffect, useState } from "react";
import type { PRs } from "@/lib/types";

interface PRModalProps {
  open: boolean;
  prs: PRs;
  onClose: () => void;
  onSave: (prs: PRs) => void;
}

export default function PRModal({ open, prs, onClose, onSave }: PRModalProps) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");

  useEffect(() => {
    if (open) {
      setA(prs.a ? String(prs.a) : "");
      setB(prs.b ? String(prs.b) : "");
      setC(prs.c ? String(prs.c) : "");
    }
  }, [open, prs]);

  const save = () => {
    onSave({
      a: parseFloat(a) || 0,
      b: parseFloat(b) || 0,
      c: parseFloat(c) || 0,
    });
  };

  return (
    <div className={`modal-bg${open ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-handle" />
        <div className="modal-title">Seus PRs</div>
        <div className="inp-row">
          <label>Agachamento Livre (kg)</label>
          <input type="number" inputMode="decimal" step="0.5" placeholder="ex: 60" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div className="inp-row">
          <label>Elevação Pélvica (kg)</label>
          <input type="number" inputMode="decimal" step="0.5" placeholder="ex: 80" value={b} onChange={(e) => setB(e.target.value)} />
        </div>
        <div className="inp-row">
          <label>Leg Press 45° (kg)</label>
          <input type="number" inputMode="decimal" step="0.5" placeholder="ex: 120" value={c} onChange={(e) => setC(e.target.value)} />
        </div>
        <div className="modal-acts">
          <button type="button" className="btn-s" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-p" onClick={save}>
            Salvar PRs
          </button>
        </div>
      </div>
    </div>
  );
}