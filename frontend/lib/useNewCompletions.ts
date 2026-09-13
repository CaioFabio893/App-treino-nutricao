"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";

// Marcação de "última vez que o nutricionista olhou os treinos concluídos".
// Guardada no navegador — suficiente para o gráfico deste app (1 usuário por
// navegador). Se um dia precisar sincronizar entre dispositivos, move pra
// Firestore guardada no perfil do nutricionista.
const LS_LAST_SEEN = "ll_nutri_last_seen_at";

const POLL_MS = 60_000; // a cada 1 min

export function useNewCompletions() {
  const { getToken, profile } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    // Só o nutricionista recebe os avisos.
    if (!profile || profile.role !== "nutritionist") return;
    try {
      const token = await getToken();
      const history = await api.listHistory(token);
      let seen = 0;
      try {
        seen = Number(localStorage.getItem(LS_LAST_SEEN) || 0);
      } catch {
        /* sem acesso ao localStorage */
      }
      // Primeira visita: marca como "vi tudo" pra não alagar com o histórico antigo.
      if (!seen) {
        try {
          localStorage.setItem(LS_LAST_SEEN, String(Date.now()));
        } catch {
          /* ignora */
        }
        setCount(0);
        return;
      }
      const fresh = history.filter(
        (h) => h.completedAt && new Date(h.completedAt).getTime() > seen
      );
      setCount(fresh.length);
    } catch {
      /* offline — mantém o contador anterior */
    }
  }, [getToken, profile]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  // Marca como visto (zera o contador). Chamar ao clicar no badge.
  const consume = useCallback(() => {
    try {
      localStorage.setItem(LS_LAST_SEEN, String(Date.now()));
    } catch {
      /* ignora */
    }
    setCount(0);
  }, []);

  return { count, consume };
}