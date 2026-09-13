"use client";

import type { CardioOption } from "@/lib/types";

export default function CardioBox({ options }: { options: CardioOption[] }) {
  return (
    <div>
      <div className="section-label">🔥 Cardio Final</div>
      <div className="wod-box">
        <div className="wod-title">Fechamento — Cardio</div>
        {options.map((opt, i) => (
          <div className="cardio-opt" key={opt.op}>
            <div className="cardio-opt-title">{opt.op}</div>
            <ul className="wod-list">
              {opt.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {i < options.length - 1 && <hr className="cardio-hr" />}
          </div>
        ))}
      </div>
    </div>
  );
}