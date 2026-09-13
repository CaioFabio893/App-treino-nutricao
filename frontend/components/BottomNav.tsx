"use client";

interface BottomNavProps {
  onPrev: () => void;
  onSave: () => void;
  onNext: () => void;
  dirty: boolean;
  saving: boolean;
}

export default function BottomNav({ onPrev, onSave, onNext, dirty, saving }: BottomNavProps) {
  return (
    <div id="bottom">
      <button type="button" className="nav-btn" onClick={onPrev}>
        ◀ Anterior
      </button>
      <button type="button" className="nav-btn acc" onClick={onSave} disabled={saving && !dirty}>
        {saving ? "Salvando…" : dirty ? "💾 Salvar*" : "💾 Salvar"}
      </button>
      <button type="button" className="nav-btn" onClick={onNext}>
        Próximo ▶
      </button>
    </div>
  );
}