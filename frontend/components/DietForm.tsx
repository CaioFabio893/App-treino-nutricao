"use client";

import { useEffect, useState } from "react";
import TextEditor from "./TextEditor";
import ProtectedDietViewer from "./ProtectedDietViewer";
import * as api from "@/lib/api";
import type { Diet, Meal, UserProfile } from "@/lib/types";

// Converte uma dieta legada (refeições estruturadas) em texto livre, para que
// dietas antigas continuem visíveis/editáveis no novo formato simplificado.
export function mealsToText(meals: Meal[] | undefined): string {
  return (meals ?? [])
    .filter((m) => m?.name)
    .map((m) => {
      const head = m.time ? `${m.name} (${m.time})` : m.name;
      const foods = (m.foods ?? [])
        .filter((f) => f?.name)
        .map((f) => {
          const qty = f.quantity ? ` — ${f.quantity} ${f.unit}` : f.unit ? ` — ${f.unit}` : "";
          return `• ${f.name}${qty}${f.notes ? ` (${f.notes})` : ""}`;
        })
        .join("\n");
      const notes = m.notes ? `Obs: ${m.notes}` : "";
      return [head, foods, notes].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

interface Props {
  initial?: Diet;
  recipe?: boolean;
  presetStudent?: string;
  copyId?: string;
  students: UserProfile[];
  getToken: () => Promise<string>;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Formulário de dieta simplificado: nome + texto livre (copiar/colar) +
 * aluno opcional (biblioteca). Dietas legadas com refeições são convertidas
 * para texto automaticamente ao abrir/duplicar — nada se perde na edição.
 */
export default function DietForm({
  initial,
  recipe = false,
  presetStudent,
  copyId,
  students,
  getToken,
  onDone,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(() => {
    if (initial?.content) return initial.content;
    if (initial?.meals?.length) return mealsToText(initial.meals);
    return "";
  });
  const [studentId, setStudentId] = useState(initial?.studentId ?? presetStudent ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [busy, setBusy] = useState(false);
  const [document, setDocument] = useState(initial?.document);
  const [copyLoading, setCopyLoading] = useState(Boolean(copyId));
  const [error, setError] = useState<string | null>(null);

  // Se veio com "copyId", carrega a dieta de origem (copiando o texto).
  useEffect(() => {
    if (!copyId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const src = await api.getDiet(copyId, token);
        if (!cancelled && src) {
          setContent(src.content ?? mealsToText(src.meals));
          setDocument(src.document);
          if (!name) setName(`${src.name} (copia)`);
          if (!description) setDescription(src.description ?? "");
          if (!startDate) setStartDate(src.startDate ?? "");
          if (!endDate) setEndDate(src.endDate ?? "");
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar a dieta de origem. Volte e tente novamente.");
      } finally {
        if (!cancelled) setCopyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyId]);

  const dateRangeInvalid = Boolean(startDate && endDate) && startDate > endDate;
  // Aluno é opcional: sem aluno a dieta fica na biblioteca e pode ser
  // atribuída depois (mecanismo existente: diets.studentId).
  const canSave = Boolean(name.trim()) && Boolean(document || content.trim()) && !dateRangeInvalid && !copyLoading;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const payload: Diet = {
        studentId,
        kind: recipe ? "recipe" : (initial?.kind ?? "diet"),
        name: name.trim(),
        description: description.trim(),
        startDate,
        endDate,
        content: content.trim(),
        document,
        // Novo formato é texto: refeições estruturadas caem (legado vira texto).
        meals: [],
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
          <h1>{initial?.id ? (recipe ? "Editar receita" : "Editar dieta") : (recipe ? "Nova receita" : "Nova dieta")}</h1>
          <div className="page-sub">
            {initial?.id
              ? "Altere os campos e salve."
              : "Cole o plano alimentar como texto. O aluno é opcional e pode ser atribuído depois."}
          </div>
        </div>
      </div>

      {error && (
        <div className="err-text" id="diet-error" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      <div className="frm-card">
        <h3>{recipe ? "Dados da receita" : "Dados da dieta"}</h3>
        <div className="frm-row">
          <label htmlFor="diet-name">{recipe ? "Nome da receita" : "Nome da dieta"}</label>
          <input
            id="diet-name"
            value={name}
            placeholder='Ex.: "Plano alimentar - Outubro"'
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="frm-row">
          <label htmlFor="diet-student">Aluno</label>
          <select
            id="diet-student"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Sem aluno (biblioteca)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.id}
              </option>
            ))}
          </select>
        </div>
        <div className="frm-row-inline">
          <div className="frm-row">
            <label htmlFor="diet-start">Data de início</label>
            <input
              id="diet-start"
              type="date"
              value={startDate}
              aria-invalid={dateRangeInvalid}
              aria-describedby={dateRangeInvalid ? "diet-range-error" : undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="frm-row">
            <label htmlFor="diet-end">Data de término</label>
            <input
              id="diet-end"
              type="date"
              value={endDate}
              aria-invalid={dateRangeInvalid}
              aria-describedby={dateRangeInvalid ? "diet-range-error" : undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        {dateRangeInvalid && (
          <div
            className="err-text"
            id="diet-range-error"
            role="alert"
            aria-live="polite"
            style={{ marginTop: -4 }}
          >
            A data de início não pode ser posterior à data de término.
          </div>
        )}
      </div>

      <div className="frm-card" style={{ marginTop: 12 }}>
        <h3>{recipe ? "Conteúdo da receita" : "Conteúdo da dieta"}</h3>
        <div className="frm-row">
          {document ? (
            <>
              <p>Documento protegido · {document.pageCount} páginas. Ao salvar ou associar ao aluno, o documento é mantido.</p>
              {(initial?.id || copyId) && <ProtectedDietViewer key={initial?.id || copyId} dietId={initial?.id || copyId!} pageCount={document.pageCount} />}
            </>
          ) : <><label htmlFor="diet-content">
            {recipe ? "Receita (texto livre)" : "Plano alimentar (texto livre)"} <span style={{ color: "var(--muted)" }}>· copiar e colar</span>
          </label>
          <TextEditor value={content} onChange={setContent} />
          </>}
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn-p"
          disabled={!canSave || busy}
          onClick={() => void save()}
        >
          {busy ? "Salvando…" : (recipe ? "Salvar receita" : "Salvar dieta")}
        </button>
      </div>
    </div>
  );
}
