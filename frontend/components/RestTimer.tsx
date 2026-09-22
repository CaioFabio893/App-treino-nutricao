"use client";

import { useEffect, useRef, useState } from "react";

const DUR_SECONDS = [60, 120, 180];

function fmt(s: number): string {
  const sec = Math.max(0, Math.floor(s));
  return (
    String(Math.floor(sec / 60)).padStart(2, "0") +
    ":" +
    String(sec % 60).padStart(2, "0")
  );
}

interface RestTimerProps {
  visible: boolean;
}

export default function RestTimer({ visible }: RestTimerProps) {
  const [dur, setDur] = useState(180);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  // Ao abrir pelo card, o cronômetro começa automaticamente (como no original) —
  // mas somente na primeira vez que fica visível (trocar a duração não reinicia).
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setElapsed((prev) => (prev >= dur ? 0 : prev));
      setRunning(true);
    }
    wasVisible.current = visible;
  }, [visible, dur]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsed((prev) => {
        const nv = prev + 0.25;
        if (nv >= dur) {
          setRunning(false);
          if (navigator.vibrate) navigator.vibrate(400);
          return dur;
        }
        return nv;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [running, dur]);

  const finished = !running && elapsed >= dur;

  return (
    <div className="timer-wrap" style={{ display: visible ? "block" : "none" }}>
      <div className="timer-head">
        <div className={`timer-display${finished ? " done" : ""}`}>{fmt(elapsed)}</div>
        <div className="timer-lbl">Cronômetro · máx 3&apos;</div>
      </div>
      <div className="timer-bar">
        <div
          className={`timer-fill${finished ? " done" : ""}`}
          style={{ width: `${Math.min(100, (elapsed / dur) * 100)}%` }}
        />
      </div>
      <div className="timer-acts">
        {DUR_SECONDS.map((sec) => (
          <button
            key={sec}
            type="button"
            className={`tp-btn${dur === sec ? " active" : ""}`}
            onClick={() => {
              setDur(sec);
              setElapsed(0);
              setRunning(false);
            }}
          >
            {sec / 60}&apos;
          </button>
        ))}
        <button
          type="button"
          className="tp-btn start"
          onClick={() => {
            if (elapsed >= dur) setElapsed(0);
            setRunning((r) => !r);
          }}
        >
          {running ? "⏸ Pausar" : "▶ Iniciar"}
        </button>
        <button
          type="button"
          className="tp-btn"
          onClick={() => {
            setRunning(false);
            setElapsed(0);
          }}
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}