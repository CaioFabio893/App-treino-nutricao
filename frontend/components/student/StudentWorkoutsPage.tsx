"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { WorkoutDefine } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";
import LoadError from "@/components/LoadError";
import { APP_TIME_ZONE, WEEK_DAY_KEY, WEEK_DAY_LABEL, todayDateLabel } from "@/lib/days";

/** Consulta dos treinos atribuídos: seleção local, sem registrar execução. */
export default function StudentWorkoutsPage() {
  const { getToken, profile } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await api.listWorkouts(await getToken());
      setWorkouts(result.filter((w) => w.studentId === profile?.id));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, [getToken, profile?.id]);
  useEffect(() => { void load(); }, [load]);
  if (!ready) return <LoadingScreen />;
  const dayIndex = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, weekday: "short" }).format(new Date());
  const today = WEEK_DAY_KEY[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayIndex)];
  const selected = workouts.find((w) => w.id === selectedId) ?? workouts.find((w) => w.dayOfWeek === today) ?? workouts[0];
  return (
    <div>
      <div className="page-head"><div><h1>Seus treinos</h1><div className="page-sub">{todayDateLabel()}</div></div></div>
      {loadError ? <LoadError message="Não foi possível carregar seus treinos." onRetry={() => void load()} /> : workouts.length === 0 ? (
        <div className="empty-box">Nenhum treino atribuído a você ainda.</div>
      ) : (
        <>
          <div className="section-label">Escolha um treino</div>
          <div className="wod-picker">
            {workouts.map((w) => <button key={w.id} type="button" aria-pressed={w.id === selected?.id} className={`wod-chip${w.id === selected?.id ? " active" : ""}`} onClick={() => setSelectedId(w.id ?? "")}>
              <b>{w.name}</b><span>{WEEK_DAY_LABEL[w.dayOfWeek ?? ""] ?? "Livre"}{w.dayOfWeek === today ? " · hoje" : ""}</span>
            </button>)}
          </div>
          {selected && <section className="stu-card" aria-label="Detalhes do treino">
            <h2 className="stu-card-title">{selected.name}</h2>
            {selected.description && <p>{selected.description}</p>}
            {selected.objective && <p>Objetivo: {selected.objective}</p>}
            <div className="section-label">Exercícios</div>
            {selected.exercises?.length ? selected.exercises.map((ex, i) => (
              <article className="ex-card" key={ex.id ?? `${ex.order}-${i}`}>
                <div className="ex-hd"><div><h3 className="ex-name">{ex.name}</h3>
                  <div className="ex-meta">{ex.sets} séries · {ex.repetitions}{ex.weight ? ` · ${ex.weight}` : ""}{ex.restSeconds ? ` · descanso ${ex.restSeconds}s` : ""}</div>
                </div></div>
                {ex.description && <p>{ex.description}</p>}
                {ex.notes && <p>Observações: {ex.notes}</p>}
                <ExerciseVideo url={ex.videoUrl} name={ex.name} />
              </article>
            )) : <div className="empty-box">Nenhum exercício neste treino ainda.</div>}
          </section>}
          <div className="section-label">Sua semana</div>
          <div className="stu-week">{Object.entries(WEEK_DAY_LABEL).map(([key,label]) => <div className="stu-week-day" key={key}><label>{label}</label><span>{workouts.filter((w) => w.dayOfWeek === key).map((w) => w.name).join(", ") || "—"}</span></div>)}</div>
        </>
      )}
    </div>
  );
}

function ExerciseVideo({ url, name }: { url?: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  let embed: string | null = null;
  let safeLink: string | null = null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      safeLink = parsed.href;
      const host = parsed.hostname;
      const id = host === "youtu.be" ? parsed.pathname.slice(1) : ["youtube.com", "www.youtube.com", "www.youtube-nocookie.com"].includes(host) ? parsed.searchParams.get("v") ?? parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1] : null;
      if (id && /^[\w-]{11}$/.test(id)) embed = `https://www.youtube.com/embed/${id}`;
    }
  } catch { /* URL inválida no dado legado. */ }
  if (!safeLink) return null;
  if (!embed) return <a className="btn-sm" href={safeLink} target="_blank" rel="noopener noreferrer">Ver vídeo de {name}</a>;
  return <div className="video-link"><button type="button" className="btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Ocultar vídeo" : "Ver vídeo"} de {name}</button>{open && <div className="video-frame"><iframe src={embed} title={`Vídeo: ${name}`} allowFullScreen /></div>}</div>;
}