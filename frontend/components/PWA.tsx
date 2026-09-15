"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Registra o service worker (PWA) e detecta novas versões publicadas.
// Quando há uma versão nova instalada (aguardando ativação), exibe o banner
// "Nova versão disponível" — a troca só acontece com a confirmação do usuário
// (sem reload forçado enquanto a pessoa está usando o app).
export default function PWA() {
  const [updateReady, setUpdateReady] = useState(false);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onLoad = async () => {
      const registration = await navigator.serviceWorker
        .register("/sw.js")
        .catch(() => null);
      if (!registration) return;
      regRef.current = registration;

      const trackInstalling = (worker: ServiceWorker | null) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          // "installed" com uma versão ativa controlando as páginas = atualização.
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      };

      if (registration.waiting && navigator.serviceWorker.controller) {
        // Versão nova já estava aguardando (ex.: usuário voltou mais tarde).
        setUpdateReady(true);
      }
      registration.addEventListener("updatefound", () => {
        trackInstalling(registration.installing);
      });

      // Nova versão ativada (após "Atualizar agora"): recarrega com os assets novos.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    };

    // Registra o SW assim que possível. Aguardar somente "load" pode perder o
    // evento se ele já tiver disparado antes da hidratação do React (race que
    // deixava o app sem service worker em páginas rápidas).
    if (document.readyState === "complete") {
      void onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  const applyUpdate = useCallback(() => {
    const worker = regRef.current?.waiting;
    if (!worker) return;
    worker.postMessage({ type: "SKIP_WAITING" });
    // O evento controllerchange acima recarrega a página automaticamente.
  }, []);

  if (!updateReady) return null;

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <span>Nova versão disponível.</span>
      <div className="pwa-update-actions">
        <button
          type="button"
          className="pwa-update-later"
          onClick={() => setUpdateReady(false)}
        >
          Agora não
        </button>
        <button
          type="button"
          className="pwa-update-now"
          onClick={() => void applyUpdate()}
        >
          Atualizar agora
        </button>
      </div>
    </div>
  );
}