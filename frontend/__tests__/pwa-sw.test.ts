import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

// Testa o service worker REAL (frontend/public/sw.js) avaliando o arquivo num
// contexto isolado. Nada do sw.js é alterado — o objetivo é travar o
// comportamento de roteamento (o que NUNCA é interceptado/cacheado) sem risco
// de drift entre o teste e a implementação de produção.

const SW_SOURCE = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

type Listener = (event: unknown) => void;

interface RequestLike {
  method: string;
  url: string;
  mode?: string;
  headers: { get: (name: string) => string | null };
}

interface Sandbox {
  self: {
    location: { origin: string };
    addEventListener: (type: string, fn: Listener) => void;
    clients: { claim: ReturnType<typeof vi.fn> };
    skipWaiting: ReturnType<typeof vi.fn>;
  };
  listeners: Record<string, Listener[]>;
}

function loadServiceWorker(): Sandbox {
  const listeners: Record<string, Listener[]> = {};
  const selfObj: Sandbox["self"] = {
    location: { origin: "https://app.example.com" },
    addEventListener(type: string, fn: Listener) {
      (listeners[type] ||= []).push(fn);
    },
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
  };

  const cache = {
    async addAll(): Promise<void> {},
    async match(): Promise<undefined> {
      return undefined;
    },
    async put(): Promise<void> {},
  };
  const cachesObj = {
    async open(): Promise<typeof cache> {
      return cache;
    },
    async keys(): Promise<string[]> {
      return [];
    },
    async delete(): Promise<boolean> {
      return true;
    },
  };
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response("ok", { status: 200 }))
  );

  const context = vm.createContext({
    self: selfObj,
    caches: cachesObj,
    fetch: fetchMock,
    URL,
    Response,
    console,
  });
  vm.runInContext(SW_SOURCE, context);

  return { self: selfObj, listeners };
}

function makeRequest(
  opts: {
    method?: string;
    url?: string;
    authorization?: string | null;
    mode?: string;
  } = {}
): RequestLike {
  const {
    method = "GET",
    url = "https://app.example.com/",
    authorization = null,
    mode,
  } = opts;
  return {
    method,
    url,
    mode,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? authorization : null,
    },
  };
}

function dispatchFetch(sb: Sandbox, request: RequestLike) {
  const respondWith = vi.fn();
  const ev = { request, respondWith };
  for (const fn of sb.listeners.fetch) fn(ev);
  return respondWith;
}

describe("Service Worker — roteamento de fetch (nunca cacheia dados sensíveis)", () => {
  it("não intercepta métodos que não são GET", () => {
    const sb = loadServiceWorker();
    const respondWith = dispatchFetch(
      sb,
      makeRequest({ method: "POST", url: "https://app.example.com/api/me" })
    );
    expect(respondWith).not.toHaveBeenCalled();
  });

  it("não intercepta rotas /api/*", () => {
    const sb = loadServiceWorker();
    const respondWith = dispatchFetch(
      sb,
      makeRequest({ url: "https://app.example.com/api/me" })
    );
    expect(respondWith).not.toHaveBeenCalled();
  });

  it("não intercepta requests com header Authorization", () => {
    const sb = loadServiceWorker();
    const respondWith = dispatchFetch(
      sb,
      makeRequest({ url: "https://app.example.com/", authorization: "Bearer token" })
    );
    expect(respondWith).not.toHaveBeenCalled();
  });

  it("não intercepta requisições cross-origin (ex.: API no Cloud Run)", () => {
    const sb = loadServiceWorker();
    const respondWith = dispatchFetch(
      sb,
      makeRequest({ url: "https://treino-api-xyz.a.run.app/api/me" })
    );
    expect(respondWith).not.toHaveBeenCalled();
  });

  it("intercepta navegação (network-first com fallback de shell)", () => {
    const sb = loadServiceWorker();
    const respondWith = dispatchFetch(
      sb,
      makeRequest({ url: "https://app.example.com/login", mode: "navigate" })
    );
    expect(respondWith).toHaveBeenCalledTimes(1);
  });

  it("intercepta assets imutáveis /_next/static/* (stale-while-revalidate)", () => {
    const sb = loadServiceWorker();
    const respondWith = dispatchFetch(
      sb,
      makeRequest({ url: "https://app.example.com/_next/static/chunks/main.js" })
    );
    expect(respondWith).toHaveBeenCalledTimes(1);
  });

  it("intercepta demais assets do mesmo domínio (ícones/fontes/manifest)", () => {
    const sb = loadServiceWorker();
    const respondWith = dispatchFetch(
      sb,
      makeRequest({ url: "https://app.example.com/icon-192.png" })
    );
    expect(respondWith).toHaveBeenCalledTimes(1);
  });
});

describe("Service Worker — ciclo de vida", () => {
  it("SKIP_WAITING aciona skipWaiting (atualização controlada pelo usuário)", () => {
    const sb = loadServiceWorker();
    for (const fn of sb.listeners.message) fn({ data: { type: "SKIP_WAITING" } });
    expect(sb.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("mensagem sem SKIP_WAITING não aciona skipWaiting", () => {
    const sb = loadServiceWorker();
    for (const fn of sb.listeners.message) fn({ data: { type: "OTHER" } });
    expect(sb.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("activate chama clients.claim (controla páginas já abertas)", async () => {
    const sb = loadServiceWorker();
    for (const fn of sb.listeners.activate) {
      await new Promise<void>((resolve) => {
        fn({
          waitUntil: (p: Promise<unknown>) => {
            p.then(() => resolve());
          },
        });
      });
    }
    expect(sb.self.clients.claim).toHaveBeenCalledTimes(1);
  });
});
