// Service Worker — PWA do Treino Ciclo 2 (Louise Lima)
// Estratégia de cache segura para produção:
//   • PRECACHE no install: app shell, manifest e ícones (permite abrir offline).
//   • NAVEGAÇÃO: network-first (sempre tenta a rede; cai no cache/offline em falha).
//   • ASSETS imutáveis (/_next/static/*): cache-first com revalidação de fundo
//     (stale-while-revalidate).
//   • NUNCA cacheia dados privados: /api/*, requisições com header Authorization,
//     métodos não-GET e origins externas não são interceptadas.
//   • Atualização: a nova versão só assume após o usuário confirmar
//     (mensagem SKIP_WAITING enviada pelo app) — sem reload forçado.
const CACHE = "treino-v3";
const PRECACHE_URLS = [
  "/",
  "/login",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // shell é opcional: navegação continua network-first
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Usuário confirmou a atualização no banner: ativa o SW novo na hora.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const shell = await cache.match(fallbackUrl);
      if (shell) return shell;
    }
    return new Response("Você está offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refreshed = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || refreshed || new Response("Offline", { status: 503 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Fora do nosso domínio (API no Cloud Run) ou dados autenticados: sem cache.
  if (url.origin !== self.location.origin) return;
  if (request.headers.get("authorization")) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  // Demais assets do mesmo domínio (ícones, fontes, manifest): network-first leve.
  event.respondWith(networkFirst(request));
});