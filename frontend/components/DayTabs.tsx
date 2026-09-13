"use client";

import type { DayPlan } from "@/lib/types";

interface DayTabsProps {
  days: DayPlan[];
  current: number;
  onSwitch: (index: number) => void;
}

export default function DayTabs({ days, current, onSwitch }: DayTabsProps) {
  return (
    <div id="tabs">
      {days.map((d, i) => (
        <button
          key={d.id}
          type="button"
          className={`tab${i === current ? " active" : ""}`}
          onClick={() => onSwitch(i)}
        >
          {d.label}
          <br />
          <span style={{ fontSize: 8, opacity: 0.6 }}>{d.name}</span>
        </button>
      ))}
    </div>
  );
}