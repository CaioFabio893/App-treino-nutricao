"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile, WorkoutDefine, Diet, WorkoutHistoryEntry, HistoryExercise } from "@/lib/types";
import { LoadingScreen } from "@/components/SetupNeeded";

const WEEK_DAY_LABEL: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

interface Props {
  student: UserProfile;
  onStudentChange?: (s: UserProfile) => void;
}

export default function StudentDetail({ student, onStudentChange }: Props) {
  const { getToken } = useAuth();
  const router = useRouter();

  const [workouts, setWorkouts] = useState<WorkoutDefine[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edição dos dados do aluno (foto, nome, status, datas).
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: student.name || "",
    photoURL: student.photoURL || "",
    status: student.status || "active",
    startDate: student.startDate || "",
    endDate: student.endDate || "",
  });
  const [editMsg, setEditMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [w, d, h] = await Promise.all([
        api.listWorkouts(token),
        api.listDiets(token),
        api.listHistory(token),
      ]);
      setWorkouts(w.filter((x) => x.studentId === student.id));
      setDiets(d.filter((x) => x.studentId === student.id));
      setHistory(h.filter((x) => x.studentId === student.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setReady(true);
    }
  }, [getToken, student.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = () => router.push("/nutritionist/students");

  const saveStudent = async () => {
    if (saving) return;
    setSaving(true);
    setEditMsg(null);
    try {
      const token = await getToken();
      await api.updateStudent(
        student.id,
        {
          name: editForm.name.trim() || student.name,
          photoURL: editForm.photoURL.trim(),
          status: editForm.status,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
        },
        token
      );
      const updated = await api.getStudent(student.id, token);
      onStudentChange?.(updated);
      setEditMsg("✓ Dados do aluno atualizados.");
    } catch (e) {
      setEditMsg(`⚠ ${e instanceof Error ? e.message : "Falha ao salvar"}`);
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <LoadingScreen />;

  const lastWorkout = history[0] ?? null;

  return (
    <div>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" className="btn-sm" onClick={close}>
          ‹ Voltar para alunos
        </button>
      </div>

      <div className="page-head">
        <div>
          <h1>{student.name || "Aluno"}</h1>
          <div className="page-sub">{student.email}</div>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <Link className="btn-sm" href={`/nutritionist/workouts?new=1&student=${student.id}`}>
            + Treino
          </Link>
          <Link className="btn-sm" href={`/nutritionist/diets?new=1&student=${student.id}`}>
            + Dieta
          </Link>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      {/* Dados do aluno */}
      <div className="section-label">Dados do aluno</div>
      {editing ? (
        <div className="nut-card" style={{ cursor: "default" }}>
          <div className="frm-row">
            <label className="frm-label">Foto (URL)</label>
            <input
              type="url"
              placeholder="https://…"
              value={editForm.photoURL}
              onChange={(e) => setEditForm({ ...editForm, photoURL: e.target.value })}
            />
          </div>
          <div className="frm-row">
            <label className="frm-label">Nome</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div className="frm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="frm-row">
              <label className="frm-label">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
            <div className="frm-row">
              <label className="frm-label">Plano (dias)</label>
              <input
                type="number"
                min={1}
                placeholder="ex.: 30"
                value={editForm.endDate ? String(Math.round((new Date(editForm.endDate).getTime() - new Date(editForm.startDate || new Date()).getTime()) / 86400000)) : ""}
                onChange={(e) => {
                  const days = Number(e.target.value);
                  const start = editForm.startDate || new Date().toISOString().slice(0, 10);
                  const end = days > 0
                    ? new Date(new Date(start).getTime() + days * 86400000).toISOString().slice(0, 10)
                    : "";
                  setEditForm({ ...editForm, startDate: start, endDate: end });
                }}
              />
            </div>
            <div className="frm-row">
              <label className="frm-label">Início</label>
              <input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              />
            </div>
            <div className="frm-row">
              <label className="frm-label">Término</label>
              <input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
              />
            </div>
          </div>
          {editMsg && <div className={editMsg.startsWith("✓") ? "" : "err-text"} style={editMsg.startsWith("✓") ? { color: "var(--ok, #2e7d32)", fontSize: 12, marginTop: 6 } : {}}>{editMsg}</div>}
          <div className="btn-row">
            <button
              type="button"
              className="btn-sm acc"
              disabled={saving}
              onClick={() => void saveStudent()}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className="btn-sm" onClick={() => { setEditing(false); setEditMsg(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="detail-grid">
          <div className="detail-cell">
            <div className="k">Foto</div>
            <div className="v">
              <div className="avatar">
                {student.photoURL ? (
                  <img src={student.photoURL} alt={student.name} />
                ) : (
                  student.name?.charAt(0)?.toUpperCase() || "?"
                )}
              </div>
            </div>
          </div>
          <div className="detail-cell">
            <div className="k">Status</div>
            <div className="v">
              <span className={`badge ${student.status || ""}`}>{student.status || "active"}</span>
            </div>
          </div>
          <div className="detail-cell">
            <div className="k">Início</div>
            <div className="v">{student.startDate || "—"}</div>
          </div>
          <div className="detail-cell">
            <div className="k">Término do acesso</div>
            <div className="v">{student.endDate || "—"}</div>
          </div>
          <div className="detail-cell">
            <div className="k">Treinos</div>
            <div className="v">{workouts.length}</div>
          </div>
          <div className="detail-cell" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn-sm acc" onClick={() => { setEditing(true); setEditMsg(null); }}>
              ✏ Editar
            </button>
          </div>
        </div>
      )}

      {/* Calendário mensal: dias com treino concluído (✓) e dias com treino agendado (◦) */}
      <div className="section-label">Calendário</div>
      <MonthCalendar workouts={workouts} history={history} />

      {/* Treinos */}
      <div className="section-label">Treinos</div>
      {workouts.length === 0 ? (
        <div className="empty-box">Nenhum treino para este aluno ainda.</div>
      ) : (
        workouts.map((w) => (
          <Link
            key={w.id}
            href={`/nutritionist/workouts?edit=${w.id}`}
            className="nut-card"
          >
            <div className="nut-card-head">
              <div className="avatar">🏋</div>
              <div>
                <div className="nut-card-title">{w.name}</div>
                <div className="nut-card-sub">
                  {w.objective || "Sem objetivo"}
                  {w.dayOfWeek ? ` · ${WEEK_DAY_LABEL[w.dayOfWeek] || w.dayOfWeek}` : ""}·
                  {w.exercises?.length ?? 0} exercícios
                </div>
              </div>
            </div>
            <div className="btn-row">
              <Link className="btn-sm" href={`/nutritionist/workouts?edit=${w.id}`}>
                Editar
              </Link>
              <Link
                className="btn-sm"
                href={`/nutritionist/workouts?new=1&student=${student.id}&copy=${w.id}`}
              >
                Duplicar
              </Link>
            </div>
          </Link>
        ))
      )}

      {/* Dietas */}
      <div className="section-label">Dietas</div>
      {diets.length === 0 ? (
        <div className="empty-box">Nenhuma dieta para este aluno ainda.</div>
      ) : (
        diets.map((d) => (
          <Link
            key={d.id}
            href={`/nutritionist/diets?edit=${d.id}`}
            className="nut-card"
          >
            <div className="nut-card-head">
              <div className="avatar">🥗</div>
              <div>
                <div className="nut-card-title">{d.name}</div>
                <div className="nut-card-sub">
                  {d.description || ""}
                  {` · ${d.meals?.length ?? 0} refeições`}
                  {d.startDate ? ` · ${d.startDate} → ${d.endDate || "?"}` : ""}
                </div>
              </div>
            </div>
            <div className="btn-row">
              <Link className="btn-sm" href={`/nutritionist/diets?edit=${d.id}`}>
                Editar
              </Link>
              <Link
                className="btn-sm"
                href={`/nutritionist/diets?new=1&student=${student.id}&copy=${d.id}`}
              >
                Duplicar
              </Link>
            </div>
          </Link>
        ))
      )}

      {/* Histórico + timeline */}
      <div className="section-label">Histórico de treinos</div>
      {history.length === 0 ? (
        <div className="empty-box">Nenhum treino concluído por este aluno.</div>
      ) : (
        <>
          <div className="detail-grid" style={{ marginBottom: 12 }}>
            <div className="detail-cell">
              <div className="k">Último treino</div>
              <div className="v">
                {lastWorkout
                  ? (workouts.find((w) => w.id === lastWorkout.workoutId)?.name ??
                    "Treino")
                  : "—"}
              </div>
            </div>
            <div className="detail-cell">
              <div className="k">Data</div>
              <div className="v">
                {lastWorkout?.completedAt
                  ? new Date(lastWorkout.completedAt).toLocaleDateString("pt-BR")
                  : "—"}
              </div>
            </div>
          </div>
          <div className="timeline">
            {history.map((h) => {
              const workout = workouts.find((w) => w.id === h.workoutId);
              const when = h.completedAt
                ? new Date(h.completedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })
                : "";
              return (
                <div key={h.id} className="tl-item">
                  <div className="tl-date">{when}</div>
                  <div className="tl-text">
                    <b>{workout?.name ?? "Treino"}</b> concluído
                    {h.duration ? ` em ${h.duration} min` : ""} —{" "}
                    {h.exercisesCompleted}/{h.totalExercises} exercícios
                    {h.exercises && h.exercises.length > 0 && (
                      <div className="tl-exercises">
                        {h.exercises.map((ex) => (
                          <span key={ex.order} className="tl-ex-chip">
                            {ex.name}
                            {ex.sets?.length
                              ? ` · ${ex.sets.filter((s) => s.done).length}/${ex.sets.length}`
                              : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Calendário mensal (treinos concluídos ✓ e agendados ◦) ──

const MONTH_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DOW_HEAD = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEK_DAY_KEY: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

function MonthCalendar({
  workouts,
  history,
}: {
  workouts: WorkoutDefine[];
  history: WorkoutHistoryEntry[];
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const completedByDay = new Map<string, WorkoutHistoryEntry[]>();
  for (const h of history) {
    if (!h.completedAt) continue;
    const key = h.completedAt.slice(0, 10);
    if (!completedByDay.has(key)) completedByDay.set(key, []);
    completedByDay.get(key)!.push(h);
  }
  const scheduledWeekDays = new Set(
    workouts.map((w) => w.dayOfWeek).filter(Boolean) as string[]
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="cal-month">
      <div className="cal-month-head">
        <button type="button" className="btn-sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          ‹
        </button>
        <b>
          {MONTH_LABEL[month]} {year}
        </b>
        <button type="button" className="btn-sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          ›
        </button>
      </div>
      <div className="cal-month-grid">
        {DOW_HEAD.map((l, i) => (
          <div key={i} className="cal-month-dow">{l}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="cal-month-cell empty" />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const done = completedByDay.get(key) ?? [];
          const wd = WEEK_DAY_KEY[new Date(year, month, day).getDay()];
          const planned = scheduledWeekDays.has(wd) && done.length === 0;
          const isToday = key === todayKey;
          const title = [
            ...done.map(
              (h) =>
                `✓ ${workouts.find((w) => w.id === h.workoutId)?.name ?? "Treino"} concluído`
            ),
            planned ? "◦ Treino agendado" : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={i}
              className={`cal-month-cell ${done.length ? "done" : ""} ${planned ? "planned" : ""} ${isToday ? "today" : ""}`}
              title={title || undefined}
            >
              <span className="d">{day}</span>
              {done.length > 0 && <span className="mark">✓</span>}
              {planned && <span className="mark">◦</span>}
            </div>
          );
        })}
      </div>
      <div className="cal-legend">
        <span><b className="lg-done">✓</b> concluído</span>
        <span><b className="lg-planned">◦</b> agendado</span>
        <span><b className="lg-today">●</b> hoje</span>
      </div>
    </div>
  );
}