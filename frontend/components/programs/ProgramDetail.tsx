"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { ProgramWorkout, TrainingProgram, WorkoutDefine } from "@/lib/types";
import { dayLabel, PROGRAM_DAY_FULL, programExerciseCount } from "@/lib/programDays";
import LoadError from "@/components/LoadError";
import ExerciseVideo from "@/components/ExerciseVideo";
import WorkoutPlayer from "./WorkoutPlayer";

interface Props {
  programId: string;
  /** Aluno: sem ações de escrita, links apontam para o layout do aluno. */
  readOnly?: boolean;
  backHref: string;
  backLabel: string;
}

type Status = "loading" | "ready" | "error";

/**
 * Detalhe de um programa: cabeçalho + lista ORDENADA dos treinos.
 *
 * O programa guarda apenas referências (`workoutId`); os exercícios vêm do
 * treino (`workouts/{id}`) — por isso carregamos os treinos em paralelo e
 * contamos quantos resolveram, sinalizando os que sumiram.
 */
export default function ProgramDetail({ programId, readOnly, backHref, backLabel }: Props) {
  const { getToken, user, profile } = useAuth();
  const [modality, setModality] = useState<"gym" | "home" | null>(null);
  const [preview, setPreview] = useState(false);
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [workouts, setWorkouts] = useState<Record<string, WorkoutDefine>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const token = await getToken();
      const p = await api.getProgram(programId, token);
      setProgram(p);

      const refs = p.workouts ?? [];
      const found = await Promise.all(
        refs.map(async (ref) => {
          try {
            return [ref.workoutId, await api.getWorkout(ref.workoutId, token)] as const;
          } catch {
            return [ref.workoutId, null] as const;
          }
        })
      );

      const map: Record<string, WorkoutDefine> = {};
      const lost: string[] = [];
      for (const [id, w] of found) {
        if (w) map[id] = w;
        else lost.push(id);
      }
      setWorkouts(map);
      setMissing(lost);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar programa");
      setStatus("error");
    }
  }, [getToken, programId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Referências ordenadas: o `order` do vínculo é a fonte da verdade; o índice
  // do array é só fallback para programas gravados sem order.
  const ordered = useMemo<ProgramWorkout[]>(() => {
    const refs = [...(program?.workouts ?? [])];
    return refs
      .map((ref, i) => ({ ref, i }))
      .sort((a, b) => (a.ref.order || a.i + 1) - (b.ref.order || b.i + 1))
      .map((x) => x.ref);
  }, [program]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const [id, w] of Object.entries(workouts)) acc[id] = w.exercises?.length ?? 0;
    return acc;
  }, [workouts]);

  const hasModalities = Object.values(workouts).some(w => w.modality === "gym" || w.modality === "home");
  const visible = hasModalities ? ordered.filter(ref => workouts[ref.workoutId]?.modality === modality) : ordered;
  const totalExercises = programExerciseCount(ordered, counts);
  const totalSets = useMemo(
    () =>
      Object.values(workouts).reduce(
        (acc, w) => acc + (w.exercises ?? []).reduce((a, e) => a + (e.sets || 0), 0),
        0
      ),
    [workouts]
  );

  if (status === "error") {
    return (
      <div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <Link href={backHref} className="btn-sm">
            ‹ {backLabel}
          </Link>
        </div>
        <div className="page-head">
          <div>
            <h1>Programa</h1>
          </div>
        </div>
        <LoadError message={error || "Não foi possível carregar o programa."} onRetry={() => void load()} />
      </div>
    );
  }

  if (status === "loading" || !program) {
    return (
      <div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <Link href={backHref} className="btn-sm">
            ‹ {backLabel}
          </Link>
        </div>
        <div className="page-head">
          <div>
            <h1>Carregando…</h1>
          </div>
        </div>
        <div className="empty-box">Buscando o programa e os treinos.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <Link href={backHref} className="btn-sm">
          ‹ {backLabel}
        </Link>
      </div>

      <div className="page-head">
        <div>
          <h1>{program.name}</h1>
          <div className="page-sub">
            {ordered.length} treino(s) · {totalExercises} exercícios · {totalSets} séries
          </div>
        </div>
        {!readOnly && (
          <div className="btn-row">
            <Link href={`/admin/programs?edit=${program.id}`} className="btn-sm acc">
              Editar
            </Link>
            <Link href={`/admin/print?program=${program.id}`} className="btn-sm">
              Imprimir
            </Link>
          </div>
        )}
      </div>

      {program.objective && (
        <div className="frm-card">
          <h3>Objetivo</h3>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{program.objective}</p>
        </div>
      )}

      {missing.length > 0 && (
        <div className="err-text">
          {missing.length} treino(s) deste programa não foram encontrados e foram ignorados na lista.
        </div>
      )}

      {hasModalities && <div className="frm-card">
        <h3>Onde você vai treinar?</h3>
        <div className="btn-row">
          <button type="button" className={modality === "gym" ? "btn-p" : "btn-sm"} aria-pressed={modality === "gym"} onClick={() => setModality("gym")}>Academia</button>
          <button type="button" className={modality === "home" ? "btn-p" : "btn-sm"} aria-pressed={modality === "home"} onClick={() => setModality("home")}>Em casa</button>
        </div>
        <p className="page-sub">As duas opções estão incluídas. Você pode trocar quando quiser.</p>
      </div>}
      {(!hasModalities || modality) && <>
      {!readOnly && <button type="button" className="btn-sm acc" onClick={() => setPreview(!preview)}>{preview ? "Fechar execução" : "Abrir app de treino / testar execução"}</button>}
      {(readOnly || preview) && (user?.uid || profile?.id) && <WorkoutPlayer userId={user?.uid ?? profile!.id} programId={hasModalities ? `${programId}:${modality}` : programId} workouts={visible.flatMap(ref => workouts[ref.workoutId] ? [workouts[ref.workoutId]] : [])} labels={visible.filter(ref => workouts[ref.workoutId]).map((ref, i) => ref.label ?? String.fromCharCode(65 + i))} periodized={Boolean(program.notes?.includes("82,5%"))} />}
      <details open={!readOnly}>
      <summary className="section-label">Consultar prescrição completa</summary>
      <div className="section-label">Treinos do programa</div>

      {ordered.length === 0 ? (
        <div className="empty-box">
          Este programa ainda não tem treinos. {readOnly ? "" : "Edite o programa para incluir treinos."}
        </div>
      ) : (
        visible.map((ref, i) => {
          const w = workouts[ref.workoutId];
          const titulo = w?.name || ref.name || `Treino ${ref.label || i + 1}`;
          const dia = w?.dayOfWeek || ref.dayOfWeek;
          return (
            <div key={ref.workoutId || `ref-${i}`} className="item-card">
              <div className="item-card-head">
                <b>
                  {ref.label ? `${ref.label} · ` : ""}
                  {titulo}
                </b>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="badge">{dia ? PROGRAM_DAY_FULL[dia] ?? dia : "Sem dia fixo"}</span>
                  {!readOnly && w?.id && (
                    <Link href={`/admin/print?workout=${w.id}`} className="btn-sm">
                      Imprimir
                    </Link>
                  )}
                </div>
              </div>

              {w?.description && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, whiteSpace: "pre-wrap" }}>
                  {w.description}
                </div>
              )}

              {!w ? (
                <div className="empty-box" style={{ margin: 0 }}>
                  Treino indisponível.
                </div>
              ) : (w.exercises?.length ?? 0) === 0 ? (
                <div className="empty-box" style={{ margin: 0 }}>
                  Este treino não tem exercícios.
                </div>
              ) : (
                <div className="workout-prescription-table"><table className="dash-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Exercício</th>
                      <th className="num">Séries</th>
                      <th>Reps</th>
                      <th>Carga</th>
                      <th>Descanso</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(w.exercises ?? []).map((e, j) => (
                      <tr key={`${e.id ?? e.name}-${j}`}>
                        <td className="num">{e.order || j + 1}</td>
                        <td>
                          <span className="dash-cell-title">{e.name}</span>
                          {[...new Set([e.videoUrl, ...(e.videoUrls ?? [])].filter((url): url is string => Boolean(url)))].map(url => <ExerciseVideo key={url} url={url} title={`Ver execução · ${e.name}`} />)}
                        </td>
                        <td className="num">{e.sets || "—"}</td>
                        <td>{e.repetitions || "—"}</td>
                        <td>{e.weight || "—"}</td>
                        <td>{e.restSeconds ? `${e.restSeconds}s` : "—"}</td>
                        <td>{e.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          );
        })
      )}

      {program.notes && (
        <>
          <div className="section-label">Observações da fonte</div>
          <div className="frm-card">
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {program.notes}
            </pre>
          </div>
        </>
      )}

      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 14 }}>
        Dias:{" "}
        {ordered.length > 0
          ? ordered.map((r) => dayLabel(workouts[r.workoutId]?.dayOfWeek || r.dayOfWeek)).join(" · ")
          : "—"}
      </div>
      </details>
      </>}
    </div>
  );
}
