# Fase 3 — Testes E2E (Playwright)

**Data:** 22 set 2026
**Status:** CONCLUÍDA — 17/17 testes verdes, documentada e commitada.

---

## Objetivo

Levar a Fase 3 do estado "E2E escrito mas bloqueado" para "E2E totalmente verde",
documentado e commitado. O bloqueio inicial era a página `/login` presa em
`Carregando.` — o `initializing` do `useAuth` nunca terminava, impedindo qualquer
teste de UI de rodar.

## Infraestrutura

- **Playwright** (`@playwright/test` 1.63.0, Chromium) com `webServer` que sobe
  `next dev` na porta 3100 apontando para o backend local (8081) e o Auth
  Emulator (9099) via env `NEXT_PUBLIC_*`.
- **Firebase Auth Emulator** (9099) + **Firestore Emulator** (8080), orquestrados
  por `firebase emulators:exec --only firestore,auth` (`npm run test:e2e`).
- **Seed determinístico** (`backend/cmd/e2eseed`) que cria 7 usuários (admin,
  nutricionista, 3 alunos com planos distintos, pendente, recusado), planos,
  treinos, históricos, dietLogs e scores.
- **`run-inner.mjs`**: sobe a API Go (emuladores), aguarda `/health`, roda o seed
  e executa o Playwright, matando o backend ao final.

## Cenário inicial

Todos os testes de UI falhavam por timeout (60s) com a página `/login` presa em
`Carregando.`. Testes puros de API/autorização (sem navegador) passavam.

## Causa raiz

**Dois problemas distintos, ambos identificados com instrumentação:**

1. **Next.js 16 bloqueava recursos dev de origem `127.0.0.1`** (origem canônica do
   `next dev` é `localhost`). O Playwright acessa o app por `127.0.0.1:3100`, então
   o Next logava `Blocked cross-origin request to Next.js dev resource /_next/hmr`
   e o websocket do HMR falhava com `ERR_INVALID_HTTP_RESPONSE`. Sem isso o
   bootstrap do cliente não completava: a página ficava como SSR estático
   ("Carregando.") e o `onAuthStateChanged` (que habilita o formulário) nunca
   rodava. **Correção:** `allowedDevOrigins: ["127.0.0.1"]` em `next.config.ts`
   + liberar emuladores locais no `connect-src` da CSP apenas em dev
   (`http://127.0.0.1:* http://localhost:* ws://127.0.0.1:*` — nunca em produção).

2. **Service worker do PWA recarregava a página no meio dos testes.** O `sw.js`
   chama `self.clients.claim()` no `activate`, disparando `controllerchange`, que
   o `PWA.tsx` trata com `window.location.reload()`. Esse reload inesperado
   resetava o estado (modo login/signup, erro amigável, campos) de forma
   intermitente, causando falhas aleatórias em testes diferentes a cada execução.
   **Correção:** `serviceWorkers: "block"` no contexto E2E do Playwright
   (`playwright.config.ts`) — comportamento só de teste, produção intacta.

## Correções secundárias (testes)

- **Seletores ambíguos (strict mode):** `a[href="/treinos"]` etc. resolviam para
  2 elementos (card do dashboard + link da navegação inferior). Substituídos por
  `getByRole("link", { name: "...", exact: true })`; saudações trocadas para
  `getByRole("heading", ...)`.
- **Admin navega ao painel via UI:** o admin cai em `/nutritionist` e as
  pendências ficam em `/admin`. Os testes agora clicam o link "Usuários"
  (navegação client-side) em vez de `page.goto("/admin")` (que expõe uma corrida
  de carregamento de `role` — registrada como limitação).
- **`aluno conclui o treino`:** expande o primeiro exercício (`.ex-hd`) antes de
  marcar a série (a lista de séries começa recolhida).
- **Isolamento de teste mutante:** o teste de aprovação (que cria um aluno novo)
  foi renomeado para `zz-aprovacao.spec.ts` para rodar por último, não afetando
  os testes que assumem exatamente 3 alunos (ranking/autorização).
- **`signup` robusto:** aguarda o heading "Criar conta" após clicar "Cadastre-se".

## Testes

| Arquivo | Cenários |
|---|---|
| `e2e/auth.spec.ts` | 6 — redirecionamento anônimo, senha incorreta, admin, aluno ativo, pendente, recusado |
| `e2e/aluno.spec.ts` | 4 — 4 áreas do plano completo, concluir treino, bloqueio sem dieta, bloqueio sem ranking |
| `e2e/autorizacao.spec.ts` | 5 — token inválido, aluno sem rotas admin, features bloqueiam módulos, aluno com feature usa módulo, frontend bloqueia aluno no /admin |
| `e2e/ranking.spec.ts` | 1 — topo do ranking (Ana > Bruno > Carla) |
| `e2e/zz-aprovacao.spec.ts` | 1 — cadastro pendente → admin aprova → aluno acessa dashboard |

**Resultado final: 17/17 verdes** (`17 passed`, 0 skipped, 0 retries).

## Gates

| Gate | Resultado |
|---|---|
| Playwright (E2E) | ✅ 17/17 |
| `go vet ./...` | ✅ limpo |
| `go test ./...` | ✅ todos os pacotes |
| `npx tsc --noEmit` | ✅ limpo |
| `npm test` (Vitest) | ✅ 28/28 |
| Firestore rules (`firestore-tests`) | ✅ 53/53 |
| `npm run lint` | 🟡 dívida pré-existente (31 erros + 11 warnings `react-hooks/set-state-in-effect`) — sem novos |

## Segurança

Os testes **não desabilitam** autenticação, autorização, ownership, regras do
Firestore, allowlist de `users` nem qualquer controle existente. O fluxo usa o
Auth Emulator real (idToken emitido via REST) e a API Go valida tokens/roles
normalmente. O `serviceWorkers: "block"` e as liberações de CSP são restritos ao
ambiente de desenvolvimento/teste.

## Limitações / dívidas registradas

- **Corrida de deep-link de papel (pré-existente, fora do escopo):** acessar
  `/admin` ou `/nutritionist` por URL direta pode redirecionar antes de o perfil
  (`role`) carregar, pois o `DashboardLayout` usa `role` default `"student"`
  enquanto `refreshProfile` ainda não respondeu. Os testes contornam via
  navegação client-side. Vale corrigir depois (guard aguardar o perfil antes de
  decidir redirect).
- **Lint frontend:** 31 erros + 11 warnings pré-existentes (retaguarda já
  registrada em `docs/progress.md`), não relacionados a esta fase.

## Commit

Registrado no histórico (mensagem `test: complete phase 3 e2e coverage`), sem
push e sem deploy.
