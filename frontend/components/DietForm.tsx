"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { Diet, Food, Meal, UserProfile } from "@/lib/types";
import ConfirmModal from "./ConfirmModal";

const newFood = (): Food => ({ name: "", quantity: 0, unit: "" });
const newMeal = (order: number): Meal => ({ name: "", time: "", order, foods: [] });

interface Props {
  initial?: Diet;
  presetStudent?: string;
  copyId?: string;
  students: UserProfile[];
  getToken: () => Promise<string>;
  onDone: () => void;
  onCancel: () => void;
}

export default function DietForm({
  initial,
  presetStudent,
  copyId,
  students,
  getToken,
  onDone,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [studentId, setStudentId] = useState(initial?.studentId ?? presetStudent ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [meals, setMeals] = useState<Meal[]>(initial?.meals?.length ? initial.meals : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se veio com "copyId", carrega a dieta de origem.
  useEffect(() => {
    if (!copyId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const src = await api.getDiet(copyId, token);
        if (!cancelled && src?.meals) {
          const copied = src.meals.map((m) => ({
            ...m,
            id: undefined,
            foods: m.foods?.map((f) => ({ ...f, id: undefined })),
          }));
          setMeals(copied);
          if (!name) setName(`${src.name} (copia)`);
          if (!description) setDescription(src.description ?? "");
          if (!startDate) setStartDate(src.startDate ?? "");
          if (!endDate) setEndDate(src.endDate ?? "");
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

  const setMeal = (mi: number, patch: Partial<Meal>) => {
    setMeals((prev) => prev.map((m, j) => (j === mi ? { ...m, ...patch } : m)));
  };

  const setFood = (mi: number, fi: number, patch: Partial<Food>) => {
    setMeals((prev) =>
      prev.map((m, j) =>
        j === mi
          ? {
              ...m,
              foods: (m.foods ?? []).map((f, k) => (k === fi ? { ...f, ...patch } : f)),
            }
          : m
      )
    );
  };

  const addMeal = () => setMeals((prev) => [...prev, newMeal(prev.length + 1)]);
  const [confirmMeal, setConfirmMeal] = useState<number | null>(null);
  const removeMeal = (mi: number) => {
    const m = meals[mi];
    if (!m?.name) {
      setMeals((prev) => prev.filter((_, j) => j !== mi));
    } else {
      setConfirmMeal(mi);
    }
  };
  const confirmRemoveMeal = () => {
    if (confirmMeal !== null) {
      setMeals((prev) => prev.filter((_, j) => j !== confirmMeal));
    }
    setConfirmMeal(null);
  };

  const moveMeal = (mi: number, delta: number) => {
    const j = mi + delta;
    if (j < 0 || j >= meals.length) return;
    setMeals((prev) => {
      const next = [...prev];
      const tmp = next[mi];
      next[mi] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const addFood = (mi: number) => {
    setMeals((prev) =>
      prev.map((m, j) => (j === mi ? { ...m, foods: [...(m.foods ?? []), newFood()] } : m))
    );
  };

  const removeFood = (mi: number, fi: number) => {
    setMeals((prev) =>
      prev.map((m, j) =>
        j === mi ? { ...m, foods: (m.foods ?? []).filter((_, k) => k !== fi) } : m
      )
    );
  };

  const canSave = Boolean(name.trim()) && Boolean(studentId);

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const payload: Diet = {
        studentId,
        nutritionistId: initial?.nutritionistId ?? "",
        name: name.trim(),
        description: description.trim(),
        startDate,
        endDate,
        meals: meals.map((m, i) => ({
          ...m,
          order: i + 1,
          foods: (m.foods ?? []).filter((f) => f.name.trim() !== ""),
        })),
      };
      if (initial?.id) {
        await api.updateDiet(initial.id, payload, token);
      } else {
        await api.createDiet(payload, token);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar dieta");
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
          <h1>{initial?.id ? "Editar dieta" : "Nova dieta"}</h1>
          <div className="page-sub">
            {initial?.id
              ? "Altere os campos e salve."
              : "Monte o plano alimentar do aluno."}
          </div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      <div className="frm-card">
        <h3>Dados da dieta</h3>
        <div className="frm-row">
          <label>Nome da dieta</label>
          <input
            value={name}
            placeholder='Ex.: "Plano alimentar - Outubro"'
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="frm-row">
          <label>Descrição</label>
          <textarea
            value={description}
            placeholder='Ex.: "Plano para ganho de massa muscular"'
            onChange={(e) => setDescription(e.target.value)}
          />
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
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>Data de início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="frm-row">
            <label>Data de término</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="section-label">Refeições ({meals.length})</div>

      {meals.length === 0 && (
        <div className="empty-box">
          Nenhuma refeição ainda. Clique em "+ Adicionar refeição".
        </div>
      )}

      {meals.map((meal, mi) => (
        <div key={mi} className="item-card">
          <div className="item-card-head">
            <b>Refeição {mi + 1}</b>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn-sm"
                disabled={mi === 0}
                onClick={() => moveMeal(mi, -1)}
                style={{ padding: "4px 10px" }}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-sm"
                disabled={mi === meals.length - 1}
                onClick={() => moveMeal(mi, 1)}
                style={{ padding: "4px 10px" }}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-sm danger"
                onClick={() => removeMeal(mi)}
                style={{ padding: "4px 10px" }}
              >
                Excluir
              </button>
            </div>
          </div>

          <div className="frm-row-inline">
            <div className="frm-row">
              <label>Nome</label>
              <input
                value={meal.name}
                placeholder="Ex.: Café da manhã"
                onChange={(e) => setMeal(mi, { name: e.target.value })}
              />
            </div>
            <div className="frm-row">
              <label>Horário</label>
              <input
                type="time"
                value={meal.time}
                onChange={(e) => setMeal(mi, { time: e.target.value })}
              />
            </div>
          </div>
          <div className="frm-row">
            <label>Descrição/observação (opcional)</label>
            <input
              value={meal.notes ?? ""}
              placeholder="Observações da refeição…"
              onChange={(e) => setMeal(mi, { notes: e.target.value })}
            />
          </div>

          <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--muted)", textTransform: "uppercase", margin: "8px 0 6px", fontWeight: 500 }}>
            Alimentos
          </div>

          {(meal.foods ?? []).map((food, fi) => (
            <div key={fi} className="food-line">
              <input
                className="food-name"
                value={food.name}
                placeholder="Ex.: Ovo"
                onChange={(e) => setFood(mi, fi, { name: e.target.value })}
              />
              <input
                className="food-qty"
                type="number"
                min={0}
                step="any"
                value={food.quantity}
                placeholder="Qtd."
                onChange={(e) => setFood(mi, fi, { quantity: Number(e.target.value) || 0 })}
              />
              <input
                className="food-unit"
                value={food.unit}
                placeholder="unid./g"
                onChange={(e) => setFood(mi, fi, { unit: e.target.value })}
              />
              <button
                type="button"
                className="btn-sm danger food-del"
                onClick={() => removeFood(mi, fi)}
                style={{ padding: "4px 10px" }}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn-sm" onClick={() => addFood(mi)}>
            + Adicionar alimento
          </button>
        </div>
      ))}

      <button type="button" className="btn-sm full" onClick={addMeal}>
        + Adicionar refeição
      </button>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn-p"
          disabled={!canSave || busy}
          onClick={() => void save()}
        >
          {busy ? "Salvando…" : "Salvar dieta"}
        </button>
      </div>

      <ConfirmModal
        open={confirmMeal !== null}
        title="Excluir refeição"
        message={
          <>
            Remover a refeição{" "}
            <strong>{confirmMeal !== null ? meals[confirmMeal]?.name || "" : ""}</strong>?
            Essa alteração vale até salvar a dieta.
          </>
        }
        confirmLabel="Excluir"
        onConfirm={confirmRemoveMeal}
        onCancel={() => setConfirmMeal(null)}
      />
    </div>
  );
}