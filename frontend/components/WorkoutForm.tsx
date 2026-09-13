"use client";

import { useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine, WorkoutExercise } from "@/lib/types";

export const WEEK_DAYS = [
  { value: "", label: "Sem dia fixo" },
  { value: "monday", label: "Segunda" },
  { value: "tuesday", label: "Terça" },
  { value: "wednesday", label: "Quarta" },
  { value: "thursday", label: "Quinta" },
  { value: "friday", label: "Sexta" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
];

const newExercise = (order: number): WorkoutExercise => ({
  name: "",
  sets: 3,
  repetitions: "10",
  weight: "",
  restSeconds: 60,
  notes: "",
  order,
});

interface Props {
  initial?: WorkoutDefine;
  presetStudent?: string;
  copyId?: string;
  students: UserProfile[];
  getToken: () => Promise<string>;
  onDone: () => void;
  onCancel: () => void;
}

export default function WorkoutForm({
  initial,
  presetStudent,
  copyId,
  students,
  getToken,
  onDone,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [objective, setObjective] = useState(initial?.objective ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [studentId, setStudentId] = useState(initial?.studentId ?? presetStudent ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek ?? "");
  const [exercises, setExercises] = useState<WorkoutExercise[]>(
    initial?.exercises?.length
      ? initial.exercises
      : []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se veio com "copyId", carrega o treino de origem para preencher os exercícios.
  useEffect(() => {
    if (!copyId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const src = await api.getWorkout(copyId, token);
        if (!cancelled && src?.exercises) {
          setExercises(src.exercises.map((e) => ({ ...e, id: undefined })));
          if (!name) setName(`${src.name} (copia)`);
          if (!objective) setObjective(src.objective ?? "");
        }
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyId]);

  const setEx = (i: number, patch: Partial<WorkoutExercise>) => {
    setExercises((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, newExercise(prev.length + 1)]);
  };

  const removeExercise = (i: number) => {
    const ex = exercises[i];
    if (!ex.name || confirm(`Tem certeza que deseja excluir "${ex.name}"?`)) {
      setExercises((prev) => prev.filter((_, j) => j !== i));
    }
  };

  const moveExercise = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= exercises.length) return;
    setExercises((prev) => {
      const next = [...prev];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  // Drag & drop (HTML5 nativo, sem dependências).
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const dropAt = (target: number) => {
    if (dragIndex === null || dragIndex === target) return;
    setExercises((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragIndex(null);
  };

  const canSave = Boolean(name.trim()) && Boolean(studentId);

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const payload: WorkoutDefine = {
        studentId,
        nutritionistId: initial?.nutritionistId ?? "",
        name: name.trim(),
        objective: objective.trim(),
        description: description.trim(),
        dayOfWeek,
        exercises: exercises.map((e, i) => ({ ...e, order: i + 1 })),
      };
      if (initial?.id) {
        await api.updateWorkout(initial.id, payload, token);
      } else {
        await api.createWorkout(payload, token);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar treino");
    } finally {
      setBusy(false);
    }
  };

  const totalSets = useMemo(
    () => exercises.reduce((acc, e) => acc + (e.sets || 0), 0),
    [exercises]
  );

  return (
    <div>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" className="btn-sm" onClick={onCancel}>
          ‹ Voltar
        </button>
      </div>

      <div className="page-head">
        <div>
          <h1>{initial?.id ? "Editar treino" : "Novo treino"}</h1>
          <div className="page-sub">
            {initial?.id ? "Altere os campos e salve." : "Monte o treino do aluno."}
          </div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      <div className="frm-card">
        <h3>Dados do treino</h3>
        <div className="frm-row">
          <label>Nome do treino</label>
          <input
            value={name}
            placeholder="Ex.: Treino A — Peito e Tríceps"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>Objetivo</label>
            <input
              value={objective}
              placeholder="Ex.: Hipertrofia"
              onChange={(e) => setObjective(e.target.value)}
            />
          </div>
          <div className="frm-row">
            <label>Dia da semana</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
              {WEEK_DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="frm-row">
          <label>Aluno</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Selecione o aluno…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.id}
              </option>
            ))}
          </select>
        </div>
        <div className="frm-row">
          <label>Descrição (opcional)</label>
          <textarea
            value={description}
            placeholder="Observações gerais do treino…"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="section-label">
        Exercícios ({exercises.length} · {totalSets} séries)
      </div>

      {exercises.length === 0 && (
        <div className="empty-box">
          Nenhum exercício ainda. Clique em "+ Adicionar exercício".
        </div>
      )}

      {exercises.map((ex, i) => (
        <div
          key={i}
          className="item-card"
          draggable
          onDragStart={(e) => {
            setDragIndex(i);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(i));
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropAt(i);
          }}
          onDragEnd={() => setDragIndex(null)}
          style={{
            opacity: dragIndex === i ? 0.4 : 1,
            cursor: dragIndex === i ? "grabbing" : "grab",
          }}
        >
          <div className="item-card-head">
            <b>Exercício {i + 1}</b>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn-sm"
                disabled={i === 0}
                onClick={() => moveExercise(i, -1)}
                style={{ padding: "4px 10px" }}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-sm"
                disabled={i === exercises.length - 1}
                onClick={() => moveExercise(i, 1)}
                style={{ padding: "4px 10px" }}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-sm danger"
                onClick={() => removeExercise(i)}
                style={{ padding: "4px 10px" }}
              >
                Excluir
              </button>
            </div>
          </div>

          <div className="frm-row">
            <label>Nome</label>
            <input
              value={ex.name}
              placeholder="Ex.: Supino reto"
              onChange={(e) => setEx(i, { name: e.target.value })}
            />
          </div>
          <div className="frm-row-inline-3">
            <div className="frm-row">
              <label>Séries</label>
              <input
                type="number"
                min={1}
                value={ex.sets}
                onChange={(e) => setEx(i, { sets: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="frm-row">
              <label>Repetições</label>
              <input
                value={ex.repetitions}
                placeholder="Ex.: 10"
                onChange={(e) => setEx(i, { repetitions: e.target.value })}
              />
            </div>
            <div className="frm-row">
              <label>Carga</label>
              <input
                value={ex.weight}
                placeholder="Ex.: 60 kg"
                onChange={(e) => setEx(i, { weight: e.target.value })}
              />
            </div>
          </div>
          <div className="frm-row-inline">
            <div className="frm-row">
              <label>Descanso (segundos)</label>
              <input
                type="number"
                min={0}
                value={ex.restSeconds ?? 60}
                onChange={(e) => setEx(i, { restSeconds: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="frm-row">
              <label>Descrição (opcional)</label>
              <input
                value={ex.description ?? ""}
                placeholder="Descrição breve…"
                onChange={(e) => setEx(i, { description: e.target.value })}
              />
            </div>
          </div>
          <div className="frm-row">
            <label>Observação</label>
            <textarea
              value={ex.notes ?? ""}
              placeholder='Ex.: "Controlar a descida."'
              onChange={(e) => setEx(i, { notes: e.target.value })}
            />
          </div>
        </div>
      ))}

      <button type="button" className="btn-sm full" onClick={addExercise}>
        + Adicionar exercício
      </button>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
        Dica: arraste os exercícios para reordenar, ou use ↑ / ↓.
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn-p"
          disabled={!canSave || busy}
          onClick={() => void save()}
        >
          {busy ? "Salvando…" : "Salvar treino"}
        </button>
      </div>
    </div>
  );
}