# Fase 15.1 — Auditoria pré-deploy completa + hardening READ-ONLY

**Data:** 23 set 2026
**Status:** CONCLUÍDA — auditoria completa, todos os gates verdes, relatório emitido.
**Modo:** READ-ONLY (exceto correção de config local do opencode — ver §2). Deploy = 0, Push = 0, produção INALTERADA.

---

## 1. Executive Summary

Auditoria técnica final do app **Treino & Nutrição** (V1 em produção, rebuild V2 em curso)
antes de qualquer passo de deploy. Foram auditadas arquitetura, backend Go, frontend Next.js,
Firestore/Rules/índices, segurança (JWT, roles, ownership, CORS, headers, rate limit, DTOs),
PWA/service worker, testes, performance e preparação de produção (Cloud Run).

**Conclusão:** o projeto está **READY para a próxima etapa de deploy**, com 0 achados de
severidade CRÍTICA/ALTA encontrados na auditoria. Todos os 8 gates executados sequencialmente
passaram sem regressão frente ao HEAD `248e83e`. Não há vulnerabilidade conhecida, endpoint
desprotegido, regra Firestore permissiva, secret exposto ou risco de deploy bloqueante.

Foram registrados 4 achados de severidade BAIXA/INFORMATIVA (riscos residuais já conhecidos e
documentados) e 5 test gaps (oportunidades de cobertura, sem bloqueio).

## 2. Estado atual

- **Inventário:** 41 arquivos Go (backend: handlers/ 10, middleware/ 4, repository/ 2,
  service/ 16, models/, cmd/e2eseed), 92 arquivos TS/TSX (frontend: 12 suítes Vitest em
  `__tests__/`, 7 specs E2E em `e2e/` + `run-inner.mjs`, 21 páginas App Router, 16 layouts,
  lib/ 9, components/ 38, public/ PWA), `firestore.rules`, `firestore.indexes.json`
  (9 índices compostos), 2 Dockerfiles + 1 cloudbuild.yaml, 22 documentos em `docs/`.
- **Stack confirmada:** Next.js 16.3.5 (React 19.2.8, TS 5), Go 1.23, Firestore,
  Firebase Auth (e-mail/senha + Google na V1), PWA, Cloud Run (`southamerica-east1`).
- **Alterações feitas nesta fase (informadas explicitamente):** nenhum arquivo de produção.
  Única alteração local foi na configuração do opencode (`opencode.json` + criação de
  `.opencode/agent-routing.md`) para corrigir a delegação de subagentes, conforme instruído
  pelo usuário **antes** desta auditoria e **preservada** conforme regra absoluta.

## 3. Git

- **Branch:** `main`
- **HEAD:** `248e83e feat: add shared exercise library` (inalterado pela auditoria)
- **Commits recentes:** `3423748 test: cover PWA behavior` → `248e83e feat: add shared
  exercise library`
- **Working tree (auditado):**
  - `M opencode.json` — modificado propositalmente (config de automação); **preservado, não commitado**
  - `?? .opencode/agent-routing.md` — novo, instruções de roteamento; **untracked, não commitado**
  - Nenhum arquivo de produção modificado; nenhum `.env`, segredo, credencial ou
    service account versionado (`git ls-files` só retorna `frontend/.env.example`).
- **Arquivos potencialmente sensíveis:** nenhum encontrado. `.env*` ignorado em `./.gitignore`
  e `frontend/.gitignore` (com exceção do `.env.example`).

## 4. Backend

Arquitetura **handlers → middleware → service → repository → Firestore** confirmada e
aplicada de forma consistente. Nenhuma regra de negócio fora da camada correta.

### Autenticação e autorização (middleware/auth.go)
- `Require` valida ID token Firebase (Admin SDK), injeta uid/role/status/features/provider no
  contexto; perfil ausente = `pending_approval` (nada de negócio libera sem aprovação).
- `Allow` (roles), `RequireApproved` (com bypass admin) e `RequireFeature` (admin/nutricionista
  sempre passam) compostos na ordem correta: `Require(...)` SEMPRE por fora dos gates
  (`main.go`). Causa raiz histórica do 403 (gate antes de popular contexto) não reproduzida.
- JWT: verificação via Admin SDK (`VerifyIDToken`), sem trusting de claims do body;
  `AuthProvider` vem do token verificado, nunca do body.

### Ownership e escalada de privilégio
- `CanAccessStudent`/`CanAccessResource`: admin vê tudo; estudante só a si; nutricionista só
  os próprios alunos. Aplicado em todos os handlers de aluno/treino/dieta(log)/feed/score.
- Nutricionista **nunca** transfere treino/dieta para outro nutricionista via body
  (`UpdateWorkout`/`UpdateDiet` forçam o `NutritionistID` do registro).
- `HandleUpdateStudent`/`HandlePutMe` merge a partir do registro existente preservando
  role/plano/features/vínculo/histórico de aprovação/`createdAt` (mass assignment bloqueado).
- `PUT /api/me` (F13): zera todo campo não editável; `StartDate`/`EndDate` vêm do registro —
  aluno não infla o próprio ranking (vuln da V1 corrigida e coberta por teste).

### Validação, DTOs e erros
- ALLOWLIST de campos de perfil (contract `allowedSelfProfileUpdate`), `sanitizeFeatures`
  (só features conhecidas, sem duplicatas), `serviceError` traduz erros de domínio em HTTP
  (404/400/409/500) sem vazar detalhes internos. Validation de tamanhos (nome/bio/descrição/
  post/comentário/nota). Datas validadas (`validDate` AAAA-MM-DD).

### Concorrência e race conditions
- Feed (likes/comentários/moderação) roda em `RunTransaction` via `UpdatePostTx` — o padrao
  `GetPost→modifica→UpdatePost` foi **removido da interface**. Sem race no feed.
- `createdAt` NUNCA sobrescrito (preserva valor no update; `ServerTimestamp` só na criação) —
  `userProfileData`, `dietLogData`, `UpdateWorkout/UpdateDiet` (MergeAll sem createdAt).
- Paginação do feed por cursor (`<milli>,<id>` + `StartAfter`), histórico por offset/limit
  com `hasMore`; slices nil normalizados para `[]` (`ensureNonNilSlice`).

### Timezone
- `America/Recife` via `service/timezone.go` (`AppLoc`, `Now()`); `time/tzdata` embutido
  (imagem distroless). Nunca `time.Now()` cru para datas de negócio.

### Achados backend
Nenhum achado de severidade CRÍTICA/ALTA/MÉDIA. 1 informativo: rate limit baseado em
`X-Forwarded-For` (primeiro elemento) — risco residual documentado desde a Fase 1
(ver §13).

## 5. Frontend

- **Next.js 16 App Router** (standalone), páginas de aluno/nutricionista/admin/login/perfil/
  ranking/comunidade/dietas/treinos; 12 suítes Vitest + 7 specs Playwright.
- **Auth (`lib/auth.tsx`):** `onAuthStateChanged`, perfil carregado via `GET /api/me`,
  `profileLoaded` evita decisão de redirect com role default "student" (deep-link corrido
  corrigido — guarda aguarda o perfil antes de redirecionar, `DashboardLayout`).
  `needsProfile`/`needsApproval` conduzem ProfileSetup/tela de espera; admin nunca vai para
  a tela de aprovação (precisa da fila). 401 → logout automático (estado consistente);
  falhas transitórias mantêm perfil (sem "piscar" de papel).
- **API client (`lib/api.ts`):** token Bearer em toda chamada, timeout 15s com
  `AbortController`, mapeamento de erros por status (401/403/429/5xx) com mensagem amigável
  e sem expor internos; modo demo (NEXT_PUBLIC_DEMO=1) isolado em localStorage com seed —
  nunca ativado em produção (Dockerfile não o injeta).
- **Firebase (`lib/firebase.ts`):** credenciais via `NEXT_PUBLIC_*` (públicas por natureza
  do Web SDK), Auth Emulator só com flag explícita `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR=1`
  (nunca em produção). Zero `console.log` no código de produção.
- **CSP/headers (`next.config.ts`):** `default-src 'self'`, `script-src` sem `unsafe-eval`
  em produção, `connect-src` restrito (googleapis/firebaseio/*.a.run.app + URL exata da API),
  `frame-ancestors 'none'`, `base-uri`, `form-action`; `img-src 'self' data:`. Origens de
  dev (emuladores/HMR) só fora de produção. Headers `X-Frame-Options DENY`, nosniff,
  `Referrer-Policy`, `Permissions-Policy`.
- **Achados frontend:** nenhum CRÍTICO/ALTO/MÉDIO. Nenhuma chamada API sem auth, nenhum
  secret no bundle, nenhuma URL hardcoded inválida, nenhum vazamento de estado.

## 6. Firestore

### Regras (`firestore.rules`) — 64/64 testes no emulador
- **Escrita de negócio só pela API Go (Admin SDK):** `posts`, `dietLogs`, `workouts`,
  `diets`, `workoutHistory`, `plans`, `scores`, `scores_history`, `exercises` = `write: false`
  para o SDK cliente — inclusive admin (não há `allow write` para admin em nenhuma coleção
  de negócio). `users` delete = `false` (só API Go).
- **Perfil:** dono lê/cria o próprio pendente (`isPendingSelfProfile` — sem campos
  administrativos) e atualiza SÓ a allowlist `name/email/photoURL/bio`
  (`allowedSelfProfileUpdate` com `affectedKeys().hasOnly` — nega update inteiro se qualquer
  outra chave for tocada, até combinações "legítimo + sensível"). Sem escalada por SDK.
- **Leitura:** aprovados (espelho de `IsApproved`: `""`/active/paused + bypass admin);
  dados de aluno visíveis a dono/nutricionista do aluno/admin (`canViewStudentData`);
  feed/plans/scores/exercises a aprovados.
- **Achados Firestore:** nenhum. Regras testadas e consistentes com o middleware Go.

### Índices (`firestore.indexes.json`) — 9 compostos
`posts(userId,type,createdAt↓)`, `dietLogs(studentId,date↓)`, `workouts(nutritionistId,
createdAt↓)`, `workouts(studentId,createdAt↓)`, `diets(nutritionistId,createdAt↓)`,
`diets(studentId,createdAt↓)`, `workoutHistory(studentId,completedAt↓)`,
`workoutHistory(nutritionistId,completedAt↓)`, `workoutHistory(studentId,completedAt↑)`.
Todas as queries do repository (`ListWorkoutsForNutritionist`, `ListHistoryForStudent`,
`FindAutoPostToday`, `ListDietLogsForStudent`, `ListScoreHistory`, etc.) são cobertas;
single-field (`exercises.name`, `users.role`, `users.status`, `users.planID`, `scores`) usam
índice automático. Nenhuma consulta cara ou sem índice encontrada.

## 7. Segurança

| Controle | Status | Evidência |
|---|---|---|
| JWT (Firebase Admin SDK) | ✅ | `middleware/auth.go` `VerifyIDToken`; expiração/assinatura delegadas ao Firebase |
| Roles (admin/nutritionist/student) | ✅ | `Allow`, `RequireApproved`, gates em `main.go` |
| Feature gates | ✅ | `RequireFeature` (plano snapshotado no perfil) + frontend bloqueia módulos |
| Ownership | ✅ | `CanAccessStudent`/`CanAccessResource` em todos os recursos |
| IDOR | ✅ | Nenhum handler acessa recurso por id sem `canAccessResource` (treino/dieta/post/aluno) |
| Mass assignment | ✅ | Merge preserve/adminFields; allowlist /me e /students |
| CORS | ✅ | Sem wildcard; origens exatas + `Vary: Origin`; 403 para origem não permitida; `ALLOWED_ORIGIN=` `*` rejeitado no boot |
| Security Headers | ✅ | Backend (http.go) + frontend (next.config.ts CSP/headers) |
| Rate Limit | ✅ | 120/min/IP prod (600 dev); `RATE_LIMIT=0` + produção = boot falha; `Retry-After` |
| MaxBody | ✅ | 1 MiB (`MaxBytesReader`) |
| Recover | ✅ | Panic → 500 + log sem dados sensíveis |
| Secrets | ✅ | Nada versionado; `.env*` ignorado; Docker/cloudbuild sem secrets |
| Erros/logs | ✅ | Sem detalhes internos ao cliente; panic log só method/path |
| Confidencialidade de dados | ✅ | `Cache-Control: no-store` em `/api/*`; `X-Content-Type-Options: nosniff` |

**Achados de segurança:** 1 INFORMATIVO (rate limit por `X-Forwarded-For` — spoofável por
cliente quando não há proxy confiável; risco documentado, mitigação recomendada: confiar no
header somente atrás do Cloud Run LB, que sobrescreve). Sem CRÍTICO/ALTO/MÉDIO.

## 8. PWA

- **`sw.js`:** precache do shell (/, /login, manifest, ícones); navegação network-first com
  fallback offline; `/_next/static/*` stale-while-revalidate; **`/api/*` nunca cacheado**,
  requests com header `Authorization` nunca interceptadas, métodos não-GET ignorados,
  origens externas (API Cloud Run) fora do SW. `SKIP_WAITING` via mensagem do app (sem
  reload forçado); `clients.claim()` no activate.
- **`manifest.json`:** standalone, ícones any+maskable, screenshots narrow/wide, `lang`,
  `theme_color`/`background_color` coerentes com o design system.
- **Headers (`next.config.ts`):** `sw.js` e `manifest.json` revalidados (`no-cache`),
  ícones `immutable` (1 ano); `Service-Worker-Allowed: /`.
- **E2E PWA real (testes 19–21 das 23):** SW registra + precache, navegação offline serve o
  shell, `/api/*` e requests autenticadas não são cacheadas — confirmado em browser real.
- **Achados PWA:** nenhum. Confirmação explícita da Etapa 7: API e requisições autenticadas
  NÃO são indevidamente cacheadas.

## 9. Testes

### Qualidade avaliada (Etapa 8)
- **Go (147):** integração real sem Firebase em `main_test.go` (chain completa Require→gates→
  handler), fakes de token/perfil; unitários por camada (service, repository com mocks de
  iterator, middleware HTTP com httptest). Cobrem authorization (roles, ownership, features),
  payload-too-long, race (UpdatePostTx), CORS, rate limit, recover, config fail-fast
  (ALLOWED_ORIGIN, RATE_LIMIT), timezone, ranking/score, cycle, allowlists, validation de
  exercícios, public profile sem campos sensíveis.
- **Rules (64):** por perfil (create pendente, update allowlist hasOnly, delete fake), feed,
  dietLogs, workouts/diets/history/plans/exercises/scores (leitura aprovados; escrita negada
  até admin), scores_history (canViewStudentData).
- **Vitest (61):** 12 suítes — auth, api client, guards de rota, dashboards por feature,
  PWA (registro/atualização), exercises, dietas, community, ranking, workouts.
- **E2E (23):** fluxo real com Auth Emulator (idToken via REST) + Firestore Emulator + API Go
  + seed determinístico — login (6), aluno (4), autorização (5), exercícios (1), PWA SW real
  (3), ranking (1), aprovação ponta-a-ponta (1). Não desabilita nenhum controle de segurança.
- **Limitações conhecidas (documentadas, não bloqueantes):** ver §12 Test Gaps e
  limitações da Fase 3 (corrida de deep-link resolvida com `profileLoaded`).

### Gates executados nesta fase (sequenciais, um por vez)

| # | Gate | Resultado |
|---|---|---|
| 1 | `go test ./...` (backend, `-count=1`) | ✅ **147/147** (5 pacotes ok) |
| 2 | `go vet ./...` | ✅ limpo |
| 3 | Firestore rules (`firestore-tests`) | ✅ **64/64** passando (emulador local) |
| 4 | Vitest (`npm test`) | ✅ **61/61** (12 suítes) |
| 5 | Playwright (`npm run test:e2e`) | ✅ **23/23** (2.6m, 0 skipped, 0 retries) |
| 6 | `npx tsc --noEmit` | ✅ limpo |
| 7 | `npm run build` (Next standalone) | ✅ 21 rotas (4 dinâmicas) |
| 8 | `npm run lint` | ✅ **0/0** (exit 0) |

Nota de execução: um Firestore Emulator órfão ocupava a porta 8080 (de sessão E2E anterior);
foi encerrado para o gate 3 e o gate 5 subirem seu próprio ambiente (`emulators:exec`). Nenhum
dado real afetado.

## 10. Performance

Análise estática (sem alterações):
- **N+1:** nenhum loop de repository dentro de outro loop de consulta. Listagens usam
  `Where + OrderBy + Limit` diretos.
- **Queries:** paginação real no feed (cursor) e no histórico (offset/limit); `Limit(200/500/
  1000)` nas listas de histórico; `Limit(1)` em `FindAutoPostToday`; `CountStudentsWithPlan`
  conta com iterator único.
- **Payloads:** exercícios/refeições embutidos no documento (limite 1 MiB — folga grande);
  `MaxBody` 1 MiB; sem upload.
- **Firestore reads:** `GetUserProfile` em rotas que precisam de ownership é o custo
  esperado; `CompleteWorkout` faz reads justificáveis (workout + profile + recompute);
  sem reads redundantes por request.
- **Frontend:** sem chamadas duplicadas de página (API client com timeout e abort);
  `useMemo` onde necessário; imagens `unoptimized` (sem custo de image optimizer no Cloud Run).
- **Memória:** rate limiter com purga (>4096 entradas vencidas); sem goroutine leak (contexto
  com timeout no shutdown; `AbortController` libera fetch).
- **Oportunidades documentadas (sem ação nesta fase):** ranking/histórico poderiam usar
  paginação server-side com cache TTL; `RecomputeScore` recalcula por evento (aceitável no
  volume atual).

## 11. Produção

### Preparação Cloud Run / Firebase
- **Backend Dockerfile:** build `CGO_ENABLED=0` + `-trimpath` + `-ldflags="-s -w"`,
  runtime `distroless/static-debian12:nonroot`, `USER nonroot`, `PORT=8080` — compatível
  com Cloud Run (nonroot obrigatório).
- **Frontend Dockerfile:** multi-stage, `output: standalone`, `NEXT_PUBLIC_*` via build args
  (públicos por natureza; nada de secret), `NODE_ENV=production`; `NEXT_PUBLIC_DEMO`
  deliberadamente fora do build. `cloudbuild.yaml` documenta o comando e o alerta do
  separador de substitutions (vírgula, não `^:^`).
- **Configs de hardening (`config.go`):** fail-fast — `GO_ENV=production` exige
  `ALLOWED_ORIGIN` (sem fallback), nega `*`; `RATE_LIMIT=0` rejeitado em produção.
- **Health/startup/shutdown:** `/health` público; `http.Server` com ReadHeader/Read/Write/
  Idle timeouts; graceful shutdown via SIGTERM (Cloud Run) + fechamento do Firestore.
- **CORS prod:** `ALLOWED_ORIGIN=<domínio exato do front>` obrigatório no boot.
- **Firebase:** credenciais via ADC (metadata server no Cloud Run); nenhum secret em repo.
- **Logs:** padrão do Cloud Run (stdout); log de panic sem dados pessoais; sem logging de
  tokens/corpos.

### Classificação
**READY** — com base nas evidências: todos os gates verdes, Docker/especificação Cloud Run
corretos, hardening de boot ativo, sem achados críticos. (Não é permitido deploy nesta fase;
a classificação é condição técnica para a próxima etapa.)

## 12. Test Gaps

`TEST GAP` (documentados, sem alteração de código — regra da fase):

| Funcionalidade | Risco | Teste recomendado | Prioridade |
|---|---|---|---|
| Rate limit por `X-Forwarded-For` spoofado | 429 contornável/afeta vizinhos | Teste de unidade com XFF forjado + decisão de confiar só atrás do LB | MÉDIA |
| CORS com múltiplas origens (lista `ALLOWED_ORIGIN` com vírgula) | Comportamento de lista não coberto | Teste de unidade `CORS` com 2+ origens e origem negada | BAIXA |
| `Recover` em handler com panic real (panic dentro do serviço) | Graceful 500 não exercitado | Teste de unidade Rota+Recover com handler que faz panic | BAIXA |
| Vazamento de memória do rate limiter (purga >4096) | Crescimento do mapa em longa execução | Teste que insere >4096 IPs e verifica purga | BAIXA |
| Deploy real Cloud Run (smoke de imagem) | Config não validada em runtime real | Smoke test pós-build (imagem local rodando `/health` + CORS prod) | ALTA (pré-deploy) |

## 13. Findings

| Severidade | Área | Arquivo | Evidência | Impacto | Recomendação |
|---|---|---|---|---|---|
| INFORMATIVO | Rate limit | `backend/middleware/http.go` (`clientIP`) | Confia no primeiro elemento de `X-Forwarded-For` | Cliente pode rotacionar IPs e contornar o limite se o proxy não sobrescrever o header | Confirmar que o Cloud Run LB sobrescreve XFF; documentado em Fase 1 como risco residual |
| INFORMATIVO | Frontend | `frontend/lib/firebase.ts` | `googleProvider`/`loginWithGoogle` presentes | Login Google existe na V1; decisão de produto é removê-lo na V2 | Manter até a migração V2 (não é regression) |
| BAIXO | Performance | `backend/service/score.go` `RecomputeScore` | Recalcula nota por evento de conclusão/consumo | Recomputação repetida em picos de uso; volume atual aceitável | Avaliar cálculo diferido (batch) quando o volume crescer |
| BAIXO | Frontend | `frontend/components/` | Debug/ad-hoc ainda possível em dev via `NEXT_PUBLIC_*` | Sem impacto em produção | Manter convenção: `NEXT_PUBLIC_` só para valores públicos |

## 14. Riscos

1. **Deploy em produção só após rodar os passos do checklist** (variáveis, CORS, índices já
   no Firestore, domain mapping). Baixo — mitigado por fail-fast do boot.
2. **Rate limit spoof via XFF** (informado acima). Baixo.
3. **Migração V2** em curso no mesmo repo — risco de conflito de branch; governança atual
   (execução contínua sem push/deploy) cobre isso. Baixo.
4. **F8 (biblioteca de alimentos) bloqueada por decisão de produto** — sem impacto técnico.
5. **Google login descontinuado na V2** — requer remoção coordenada (frontend + rules +
   testes). Baixo.

## 15. Pendências

- [x] Auditoria de backend/frontend/Firestore/segurança/PWA/perf/produção
- [x] 8 gates executados sequencialmente
- [x] Detecção de regressão vs `248e83e`
- [x] Relatório emitido
- [ ] Decidir próximas fases (F5 exercícios concluído; F8 alimentos bloqueado; F13/F14/F15)
- [ ] Após restart do opencode: delegar revisão final de segurança a agente `review`
      (delegação local quebrada durante esta sessão por config em memória — corrigida em disco)

## 16. Checklist pré-deploy

- [x] `go test ./...` 147/147
- [x] `go vet ./...` limpo
- [x] Firestore rules 64/64
- [x] Vitest 61/61
- [x] Playwright 23/23
- [x] `tsc --noEmit` limpo
- [x] `next build` OK (standalone)
- [x] lint 0/0
- [x] Nenhum secret versionado
- [x] Dockerfiles validados (distroless nonroot; standalone)
- [x] CORS/ALLOWED_ORIGIN fail-fast
- [x] Índices Firestore completos (9 compostos)
- [x] Regras Firestore testadas (64)
- [x] PWA testado (SW real, offline, sem cache de /api)
- [ ] (Deploy) definir `ALLOWED_ORIGIN`/`PORT`/`GO_ENV=production` no Cloud Run
- [ ] (Deploy) fornecer `NEXT_PUBLIC_*` no build do frontend (valores públicos)
- [ ] (Deploy) smoke test de `/health` + login real após o deploy
- [ ] (Registro) revisão final de segurança por agente `review` dedicado

## 17. Decisão técnica

**READY** — o projeto possui condições técnicas para seguir para a próxima etapa de deploy:
todos os gates verdes, sem achados CRÍTICOS/ALTOS, regras/índices/containers/configs
alinhados ao Cloud Run e ao Firestore de produção. Nenhum bloqueador técnico conhecido.

## 18. Próximos passos

1. Retaguarda de lint já concluída (histórico); manter governança (sem push/deploy).
2. Registrar este relatório no `docs/progress.md`.
3. Após restart do opencode (config nova em memória), delegar a revisão final de segurança
   à auditoria dedicada (agente `review`), que pode reaproveitar este relatório como base.
4. Decidir em conjunto: F14 (PWA completa / instalável em produção), F15 (produção/deploy)
   — as únicas fases que tocarão o ambiente real — precedidas por este checklist.

---

### F15.1 — RESULTADO

- **Auditoria:** PASS
- **Segurança:** PASS (1 INFORMATIVO)
- **Backend:** PASS
- **Frontend:** PASS
- **Firestore:** PASS
- **PWA:** PASS
- **Testes:** PASS
- **Produção:** INALTERADA
- **Deploy:** 0
- **Push:** 0

### TESTES

| Gate | Resultado |
|---|---|
| `go test ./...` | ✅ 147/147 |
| `go vet ./...` | ✅ limpo |
| Firestore rules | ✅ 64/64 |
| Vitest | ✅ 61/61 |
| Playwright | ✅ 23/23 |
| `tsc --noEmit` | ✅ OK |
| `next build` | ✅ OK |
| lint | ✅ 0/0 |

### FINDINGS

CRÍTICO: 0 | ALTO: 0 | MÉDIO: 0 | BAIXO: 2 | INFORMATIVO: 2 (detalhes em §13)

### TEST GAPS

5 itens documentados (detalhes em §12) — nenhum bloqueante.

### ARQUIVOS ALTERADOS

`PRODUCTION CODE UNCHANGED`

Alterados nesta sessão (config local, fora do código de produção):
- `opencode.json` (modificado — preservado conforme regra; **não commitado**)
- `.opencode/agent-routing.md` (novo — **não commitado**)
- `docs/reports/phase-15-1-pre-deploy-audit.md` (este relatório — novo)

### GIT

- HEAD: `248e83e` (inalterado)
- Working tree: `M opencode.json`, `?? .opencode/agent-routing.md`
- Commits: nenhum criado
- `opencode.json`: **preservado** (não revertido, não editado nesta fase, não commitado)

### RECOMENDAÇÃO

Seguir para a próxima etapa de deploy **sim**, observando os passos marcados como "(Deploy)"
no checklist §16 e realizando a revisão final de segurança dedicada após o restart do
opencode. Sem bloqueadores técnicos conhecidos.