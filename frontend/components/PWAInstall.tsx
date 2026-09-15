"use client";

import { useEffect, useState } from "react";

// Instalação do app (PWA):
//  • Android/Chrome/Edge: captura o evento beforeinstallprompt e mostra o botão
//    "Instalar aplicativo"; ao instalar (appinstalled ou modo standalone), some.
//  • iOS (Safari): não existe beforeinstallprompt — exibe o passo a passo de
//    "Adicionar à Tela de Início".
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const isClient = typeof window !== "undefined";

  const isIOS =
    isClient &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !window.matchMedia("(display-mode: standalone)").matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone;

  const installedStandalone =
    installed ||
    (isClient &&
      ((navigator as Navigator & { standalone?: boolean }).standalone ||
        window.matchMedia("(display-mode: standalone)").matches));

  // Já instalado/rodando como app: não mostra nada.
  if (installedStandalone) return null;

  // iOS: sem prompt nativo — ensina "Adicionar à Tela de Início".
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          className="pwa-install-ios-toggle"
          aria-expanded={iosOpen}
          onClick={() => setIosOpen((v) => !v)}
        >
          Instalar app
        </button>
        {iosOpen && (
          <div className="pwa-install-ios" role="note">
            <b>Como instalar no iPhone/iPad:</b>
            <ol>
              <li>
                Toque no botão <b>Compartilhar</b> (ícone com seta para cima) na
                barra do navegador.
              </li>
              <li>
                Escolha <b>“Adicionar à Tela de Início”</b>.
              </li>
              <li>
                Toque em <b>Adicionar</b> no canto superior.
              </li>
            </ol>
          </div>
        )}
      </>
    );
  }

  // Navegador sem suporte ao prompt (ou o evento ainda não disparou): nada a mostrar.
  if (!deferred) return null;

  return (
    <button
      type="button"
      className="pwa-install-btn"
      onClick={() =>
        void (async () => {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setDeferred(null);
        })()
      }
    >
      Instalar aplicativo
    </button>
  );
}