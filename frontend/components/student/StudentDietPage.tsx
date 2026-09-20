"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { Diet } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";
import DietCheck from "@/components/DietCheck";
import LoadError from "@/components/LoadError";
import { todayDateLabel } from "@/lib/days";

/** Página "Dietas" do aluno: dieta ativa (texto ou refeições legadas) + acompanhamento de hoje. */
export default function StudentDietPage() {
  const { getToken, profile } = useAuth();
  const [diets, setDiets] = useState<Diet[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const d = await api.listDiets(token);
      setDiets(d.filter((x) => x.studentId === (profile?.id ?? "")));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, [getToken, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <LoadingScreen />;

  if (loadError) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Sua dieta</h1>
            <div className="page-sub">{todayDateLabel()}</div>
          </div>
        </div>
        <LoadError
          message="Não foi possível carregar sua dieta."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayDiet = diets.find(
    (d) =>
      (!d.startDate || d.startDate <= today) &&
      (!d.endDate || d.endDate >= today)
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sua dieta</h1>
          <div className="page-sub">{todayDateLabel()}</div>
        </div>
      </div>

      {todayDiet ? (
        <>
          <div className="stu-card">
            <div className="stu-card-title">{todayDiet.name}</div>
            <div className="stu-card-sub">
              {todayDiet.description || ""}
              {todayDiet.startDate
                ? ` · ${todayDiet.startDate} → ${todayDiet.endDate || "..."}`
                : ""}
            </div>
            {todayDiet.content ? (
              <>
                <div className="stu-diet-content">{todayDiet.content}</div>
                <CopyDietButton content={todayDiet.content} />
              </>
            ) : (
              todayDiet.meals?.map((meal, mi) => (
                <div key={mi} className="stu-meal">
                  <div className="stu-meal-head">
                    <b>{meal.name}</b>
                    <span>{meal.time || "—"}</span>
                  </div>
                  {meal.foods?.map((f, fi) => (
                    <div key={fi} className="stu-food">
                      • {f.name} — {f.quantity || ""} {f.unit}
                      {f.notes ? ` (${f.notes})` : ""}
                    </div>
                  ))}
                  {meal.notes && <div className="stu-food-note">{meal.notes}</div>}
                </div>
              ))
            )}
          </div>
          {(todayDiet.meals?.length ?? 0) > 0 && (
            <>
              <div className="section-label">Acompanhamento de hoje</div>
              <DietCheck diet={todayDiet} />
            </>
          )}
        </>
      ) : (
        <div className="empty-box">
          Nenhuma dieta foi atribuída ainda. Quando seu nutricionista cadastrar,
          aparece aqui.
        </div>
      )}
    </div>
  );
}

/** Botão de copiar a dieta em texto (mesmo padrão do botão de copiar treino). */
function CopyDietButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard indisponível */
    }
  };
  return (
    <button type="button" className="btn-sm stu-copy-btn" onClick={() => void copy()}>
      {copied ? "✓ Copiado!" : "Copiar dieta"}
    </button>
  );
}