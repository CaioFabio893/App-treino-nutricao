"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { friendlyError, getDietPage } from "@/lib/api";
import { canReadBusiness } from "@/lib/profileAccess";
import styles from "./ProtectedDietViewer.module.css";

export default function ProtectedDietViewer(props: { dietId: string; pageCount: number }) {
  return <DocumentSession key={`${props.dietId}:${props.pageCount}`} {...props} />;
}

function DocumentSession({ dietId, pageCount }: { dietId: string; pageCount: number }) {
  const { profile, getToken } = useAuth();
  const [zoom, setZoom] = useState(100);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ loading: true, error: "" });
  const canvases = useRef<Array<HTMLCanvasElement | null>>([]);
  const identity = canReadBusiness(profile) ? (profile?.id ?? "") : "";

  useEffect(() => {
    const controller = new AbortController();
    const clear = () => canvases.current.forEach(canvas => {
      if (canvas) { canvas.width = 1; canvas.height = 1; }
    });
    clear();
    if (!identity) return () => controller.abort();
    const load = async () => {
      setState({ loading: true, error: "" });
      try {
        // Sequential loading bounds memory and avoids a burst against the API.
        for (let page = 1; page <= pageCount; page++) {
          const token = await getToken();
          if (controller.signal.aborted) return;
          const blob = await getDietPage(dietId, page, token, controller.signal);
          if (controller.signal.aborted) return;
          const bitmap = await createImageBitmap(blob);
          try {
            if (controller.signal.aborted) return;
            const canvas = canvases.current[page - 1];
            if (!canvas) return;
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas indisponível");
            context.drawImage(bitmap, 0, 0);
          } finally { bitmap.close(); }
        }
        if (!controller.signal.aborted) setState({ loading: false, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setState({ loading: false, error: friendlyError(error) });
      }
    };
    void load();
    return () => { controller.abort(); clear(); };
  }, [dietId, pageCount, identity, getToken, retry]);

  return (
    <section className={styles.viewer} aria-label="Plano alimentar protegido" onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()} onCopy={e => e.preventDefault()}>
      <div className={styles.toolbar}>
        <span>{pageCount} páginas · role para ler</span>
        <label>Zoom <select aria-label="Zoom do plano alimentar" value={zoom} onChange={e => setZoom(Number(e.target.value))}>
          <option value={100}>Ajustar à tela</option><option value={150}>150%</option><option value={200}>200%</option><option value={300}>300%</option>
        </select></label>
      </div>
      {state.loading && <p role="status" className={styles.note}>Abrindo documento…</p>}
      {state.error && <div role="alert">{state.error} <button type="button" className="btn-sm" onClick={() => setRetry(r => r + 1)}>Tentar novamente</button></div>}
      <div className={styles.viewport}>
        <div className={styles.pages} style={{ width: `${zoom}%` }}>
          {Array.from({ length: pageCount }, (_, i) => <canvas key={i} ref={canvas => { canvases.current[i] = canvas; }} className={styles.page} role="img" aria-label={`Página ${i + 1} do plano alimentar. Use o zoom para ampliar.`} />)}
        </div>
      </div>
    </section>
  );
}
