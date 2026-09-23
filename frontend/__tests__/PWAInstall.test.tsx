import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import PWAInstall from "@/components/PWAInstall";

// jsdom não implementa navigator.serviceWorker/standalone; o componente PWAInstall
// usa navigator.userAgent, window.matchMedia e navigator.standalone.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function makeInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const evt = new Event("beforeinstallprompt") as InstallPromptEvent;
  evt.prompt = vi.fn(() => Promise.resolve());
  evt.userChoice = Promise.resolve({ outcome });
  return evt;
}

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: ua,
  });
}

function setStandalone(value: boolean) {
  Object.defineProperty(navigator, "standalone", {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0");
  setStandalone(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PWAInstall — instalação", () => {
  it("não mostra nada quando não há evento beforeinstallprompt", async () => {
    render(<PWAInstall />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Instalar aplicativo" })).not.toBeInTheDocument();
  });

  it("mostra o botão de instalação quando beforeinstallprompt dispara", async () => {
    render(<PWAInstall />);
    const evt = makeInstallPrompt();
    await act(async () => {
      window.dispatchEvent(evt);
    });
    expect(screen.getByRole("button", { name: "Instalar aplicativo" })).toBeInTheDocument();
  });

  it("chama prompt() ao clicar em instalar e some após aceitar", async () => {
    render(<PWAInstall />);
    const evt = makeInstallPrompt("accepted");
    await act(async () => {
      window.dispatchEvent(evt);
    });

    const btn = screen.getByRole("button", { name: "Instalar aplicativo" });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(evt.prompt).toHaveBeenCalledTimes(1);
    // Após instalar (outcome accepted), o botão desaparece.
    expect(screen.queryByRole("button", { name: "Instalar aplicativo" })).not.toBeInTheDocument();
  });

  it("já instalado (display-mode standalone) não mostra o botão", async () => {
    setStandalone(true);
    render(<PWAInstall />);
    const evt = makeInstallPrompt();
    await act(async () => {
      window.dispatchEvent(evt);
    });
    expect(screen.queryByRole("button", { name: "Instalar aplicativo" })).not.toBeInTheDocument();
  });

  it("no iOS mostra o passo a passo de 'Adicionar à Tela de Início'", async () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1");
    render(<PWAInstall />);
    await act(async () => {});
    // No iOS não há beforeinstallprompt nativo; o botão ensina o fluxo manual.
    const toggle = screen.getByRole("button", { name: "Instalar app" });
    fireEvent.click(toggle);
    expect(screen.getByText("Como instalar no iPhone/iPad:")).toBeInTheDocument();
  });
});
