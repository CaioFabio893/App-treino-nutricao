"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import FormattedText from "@/components/FormattedText";
import ProtectedDietViewer from "@/components/ProtectedDietViewer";
import * as api from "@/lib/api";
import type { Diet } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";
import LoadError from "@/components/LoadError";
import { todayDateLabel, todayDateKey } from "@/lib/days";

/** Página "Dietas" do aluno: dieta ativa (texto ou refeições legadas). */
export default function StudentDietPage({ recipe = false }: { recipe?: boolean }) {
  const { getToken, profile } = useAuth();
  const [diets, setDiets] = useState<Diet[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const d = await api.listDiets(token);
      setDiets(d.filter((x) => x.studentId === (profile?.id ?? "") && (recipe ? x.kind === "recipe" : x.kind !== "recipe")));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, [getToken, profile, recipe]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <LoadingScreen />;

  if (loadError) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>{recipe ? "Suas receitas" : "Sua dieta"}</h1>
            <div className="page-sub">{todayDateLabel()}</div>
          </div>
        </div>
        <LoadError
          message={recipe ? "Não foi possível carregar suas receitas." : "Não foi possível carregar sua dieta."}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const today = todayDateKey();
  const available = diets.filter(
    (d) =>
      (!d.startDate || d.startDate <= today) &&
      (!d.endDate || d.endDate >= today)
  );

  const todayDiet = available[0];
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{recipe ? "Suas receitas" : "Sua dieta"}</h1>
          <div className="page-sub">{todayDateLabel()}</div>
        </div>
      </div>

      {(recipe ? available : todayDiet ? [todayDiet] : []).map(todayDiet => (
          <div className="stu-card" key={todayDiet.id}>
            <div className="stu-card-title">{todayDiet.name}</div>
            <div className="stu-card-sub">
              {todayDiet.description || ""}
              {todayDiet.startDate
                ? ` · ${todayDiet.startDate} → ${todayDiet.endDate || "..."}`
                : ""}
            </div>
            {todayDiet.document && todayDiet.id ? (
              <ProtectedDietViewer key={todayDiet.id} dietId={todayDiet.id} pageCount={todayDiet.document.pageCount} />
            ) : todayDiet.content ? (
              <>
                <FormattedText text={todayDiet.content} />
                <CopyDietButton content={todayDiet.content} recipe={recipe} />
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
      ))}
      {!todayDiet && (
        <div className="empty-box">
          {recipe ? "Nenhuma receita foi atribuída ainda. Quando seu responsável cadastrar, aparece aqui." : "Nenhuma dieta foi atribuída ainda. Quando seu nutricionista cadastrar, aparece aqui."}
        </div>
      )}
    </div>
  );
}

/** Botão de copiar a dieta em texto (mesmo padrão do botão de copiar treino). */
function CopyDietButton({ content, recipe }: { content: string; recipe?: boolean }) {
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
      {copied ? "✓ Copiado!" : recipe ? "Copiar receita" : "Copiar dieta"}
    </button>
  );
}
