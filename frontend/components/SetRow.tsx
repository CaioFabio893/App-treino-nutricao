"use client";

import type { Check, SetData } from "@/lib/types";

interface SetRowProps {
  num: number;
  set: SetData;
  target: string;
  placeholderKg?: string;
  onValue: (field: "w" | "r", value: number | undefined) => void;
  onCycle: () => void;
}

function parseNum(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export default function SetRow({
  num,
  set,
  target,
  placeholderKg,
  onValue,
  onCycle,
}: SetRowProps) {
  const c = set.c as Check;
  return (
    <div className="s-row">
      <span className="s-num">{num}</span>
      <input
        className="w-inp"
        type="number"
        inputMode="decimal"
        step="0.5"
        value={set.w !== undefined ? set.w : ""}
        placeholder={placeholderKg || "kg"}
        onChange={(e) => onValue("w", parseNum(e.target.value))}
      />
      <input
        className="r-inp"
        type="number"
        inputMode="numeric"
        value={set.r !== undefined ? set.r : ""}
        placeholder="reps"
        onChange={(e) => onValue("r", parseNum(e.target.value))}
      />
      <span className="s-tgt" style={{ fontSize: 10 }}>
        {target}
      </span>
      <button
        type="button"
        className={`chk-btn${c === "ok" ? " ok" : c === "fail" ? " fail" : ""}`}
        onClick={onCycle}
      >
        {c === "ok" ? "✓" : c === "fail" ? "✗" : "·"}
      </button>
    </div>
  );
}