"use client";

import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "@/lib/types";
import styles from "./StudentAssignmentPicker.module.css";

/** Bounded parallelism keeps large selections responsive without flooding the API. */
export async function assignSelectedStudents(ids: string[], assign: (id: string) => Promise<void>, progress: (done: number) => void) {
  let cursor = 0;
  let done = 0;
  const failed: string[] = [];
  await Promise.all(Array.from({ length: Math.min(3, ids.length) }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try { await assign(id); } catch { failed.push(id); }
      progress(++done);
    }
  }));
  return failed;
}

export default function StudentAssignmentPicker({ students, title, description, onPick, busy }: {
  students: UserProfile[];
  title: string;
  description: string;
  onPick: (ids: string[], pending: Record<string, string>, progress: (done: number) => void) => Promise<string[]>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [limit, setLimit] = useState(100);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const locked = busy || running;
  const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visible = (open ? students : []).filter(s => normalized(`${s.name} ${s.email || ""}`).includes(normalized(query.trim())))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  useEffect(() => {
    if (open) { dialog.current?.showModal(); search.current?.focus(); }
    else dialog.current?.close();
  }, [open]);
  const close = () => { if (!locked) { setOpen(false); trigger.current?.focus(); } };
  const submit = async () => {
    if (locked || !selected.length) return;
    setRunning(true); setDone(0); setFailure("");
    try {
      const failed = await onPick(selected, pending, setDone);
      setSelected(failed);
      if (failed.length) setFailure(`${failed.length} aluno(s) não receberam. Tente novamente: somente os pendentes continuam selecionados.`);
      else { setOpen(false); trigger.current?.focus(); }
    } catch { setFailure("Não foi possível concluir. Tente novamente."); }
    finally { setRunning(false); }
  };
  return <>
    <button ref={trigger} type="button" className="btn-sm acc" disabled={busy} onClick={() => setOpen(true)}>Associar a vários alunos</button>
    <dialog ref={dialog} className={styles.dialog} aria-label={title} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      {open && <>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      <input ref={search} className={styles.search} type="search" aria-label="Buscar alunos" placeholder="Buscar por nome ou e-mail" value={query} disabled={locked} onChange={e => { setQuery(e.target.value); setLimit(100); }} />
      <div className={styles.tools}>
        <button type="button" className="btn-sm" disabled={locked || !visible.length} onClick={() => setSelected([...new Set([...selected, ...visible.map(s => s.id)])])}>Selecionar todos {query ? "da busca" : "os alunos"}</button>
        <button type="button" className="btn-sm" disabled={locked || !selected.length} onClick={() => setSelected([])}>Limpar seleção</button>
      </div>
      <p className={styles.count} aria-live="polite">{selected.length} selecionado(s) · {visible.length} aluno(s) na lista</p>
      <div className={styles.list}>
        {visible.slice(0, limit).map(s => <label key={s.id} className={styles.row}>
          <input type="checkbox" disabled={locked} checked={selected.includes(s.id)} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, s.id])] : selected.filter(id => id !== s.id))} />
          <span><b>{s.name || s.id}</b><small>{s.email}</small></span>
        </label>)}
        {visible.length > limit && <button type="button" className="btn-sm full" onClick={() => setLimit(limit + 100)}>Mostrar mais alunos ({visible.length - limit} restantes)</button>}
        {!visible.length && <p>Nenhum aluno encontrado.</p>}
      </div>
      {running && <div className={styles.progress} role="status"><progress max={selected.length} value={done} />Associando: {done} de {selected.length}</div>}
      {failure && <p role="alert" className="err-text">{failure}</p>}
      <div className={styles.footer}>
        <button type="button" className="btn-sm acc" disabled={locked || !selected.length} onClick={() => void submit()}>{running ? "Associando…" : `Associar a ${selected.length} aluno(s)`}</button>
        <button type="button" className="btn-sm" disabled={locked} onClick={close}>Fechar</button>
      </div>
      </>}
    </dialog>
  </>;
}
