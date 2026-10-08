"use client";

import { useEffect, useState } from "react";
import type { WorkoutDefine } from "@/lib/types";
import ExerciseVideo from "@/components/ExerciseVideo";
import styles from "./WorkoutPlayer.module.css";

type SetEntry = { weight: string; reps: string; status: "" | "ok" | "fail" };
type Session = { sets: SetEntry[]; note: string };
type Progress = { circuits?: Record<string, { rounds: number; notes: string }>; week: number; day: number; prs: Record<string, string>; sessions: Record<string, Session> };
const empty = (): Progress => ({ week: 1, day: 0, prs: {}, sessions: {} });
const percentages = [70, 70, 75, 75, 82.5, 82.5, 90, 70];
const prNames = ["Agachamento Livre com Barra", "Elevação Pélvica", "Leg Press 45°"];
const numeric = (value: unknown) => typeof value === "string" && /^\d{0,5}(?:[.,]\d{0,2})?$/.test(value) ? value : "";
export function readProgress(raw: string | null): Progress {
  if (!raw) return empty();
  const value = JSON.parse(raw);
  const result = empty();
  if (!value || typeof value !== "object") return result;
  if (Number.isInteger(value.week) && value.week >= 1 && value.week <= 8) result.week = value.week;
  if (Number.isInteger(value.day) && value.day >= 0) result.day = value.day;
  for (const name of prNames) result.prs[name] = numeric(value.prs?.[name]);
  for (const [key, session] of Object.entries(value.sessions ?? {}).slice(0, 5000)) {
    if (!session || typeof session !== "object") continue;
    const s = session as Partial<Session>;
    if (!Array.isArray(s.sets)) continue;
    result.sessions[key] = { note: typeof s.note === "string" ? s.note.slice(0, 2000) : "", sets: s.sets.slice(0, 100).map(entry => ({ weight: numeric(entry?.weight), reps: numeric(entry?.reps), status: entry?.status === "ok" || entry?.status === "fail" ? entry.status : "" })) };
  }
  const circuits: NonNullable<Progress["circuits"]> = {};
  for (const [key, entry] of Object.entries(value.circuits ?? {}).slice(0, 1000)) {
    if (!entry || typeof entry !== "object") continue;
    const c = entry as { rounds?: unknown; notes?: unknown };
    if (typeof c.rounds === "number" && Number.isInteger(c.rounds) && c.rounds >= 0 && c.rounds <= 1000) circuits[key] = { rounds: c.rounds, notes: typeof c.notes === "string" ? c.notes.slice(0,2000) : "" };
  }
  result.circuits = circuits;
  return result;
}

function Timer({ seconds = 180, label = "Tempo de descanso", presets = [60, 120, 180] }: { seconds?: number; label?: string; presets?: number[] }) {
  const [duration, setDuration] = useState(seconds);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (started === null) return;
    const tick = () => {
      const now = duration > 0 ? Math.min(duration, Math.floor((Date.now() - started) / 1000)) : Math.floor((Date.now() - started) / 1000);
      setElapsed(now);
      if (duration > 0 && now >= duration) { setStarted(null); setFinished(true); navigator.vibrate?.(400); }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [started, duration]);
  const reset = (value = duration) => { setDuration(value); setStarted(null); setElapsed(0); setFinished(false); };
  return <div className={styles.timer}>
    <strong role="timer" aria-label={label}>{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</strong>
    <span>{duration === 0 ? " · Tempo livre" : " / "}{duration > 0 && <>{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</>}{finished ? (label === "Tempo de descanso" ? " · Descanso concluído" : " · Tempo concluído") : ""}</span>
    <div className={styles.actions}>
      <button type="button" onClick={() => { if (started !== null) { setElapsed(duration > 0 ? Math.min(duration, Math.floor((Date.now() - started) / 1000)) : Math.floor((Date.now() - started) / 1000)); setStarted(null); } else { setFinished(false); const base = duration > 0 && elapsed >= duration ? 0 : elapsed; setElapsed(base); setStarted(Date.now() - base * 1000); } }}>{started !== null ? "Pausar" : "Iniciar"}</button>
      <button type="button" onClick={() => reset()}>Zerar</button>
      {presets.map(n => <button type="button" key={n} aria-pressed={duration === n} onClick={() => reset(n)}>{n / 60} min</button>)}
    </div>
  </div>;
}

/** Execution changes only this user's local progress, never the prescription. */
export default function WorkoutPlayer({ userId, programId, workouts, labels, periodized = false }: { userId: string; programId: string; workouts: WorkoutDefine[]; labels?: string[]; periodized?: boolean }) {
  const key = `treino-execution-v1:${encodeURIComponent(userId)}:${encodeURIComponent(programId)}`;
  return <Player key={key} storageKey={key} workouts={workouts} labels={labels} periodized={periodized} />;
}

function Player({ storageKey, workouts, labels, periodized }: { storageKey: string; workouts: WorkoutDefine[]; labels?: string[]; periodized: boolean }) {
  const [data, setData] = useState<Progress>(empty);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState<"week" | "pr" | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    try { setData(readProgress(localStorage.getItem(storageKey))); }
    catch { setMessage("Não foi possível recuperar o progresso salvo. Os registros existentes não serão sobrescritos automaticamente."); }
    setReady(true);
  }, [storageKey]);
  const save = (next: Progress) => {
    setData(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setMessage("Progresso salvo neste navegador."); }
    catch { setMessage("Falha ao salvar. Mantenha esta página aberta: o armazenamento do navegador está indisponível ou cheio."); }
  };
  const day = Math.min(data.day, Math.max(0, workouts.length - 1));
  const workout = workouts[day];
  if (!ready) return <p>Carregando seu progresso…</p>;
  if (!workout) return null;
  const exercises = [...(workout.exercises ?? [])].sort((a, b) => a.order - b.order);
  const sessionKey = (week: number, index: number) => JSON.stringify([week, workout.id ?? workout.name, exercises[index].id ?? `${index}:${exercises[index].name}`]);
  const session = (index: number): Session => data.sessions[sessionKey(data.week, index)] ?? { sets: [], note: "" };
  const update = (index: number, next: Session) => save({ ...data, sessions: { ...data.sessions, [sessionKey(data.week, index)]: next } });
  const circuitKey = JSON.stringify([data.week, workout.id ?? workout.name]);
  const circuit = data.circuits?.[circuitKey] ?? { rounds: 0, notes: "" };
  const saveCircuit = (patch: Partial<typeof circuit>) => save({ ...data, circuits: { ...data.circuits, [circuitKey]: { ...circuit, ...patch } } });
  const newRound = () => {
    const sessions = { ...data.sessions };
    exercises.forEach((ex, i) => {
      if (ex.phase !== "main") return;
      const old = session(i);
      sessions[sessionKey(data.week, i)] = { ...old, sets: old.sets.map(entry => ({ ...entry, status: "" })) };
    });
    save({ ...data, sessions, circuits: { ...data.circuits, [circuitKey]: { ...circuit, rounds: Math.min(1000, circuit.rounds + 1) } } });
  };
  const total = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const completed = exercises.reduce((sum, ex, i) => sum + Array.from({ length: ex.sets }, (_, s) => session(i).sets[s]?.status === "ok" ? 1 : 0).reduce((a: number, b) => a + b, 0), 0);
  const changeDay = (value: number) => save({ ...data, day: value });
  return <section className={styles.player} aria-label="Execução do programa">
    <header className={styles.header}><div><b>Louise Lima</b><small>Seu programa de treino</small></div><div className={styles.actions}>
      {periodized && <button type="button" onClick={() => { setDraft({ ...data.prs }); setModal("pr"); }}>PRs</button>}
      <button type="button" onClick={() => setModal("week")}>SEM {data.week}</button>
    </div></header>
    <nav className={styles.tabs} aria-label="Treinos do programa">{workouts.map((w, i) => <button type="button" key={w.id ?? i} aria-pressed={day === i} onClick={() => changeDay(i)}><b>{labels?.[i] ?? String.fromCharCode(65 + i)}</b><small>{w.name}</small>{Object.keys(data.sessions).some(k => { try { const parts = JSON.parse(k); return parts[0] === data.week && parts[1] === (w.id ?? w.name); } catch { return false; } }) && <span aria-label="Tem registros">●</span>}</button>)}</nav>
    <div className={styles.phase}>Semana {data.week}{periodized && <> · {data.week === 8 ? "Deload · " : ""}{String(percentages[data.week - 1]).replace(".", ",")}% do PR</>}</div>
    <h2>{workout.name}</h2>
    <div className={styles.progress}><span>{completed} / {total} séries concluídas com sucesso</span><progress value={completed} max={total || 1} /></div>
    {workout.objective && <p>{workout.objective}</p>}
    {workout.description && <aside className={styles.cardio}><h3>Orientações / Cardio final</h3><div>{workout.description.replace(/\*\*/g, "")}</div></aside>}
    {Boolean(workout.circuitSeconds) && <div className={styles.cardio}>
      <h3>Circuito AMRAP · após o aquecimento</h3>
      <p>Repita os exercícios principais durante 15 ou 20 minutos. Descanse conforme necessário. Aquecimento não conta como volta.</p>
      <Timer key={`amrap:${workout.id}`} seconds={workout.circuitSeconds} label="Tempo do circuito AMRAP" presets={[900,1200]} />
      <p aria-live="polite">{circuit.rounds} voltas concluídas nesta semana</p>
      <div className={styles.actions}><button type="button" onClick={newRound}>Concluir volta e iniciar próxima</button><button type="button" disabled={circuit.rounds === 0} onClick={() => saveCircuit({ rounds: Math.max(0,circuit.rounds - 1) })}>Corrigir última volta</button></div>
      <label>Observações do circuito<textarea aria-label="Observações do circuito" value={circuit.notes} onChange={e => saveCircuit({ notes: e.target.value.slice(0,2000) })} /></label>
    </div>}
    {exercises.map((ex, index) => {
      const current = session(index);
      let previous: Session | undefined;
      let previousWeek = 0;
      for (let w = data.week - 1; w >= 1; w--) { const found = data.sessions[sessionKey(w, index)]; if (found?.sets.some(s => s.weight || s.reps)) { previous = found; previousWeek = w; break; } }
      const pr = Number((data.prs[ex.name] ?? "").replace(",", "."));
      const suggested = periodized && pr > 0 ? Math.round(pr * percentages[data.week - 1] / 100 * 2) / 2 : null;
      return <details key={`${data.week}:${workout.id}:${index}`} className={styles.exercise} open={index === 0}>
        <summary><span className={styles.number}>{index + 1}</span><span><b>{ex.name}</b>{ex.phase && <small>{{warmup:"Aquecimento",main:"Principal",cardio:"Cardio",stretching:"Alongamento"}[ex.phase]}</small>}<small>{ex.sets} séries · {ex.repetitions} reps{ex.weight ? ` · ${ex.weight}` : ""}{suggested !== null ? ` · Sugestão: ${suggested} kg` : ""}</small></span><span>⌄</span></summary>
        <div className={styles.body}>
          {ex.description && <p>{ex.description}</p>}{ex.notes && <p className={styles.note}>{ex.notes}</p>}
          {[...new Set([ex.videoUrl, ...(ex.videoUrls ?? [])].filter((url): url is string => Boolean(url)))].map((url, i) => <ExerciseVideo key={url} url={url} title={`${i ? "Vídeo complementar" : "Ver execução"} · ${ex.name}`} />)}
          {previous && <div className={styles.previous}><b>Última sessão · Semana {previousWeek}</b><div>{previous.sets.map((s, i) => <span key={i}>S{i + 1}: {s.weight || "—"} kg × {s.reps || "—"} {s.status === "ok" ? "✓" : s.status === "fail" ? "✗" : ""} </span>)}</div></div>}
          <div className={styles.table}><div className={styles.row}><span>#</span><span>Carga (kg)</span><span>Reps</span><span>Alvo</span><span>Resultado</span></div>
            {Array.from({ length: Math.min(ex.sets, 100) }, (_, s) => { const entry = current.sets[s] ?? { weight: "", reps: "", status: "" }; const edit = (patch: Partial<SetEntry>) => { const sets = Array.from({ length: ex.sets }, (_, n) => current.sets[n] ?? { weight: "", reps: "", status: "" }); sets[s] = { ...entry, ...patch }; update(index, { ...current, sets }); }; return <div className={styles.row} key={s}><span>{s + 1}</span>
              <input aria-label={`${ex.name} série ${s + 1} carga`} type="number" min="0" max="99999" step="0.5" placeholder={suggested !== null ? String(suggested) : "kg"} value={entry.weight} onChange={e => edit({ weight: numeric(e.target.value) })} />
              <input aria-label={`${ex.name} série ${s + 1} repetições`} type="number" min="0" max="99999" step="1" placeholder="reps" value={entry.reps} onChange={e => edit({ reps: numeric(e.target.value) })} />
              <span>{ex.repetitions}</span><button type="button" className={entry.status === "ok" ? styles.ok : entry.status === "fail" ? styles.fail : ""} aria-label={`${ex.name} série ${s + 1}: ${entry.status === "ok" ? "conseguiu" : entry.status === "fail" ? "não conseguiu" : "não marcada"}`} onClick={() => edit({ status: entry.status === "" ? "ok" : entry.status === "ok" ? "fail" : "" })}>{entry.status === "ok" ? "✓" : entry.status === "fail" ? "✗" : "○"}</button>
            </div>; })}</div>
          <p className={styles.hint}>Toque no resultado: não marcada → conseguiu ✓ → não conseguiu ✗.</p>
          <label className={styles.notes}>Observações da sessão<textarea maxLength={2000} value={current.note} placeholder="Como foi o exercício?" onChange={e => update(index, { ...current, note: e.target.value })} /></label>
          {!ex.timerExcluded && (workout.modality || ex.phase || ex.durationSeconds) && <details className={styles.rest}><summary>⏱ Cronômetro do exercício</summary><Timer key={`execution:${data.week}:${workout.id}:${index}`} seconds={ex.durationSeconds ?? 0} label={`Tempo de ${ex.name}`} presets={ex.durationSeconds ? [ex.durationSeconds] : []} /></details>}
          {((ex.restSeconds ?? 0) > 0 || !workout.modality) && <details className={styles.rest}><summary>⏱ Descanso</summary><Timer key={`${data.week}:${workout.id}:${index}`} seconds={ex.restSeconds || 180} /></details>}
        </div>
      </details>;
    })}
    <footer className={styles.actions}><button type="button" disabled={day === 0} onClick={() => changeDay(day - 1)}>← Anterior</button><button type="button" onClick={() => save(data)}>Salvar</button><button type="button" disabled={day >= workouts.length - 1} onClick={() => changeDay(day + 1)}>Próximo →</button></footer>
    <p role="status">{message}</p><p className={styles.hint}>Registros salvos automaticamente por conta neste navegador. Não são sincronizados entre dispositivos.</p>
    {modal && <div className={styles.overlay}><section role="dialog" aria-modal="true" aria-label={modal === "week" ? "Escolher semana" : "Recordes pessoais"} className={styles.modal}>
      <h2>{modal === "week" ? "Escolher semana" : "Recordes pessoais (kg)"}</h2>
      {modal === "week" ? <div className={styles.weeks}>{percentages.map((pct, i) => <button key={i} type="button" aria-pressed={data.week === i + 1} onClick={() => { save({ ...data, week: i + 1 }); setModal(null); }}>Semana {i + 1}{periodized && <small>{i === 7 ? "Deload · " : ""}{String(pct).replace(".", ",")}%</small>}</button>)}</div> : prNames.map(name => <label className={styles.notes} key={name}>{name}<input type="number" min="0" max="99999" step="0.5" value={draft[name] ?? ""} onChange={e => setDraft({ ...draft, [name]: numeric(e.target.value) })} /></label>)}
      <div className={styles.actions}>{modal === "pr" && <button type="button" onClick={() => { save({ ...data, prs: draft }); setModal(null); }}>Salvar PRs</button>}<button type="button" onClick={() => setModal(null)}>{modal === "pr" ? "Cancelar" : "Fechar"}</button></div>
    </section></div>}
  </section>;
}
