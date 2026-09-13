"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { DAYS, PHASES, PR_MAP, WEEK_COUNT } from "@/lib/data";
import type { Check, ExerciseData, PRs, SessionData, SetData } from "@/lib/types";
import Header from "./Header";
import DayTabs from "./DayTabs";
import PhaseBar from "./PhaseBar";
import CardioBox from "./CardioBox";
import ExerciseCard from "./ExerciseCard";
import BottomNav from "./BottomNav";
import PRModal from "./PRModal";
import WeekModal from "./WeekModal";
import Toast from "./Toast";
import { LoadingScreen } from "./SetupNeeded";

const EMPTY_PRS: PRs = { a: 0, b: 0, c: 0 };

// Garante que a sessão tenha a mesma estrutura do plano do dia (arrays preenchidos).
function normalizeSession(sess: SessionData | null, dayIx: number, week: number): SessionData {
  const plan = DAYS[dayIx];
  const exercise: ExerciseData[] = plan.ex.map((ex, ei) => {
    const src = sess?.exercise?.[ei];
    const sets: SetData[] = Array.from({ length: ex.s }, (_, si) => {
      const s = src?.sets?.[si];
      const w = typeof s?.w === "number" && Number.isFinite(s.w) ? s.w : undefined;
      const r = typeof s?.r === "number" && Number.isFinite(s.r) ? s.r : undefined;
      const c: Check = s?.c === "ok" || s?.c === "fail" ? s.c : "";
      return { w, r, c };
    });
    return { sets, note: src?.note || "" };
  });
  return { week, day: plan.id, exercise };
}

const emptySession = (dayIx: number, week: number) => normalizeSession(null, dayIx, week);

export default function WorkoutApp() {
  const { getToken, logout } = useAuth();

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [week, setWeek] = useState(1);
  const [dayIx, setDayIx] = useState(0);
  const [prs, setPrs] = useState<PRs>(EMPTY_PRS);
  const [draft, setDraft] = useState<SessionData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [prOpen, setPrOpen] = useState(false);
  const [wkOpen, setWkOpen] = useState(false);

  const draftRef = useRef<SessionData | null>(null);
  const dirtyRef = useRef(false);
  const weekRef = useRef(1);
  const dayIxRef = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const persist = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current;
    if (!dirtyRef.current || !d) return true;
    try {
      setSaving(true);
      const token = await getToken();
      await api.putSession(weekRef.current, d.day, d, token);
      dirtyRef.current = false;
      setDirty(false);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [getToken]);

  // Persiste a posição atual (semana/dia) no servidor.
  const saveState = useCallback(
    async (day?: number, wk?: number) => {
      try {
        const token = await getToken();
        await api.putState({ week: wk ?? weekRef.current, day: day ?? dayIxRef.current }, token);
      } catch {
        /* silencioso — não é crítico */
      }
    },
    [getToken]
  );

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [st, p] = await Promise.all([api.getState(token), api.getPRs(token)]);
      const w = Math.min(WEEK_COUNT, Math.max(1, st?.week || 1));
      const d = Math.min(DAYS.length - 1, Math.max(0, st?.day || 0));
      const sess = await api.getSession(w, DAYS[d].id, token);

      weekRef.current = w;
      dayIxRef.current = d;
      setWeek(w);
      setDayIx(d);
      setPrs(p || EMPTY_PRS);

      const base = normalizeSession(sess, d, w);
      draftRef.current = base;
      setDraft(base);
      dirtyRef.current = false;
      setDirty(false);
      setLoadError(null);
    } catch {
      const base = emptySession(0, 1);
      draftRef.current = base;
      setDraft(base);
      setLoadError(
        "Não consegui carregar seus dados. Verifique a conexão (ou se a API está no ar) e tente de novo."
      );
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist();
    }, 3000);
  }, [persist]);

  const mutateDraft = useCallback(
    (fn: (d: SessionData) => void) => {
      const prev = draftRef.current;
      if (!prev) return;
      const next = structuredClone(prev);
      fn(next);
      draftRef.current = next;
      setDraft(next);
      markDirty();
    },
    [markDirty]
  );

  const onSet = useCallback(
    (ei: number, si: number, field: "w" | "r", value: number | undefined) => {
      mutateDraft((d) => {
        if (!d.exercise[ei]) d.exercise[ei] = { sets: [] };
        if (!d.exercise[ei].sets[si]) d.exercise[ei].sets[si] = {};
        d.exercise[ei].sets[si][field] = value;
      });
    },
    [mutateDraft]
  );

  const onChk = useCallback(
    (ei: number, si: number) => {
      mutateDraft((d) => {
        if (!d.exercise[ei]) d.exercise[ei] = { sets: [] };
        if (!d.exercise[ei].sets[si]) d.exercise[ei].sets[si] = {};
        const cur = d.exercise[ei].sets[si].c || "";
        d.exercise[ei].sets[si].c = cur === "" ? "ok" : cur === "ok" ? "fail" : "";
      });
    },
    [mutateDraft]
  );

  const onNote = useCallback(
    (ei: number, text: string) => {
      mutateDraft((d) => {
        if (!d.exercise[ei]) d.exercise[ei] = { sets: [] };
        d.exercise[ei].note = text;
      });
    },
    [mutateDraft]
  );

  const switchDay = useCallback(
    async (i: number) => {
      if (i === dayIxRef.current) return;
      const ok = await persist();
      if (!ok && dirtyRef.current) {
        showToast("Não salvei o treino atual — sem conexão");
      }
      dayIxRef.current = i;
      setDayIx(i);
      try {
        const token = await getToken();
        const sess = await api.getSession(weekRef.current, DAYS[i].id, token);
        const base = normalizeSession(sess, i, weekRef.current);
        draftRef.current = base;
        setDraft(base);
      } catch {
        draftRef.current = emptySession(i, weekRef.current);
        setDraft(draftRef.current);
        showToast("Sem conexão — dados não carregados");
      }
      dirtyRef.current = false;
      setDirty(false);
      void saveState(i);
      window.scrollTo(0, 0);
    },
    [persist, getToken, showToast, saveState]
  );

  const goDay = useCallback(
    (delta: number) => {
      const ni = dayIxRef.current + delta;
      if (ni < 0 || ni >= DAYS.length) {
        showToast(delta < 0 ? "Primeiro treino" : "Último treino");
        return;
      }
      void switchDay(ni);
    },
    [switchDay, showToast]
  );

  const selectWeek = useCallback(
    async (w: number) => {
      setWkOpen(false);
      await persist();
      weekRef.current = w;
      setWeek(w);
      try {
        const token = await getToken();
        const sess = await api.getSession(w, DAYS[dayIxRef.current].id, token);
        draftRef.current = normalizeSession(sess, dayIxRef.current, w);
        setDraft(draftRef.current);
      } catch {
        draftRef.current = emptySession(dayIxRef.current, w);
        setDraft(draftRef.current);
      }
      dirtyRef.current = false;
      setDirty(false);
      void saveState(dayIxRef.current, w);
      showToast(`✓ Semana ${w}`);
    },
    [persist, getToken, showToast, saveState]
  );

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!draftRef.current) return;
    dirtyRef.current = true;
    setDirty(true);
    const ok = await persist();
    showToast(ok ? "✓ Treino salvo!" : "⚠ Falha ao salvar — verifique a conexão");
  }, [persist, showToast]);

  const savePR = useCallback(
    async (p: PRs) => {
      setPrs(p);
      setPrOpen(false);
      try {
        const token = await getToken();
        await api.putPRs(p, token);
        showToast("✓ PRs atualizados!");
      } catch {
        showToast("⚠ Falha ao salvar PRs");
      }
    },
    [getToken, showToast]
  );

  const handleLogout = useCallback(async () => {
    await persist().catch(() => {});
    await logout();
  }, [persist, logout]);

  if (!ready) return <LoadingScreen />;

  const day = DAYS[dayIx];
  const ph = PHASES[week];
  const done = draft
    ? draft.exercise.reduce(
        (acc, ed) => acc + ed.sets.filter((s) => s.c === "ok").length,
        0
      )
    : 0;
  const total = day.ex.reduce((acc, e) => acc + e.s, 0);

  return (
    <div>
      <Header week={week} onPR={() => setPrOpen(true)} onWeek={() => setWkOpen(true)} onLogout={handleLogout} />
      <DayTabs days={DAYS} current={dayIx} onSwitch={(i) => void switchDay(i)} />
      <div id="main">
        {loadError ? (
          <div className="setup-card err-card">
            <div className="modal-title">Ops…</div>
            <p>{loadError}</p>
            <button type="button" className="btn-p" style={{ width: "100%" }} onClick={() => { setReady(false); void load(); }}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <PhaseBar phase={ph} done={done} total={total} />
            {day.cardio && <CardioBox options={day.cardio} />}
            <div className="section-label">🏋 Hipertrofia</div>
            {day.ex.map((ex, ei) => (
              <ExerciseCard
                key={ex.n}
                ei={ei}
                week={week}
                dayId={day.id}
                plan={ex}
                phase={ph}
                prKey={PR_MAP[ex.n]}
                prs={prs}
                data={draft?.exercise[ei]}
                getToken={getToken}
                onSet={onSet}
                onChk={onChk}
                onNote={onNote}
              />
            ))}
          </>
        )}
      </div>
      <BottomNav onPrev={() => goDay(-1)} onSave={() => void saveNow()} onNext={() => goDay(1)} dirty={dirty} saving={saving} />
      <PRModal open={prOpen} prs={prs} onClose={() => setPrOpen(false)} onSave={(p) => void savePR(p)} />
      <WeekModal open={wkOpen} week={week} onClose={() => setWkOpen(false)} onSelect={(w) => void selectWeek(w)} />
      <Toast message={toast} />
    </div>
  );
}