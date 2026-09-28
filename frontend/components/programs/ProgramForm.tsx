"use client";

import { useMemo, useState } from "react";
import * as api from "@/lib/api";
import type { ProgramWorkout, TrainingProgram, WorkoutDefine } from "@/lib/types";
import { PROGRAM_DAY_SHORT } from "@/lib/programDays";

interface Props {
  initial: TrainingProgram;
  /** Treinos visíveis ao nutricionista (biblioteca + dos alunos). */
  workouts: WorkoutDefine[];
  getToken: () => Promise<string>;
  onDone: () => void;
  onCancel: () => void;
}

/** Rótulo curto do treino no seletor: "A · Peito e Tríceps · Seg". */
function workoutLabel(w: WorkoutDefine): string {
  const parts = [w.name];
  if (w.dayOfWeek) parts.push(PROGRAM_DAY_SHORT[w.dayOfWeek] ?? w.dayOfWeek);
  if (w.exercises?.length) parts.push(`${w.exercises.length} ex.`);
  return parts.filter(Boolean).join(" · ");
}

/**
 * Edição de um programa existente: metadados + lista ORDENADA de treinos.
 *
 * O programa só guarda referências, então o form nunca edita exercícios — ele
 * adiciona/remove/reordena treinos já existentes (criados na tela de Treinos ou
 * pela importação). Para mudar um exercício, o nutricionista edita o treino.
 */
export default function ProgramForm({ initial, workouts, getToken, onDone, onCancel }: Props) {
  const [name, setName] = useState(initial.name);
  const [objective, setObjective] = useState(initial.objective ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [refs, setRefs] = useState<ProgramWorkout[]>(initial.workouts ?? []);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Treinos já no programa ficam fora do seletor (não dá para duplicar referência).
  const available = useMemo(() => {
    const inProgram = new Set(refs.map((r) => r.workoutId));
    return workouts.filter((w) => w.id && !inProgram.has(w.id));
  }, [workouts, refs]);

  const addRef = () => {
    if (!pick) return;
    const w = workouts.find((x) => x.id === pick);
    if (!w) return;
    setRefs((prev) => [
      ...prev,
      {
        workoutId: w.id!,
        order: prev.length + 1,
        name: w.name,
        dayOfWeek: w.dayOfWeek,
      },
    ]);
    setPick("");
  };

  const moveRef = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= refs.length) return;
    setRefs((prev) => {
      const next = [...prev];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const removeRef = (i: number) => {
    setRefs((prev) => prev.filter((_, j) => j !== i));
  };

  const canSave = Boolean(name.trim()) && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      // `order` é reescrito pela posição final da lista (fonte da verdade).
      const payload: TrainingProgram = {
        studentId: initial.studentId,
        nutritionistId: initial.nutritionistId,
        name: name.trim(),
        objective: objective.trim(),
        description: description.trim(),
        notes: notes.trim(),
        source: initial.source,
        workouts: refs.map((r, i) => ({ ...r, order: i + 1 })),
      };
      await api.updateProgram(initial.id!, payload, token);
      onDone();
    } catch (e) {
      setError(api.friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" className="btn-sm" onClick={onCancel}>
          ‹ Voltar
        </button>
      </div>

      <div className="page-head">
        <div>
          <h1>Editar programa</h1>
          <div className="page-sub">Ajuste os dados e a ordem dos treinos.</div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      <div className="frm-card">
        <h3>Dados do programa</h3>
        <div className="frm-row">
          <label>Nome do programa</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="frm-row">
          <label>Objetivo</label>
          <input
            value={objective}
            placeholder="Ex.: Hipertrofia de inferiores"
            onChange={(e) => setObjective(e.target.value)}
          />
        </div>
        <div className="frm-row">
          <label>Descrição (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="frm-row">
          <label>Observações da fonte (PRs, periodização, estrutura semanal)</label>
          <textarea
            value={notes}
            rows={6}
            onChange={(e) => setNotes(e.target.value)}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
          />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Texto preservado literalmente da importação. Edite só se precisar corrigir algo.
          </div>
        </div>
        {initial.source && (
          <div className="frm-row">
            <label>Origem</label>
            <input value={initial.source} readOnly disabled />
          </div>
        )}
      </div>

      <div className="section-label">Treinos do programa ({refs.length})</div>

      {refs.length === 0 ? (
        <div className="empty-box">
          Nenhum treino neste programa. Use o seletor abaixo para incluir.
        </div>
      ) : (
        refs.map((r, i) => {
          const w = workouts.find((x) => x.id === r.workoutId);
          return (
            <div key={`${r.workoutId}-${i}`} className="item-card">
              <div className="item-card-head">
                <b>
                  {i + 1}. {w?.name || r.name || r.workoutId}
                </b>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn-sm"
                    disabled={i === 0}
                    onClick={() => moveRef(i, -1)}
                    style={{ padding: "4px 10px" }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-sm"
                    disabled={i === refs.length - 1}
                    onClick={() => moveRef(i, 1)}
                    style={{ padding: "4px 10px" }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-sm danger"
                    onClick={() => removeRef(i)}
                    style={{ padding: "4px 10px" }}
                  >
                    Remover
                  </button>
                </div>
              </div>
              <div className="nut-meta">
                <span className="badge">
                  {(w?.dayOfWeek || r.dayOfWeek)
                    ? PROGRAM_DAY_SHORT[(w?.dayOfWeek || r.dayOfWeek)!] ??
                      (w?.dayOfWeek || r.dayOfWeek)
                    : "Sem dia"}
                </span>
                <span className="badge">{w?.exercises?.length ?? 0} exercícios</span>
                {w && !w.exercises?.length && <span className="badge">sem exercícios cadastrados</span>}
              </div>
            </div>
          );
        })
      )}

      <div className="frm-card">
        <h3>Incluir treino</h3>
        {available.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Não há mais treinos disponíveis. Crie um treino ou importe um programa.
          </p>
        ) : (
          <div className="frm-row-inline">
            <div className="frm-row">
              <select value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Selecione um treino…</option>
                {available.map((w) => (
                  <option key={w.id} value={w.id}>
                    {workoutLabel(w)}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-sm" disabled={!pick} onClick={addRef}>
              Incluir
            </button>
          </div>
        )}
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button type="button" className="btn-p" disabled={!canSave} onClick={() => void save()}>
          {busy ? "Salvando…" : "Salvar programa"}
        </button>
      </div>
    </div>
  );
}
