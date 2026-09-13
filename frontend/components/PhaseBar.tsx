"use client";

import type { Phase } from "@/lib/types";

interface PhaseBarProps {
  phase: Phase | null;
  done: number;
  total: number;
}

export default function PhaseBar({ phase, done, total }: PhaseBarProps) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (!phase) return null;
  return (
    <div>
      <div className="phase-box">
        <div>
          <div className="phase-lbl">Fase atual</div>
          <div className="phase-sub">{phase.label}</div>
        </div>
        <div className="phase-pct">{phase.pct}%</div>
      </div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="prog-lbl">
        {done} de {total} séries · {pct}%
      </div>
    </div>
  );
}