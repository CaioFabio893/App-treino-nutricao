import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import PWA from "@/components/PWA";

// ── Fakes de Service Worker (jsdom não implementa navigator.serviceWorker) ──

interface FakeWorker {
  state: string;
  listeners: Array<() => void>;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: (type: string, fn: () => void) => void;
  setState: (s: string) => void;
}

function makeWorker(state = "installing"): FakeWorker {
  const listeners: Array<() => void> = [];
  const worker: FakeWorker = {
    state,
    listeners,
    postMessage: vi.fn(),
    addEventListener(type: string, fn: () => void) {
      if (type === "statechange") listeners.push(fn);
    },
    setState(s: string) {
      worker.state = s;
      listeners.forEach((fn) => fn());
    },
  };
  return worker;
}

interface FakeRegistration {
  installing: FakeWorker | null;
  waiting: FakeWorker | null;
  updatefound: Array<() => void>;
  emitUpdateFound: () => void;
  addEventListener: (type: string, fn: () => void) => void;
}

function makeRegistration(worker: FakeWorker): FakeRegistration {
  const reg: FakeRegistration = {
    installing: worker,
    waiting: null,
    updatefound: [],
    emitUpdateFound() {
      reg.updatefound.forEach((fn) => fn());
    },
    addEventListener(type, fn) {
      if (type === "updatefound") reg.updatefound.push(fn);
    },
  };
  return reg;
}

interface FakeServiceWorker {
  controller: unknown;
  register: ReturnType<typeof vi.fn>;
  controllerchange: Array<(e: unknown) => void>;
  addEventListener: (type: string, fn: (e: unknown) => void) => void;
  emit: (type: string, e?: unknown) => void;
}

function makeServiceWorker(opts: { controller?: unknown } = {}) {
  const sw: FakeServiceWorker = {
    controller: opts.controller ?? null,
    register: vi.fn(),
    controllerchange: [],
    addEventListener(type, fn) {
      if (type === "controllerchange") sw.controllerchange.push(fn);
    },
    emit(type, e) {
      if (type === "controllerchange") sw.controllerchange.forEach((fn) => fn(e));
    },
  };
  return sw;
}

function installServiceWorker(sw: FakeServiceWorker) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: sw,
  });
  Object.defineProperty(document, "readyState", {
    configurable: true,
    value: "complete",
  });
}

function mockReload() {
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  return reload;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("PWA — registro e atualização do service worker", () => {
  it("registra o service worker ao montar", async () => {
    const reg = makeRegistration(makeWorker());
    const sw = makeServiceWorker();
    sw.register.mockResolvedValue(reg);
    installServiceWorker(sw);

    render(<PWA />);
    await flush();

    expect(sw.register).toHaveBeenCalledWith("/sw.js");
    // Sem nova versão aguardando, não mostra banner.
    expect(screen.queryByText("Nova versão disponível.")).not.toBeInTheDocument();
  });

  it("mostra o banner quando uma nova versão fica instalada (updatefound + installed)", async () => {
    const worker = makeWorker("installing");
    const reg = makeRegistration(worker);
    const sw = makeServiceWorker({ controller: {} });
    sw.register.mockResolvedValue(reg);
    installServiceWorker(sw);

    render(<PWA />);
    await flush();

    await act(async () => {
      reg.emitUpdateFound(); // registra o listener de statechange no installing
      worker.setState("installed"); // nova versão pronta + controller ativo
    });

    expect(screen.getByText("Nova versão disponível.")).toBeInTheDocument();
  });

  it("mostra o banner imediatamente se já há versão waiting no carregamento", async () => {
    const worker = makeWorker("installed");
    const reg = makeRegistration(worker);
    reg.waiting = worker;
    const sw = makeServiceWorker({ controller: {} });
    sw.register.mockResolvedValue(reg);
    installServiceWorker(sw);

    render(<PWA />);
    await flush();

    expect(screen.getByText("Nova versão disponível.")).toBeInTheDocument();
  });

  it("envia SKIP_WAITING ao confirmar a atualização", async () => {
    const worker = makeWorker("installed");
    const reg = makeRegistration(worker);
    reg.waiting = worker;
    const sw = makeServiceWorker({ controller: {} });
    sw.register.mockResolvedValue(reg);
    installServiceWorker(sw);

    render(<PWA />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar agora" }));
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("esconde o banner em 'Agora não' sem recarregar", async () => {
    const worker = makeWorker("installed");
    const reg = makeRegistration(worker);
    reg.waiting = worker;
    const sw = makeServiceWorker({ controller: {} });
    sw.register.mockResolvedValue(reg);
    installServiceWorker(sw);

    render(<PWA />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(screen.queryByText("Nova versão disponível.")).not.toBeInTheDocument();
  });

  it("recarrega a página no evento controllerchange", async () => {
    const reload = mockReload();
    const reg = makeRegistration(makeWorker());
    const sw = makeServiceWorker({ controller: {} });
    sw.register.mockResolvedValue(reg);
    installServiceWorker(sw);

    render(<PWA />);
    await flush();

    await act(async () => {
      sw.emit("controllerchange");
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("não faz nada quando o service worker não é suportado", async () => {
    // Simula navegador sem serviceWorker: remove a propriedade para que
    // `"serviceWorker" in navigator` seja false.
    Reflect.deleteProperty(navigator, "serviceWorker");
    render(<PWA />);
    await flush();
    expect(screen.queryByText("Nova versão disponível.")).not.toBeInTheDocument();
  });
});
