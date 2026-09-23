# Fase 14.1 — Testes PWA

**Data:** 23 set 2026
**Status:** CONCLUÍDA — gates verdes (Vitest 50/50 · Playwright 22/22 · tsc ·
lint 0/0 · build). Nenhuma alteração na implementação do PWA em produção
(`sw.js`, `PWA.tsx`, `PWAInstall.tsx` permanecem intactos em comportamento).

## Objetivo

Transformar o PWA já implementado em comportamento **protegido por testes**,
sem alterar desnecessariamente a implementação existente. Foco: garantir que o
service worker **nunca** cacheia dados privados (`/api/*` ou requests com
`Authorization`), que o shell continua disponível offline e que o fluxo de
atualização (`SKIP_WAITING`) segue controlado pelo usuário.

## Estratégia de teste

- **`sw.js` (service worker real):** avaliado num contexto `node:vm` isolado,
  testando o **arquivo de produção verbatim** — sem extrair/duplicar lógica
  (evita drift entre teste e implementação). Os listeners de `fetch`/`message`/
  `activate` são capturados e exercitados com eventos falsos.
- **`PWA.tsx` / `PWAInstall.tsx`:** testes de componente com `@testing-library/
  react` e fakes de `navigator.serviceWorker` (jsdom não implementa SW).
- **E2E (Playwright):** spec dedicada com `test.use({ serviceWorkers: "allow" })`
  (o config global usa `"block"` para os demais specs) para exercitar o SW real
  no Chromium: precache, fallback offline e não-cache de `/api`.

## Arquivos alterados/criados

| Arquivo | Tipo |
|---|---|
| `frontend/__tests__/pwa-sw.test.ts` | novo — roteamento do SW + ciclo de vida |
| `frontend/__tests__/PWA.test.tsx` | novo — registro/update/banner/SKIP_WAITING |
| `frontend/__tests__/PWAInstall.test.tsx` | novo — beforeinstallprompt/iOS/instalado |
| `frontend/e2e/pwa.spec.ts` | novo — SW real: precache, offline, não-cache de `/api` |

> Nenhum arquivo de produção foi alterado (`public/sw.js`, `components/PWA.tsx`,
> `components/PWAInstall.tsx` permanecem como estavam).

## Testes criados (22 unit + 3 E2E)

### Service Worker (`pwa-sw.test.ts` — 10)
- não intercepta método não-GET;
- não intercepta `/api/*`;
- não intercepta request com `Authorization`;
- não intercepta cross-origin (API no Cloud Run);
- intercepta navegação (network-first);
- intercepta `/_next/static/*` (stale-while-revalidate);
- intercepta demais assets do mesmo domínio;
- `SKIP_WAITING` aciona `skipWaiting`;
- mensagem sem `SKIP_WAITING` não aciona;
- `activate` chama `clients.claim`.

### PWA.tsx (7)
- registra o SW ao montar;
- banner quando nova versão fica "installed" (updatefound + installed);
- banner imediato quando já há versão "waiting";
- envia `SKIP_WAITING` ao confirmar;
- "Agora não" esconde o banner sem recarregar;
- `controllerchange` recarrega a página;
- nada faz sem suporte a service worker.

### PWAInstall.tsx (5)
- sem `beforeinstallprompt` não mostra nada;
- mostra botão quando o evento dispara;
- `prompt()` ao clicar + some após aceitar;
- já instalado (standalone) não mostra;
- iOS mostra passo a passo de "Adicionar à Tela de Início".

### E2E (`pwa.spec.ts` — 3)
- registra o SW e precacheia o shell;
- navegação offline serve o shell do cache (network-first fallback);
- não cacheia `/api/*` nem requests autenticadas.

## Comandos executados

```
cd frontend
npx vitest run              # 50/50 ✅
npm run test:e2e            # 22/22 ✅ (19 pré-existentes + 3 PWA)
npx tsc --noEmit            # ✅
npm run lint                # 0/0 ✅
npm run build               # ✅
```

## Resultados

| Gate | Antes (F13) | Depois (F14.1) |
|---|---|---|
| Vitest | 28 | **50** ✅ |
| Playwright E2E | 19 | **22** ✅ |
| tsc --noEmit | ✅ | ✅ |
| lint | 0/0 | 0/0 ✅ |
| next build | ✅ | ✅ |

## Limitações

- O teste do `sw.js` avalia o arquivo real, mas **não** exercita as funções
  internas assíncronas `networkFirst`/`staleWhileRevalidate` em profundidade
  (isso é coberto no E2E pelo fallback offline real). A decisão de roteamento —
  o comportamento crítico de segurança — é testada integralmente.
- O E2E de atualização (`SKIP_WAITING` no navegador) **não** foi automatizado:
  exigiria publicar duas versões do SW e é intrinsecamente frágil; a lógica de
  update é coberta no nível de componente (`PWA.test.tsx`).
- O teste offline depende do SW já ter precacheado o shell antes de `setOffline`;
  a helper `settleServiceWorker` re-navega para uma página estável/controlada,
  eliminando a corrida do `controllerchange` → reload.
