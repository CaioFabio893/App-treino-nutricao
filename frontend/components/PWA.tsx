"use client";

import { useEffect } from "react";

// Registra o service worker (PWA) para cache de arquivos estáticos.
export default function PWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
  }, []);
  return null;
}