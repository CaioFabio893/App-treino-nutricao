# Progresso — Treino & Nutrição V2

**Fonte da verdade de status.** Atualizar a cada fase concluída/decisão.

---

## Fase atual: 14 + 14.1 + 5 + 15.1 + 15.2 + 15.3 — PWA + Testes PWA + Biblioteca de exercícios + Auditoria pré-deploy + Migration V1→V2 + Fechamento pós-migração

**Status: F14 (auditoria produção) CONCLUÍDA, F14.1 CONCLUÍDA, F5 CONCLUÍDA, F15.1 CONCLUÍDA, F15.2 CONCLUÍDA — MIGRATION V1→V2 EXECUTADA EM PRODUÇÃO (24 set 2026), F15.3 CONCLUÍDA — fechamento pós-migração (auditoria READ-ONLY PASS, migração técnica ENCERRADA).** Backend `go vet`/`go test` **147/147** ✅ ·
Firestore rules **64/64** ✅ · Vitest **61/61** ✅ · Playwright E2E **23/23** ✅ ·
`tsc --noEmit` ✅ · `next build` ✅ · **Lint frontend 0/0** ✅.

- **F14 — Auditoria PWA para produção:** PASS, nenhuma alteração necessária (manifest, service worker, cache, HTTPS via Cloud Run, headers/CSP). Relatório: `docs/reports/phase-14-pwa-production.md`.
- **F14.1 — Testes PWA:** cobertura do service worker (`sw.js` — nunca cacheia
  `/api/*`/`Authorization`), do `PWA.tsx` (registro/update/`SKIP_WAITING`/
  reload) e do `PWAInstall.tsx` (instalação), + E2E de precache/offline/não-cache
  de `/api`. Relatório: `docs/reports/phase-14-1-pwa-tests.md`.
- **F5 — Biblioteca de exercícios**: catálogo GLOBAL (coleção `exercises/{id}`),
  CRUD + busca (client-side) + reutilização em treinos via **snapshot**
  (`WorkoutExercise` embutido — a biblioteca nunca vira referência viva).
  Backend (model/repo/service/handlers/routes/rules) + frontend (tipos, api,
  página `/nutritionist/exercises`, item na sidebar, seletor no `WorkoutForm`).
  Relatório: `docs/reports/phase-5-exercise-library.md`.

**Próximo passo:** F8 (alimentos) segue **bloqueada** por decisão de produto (formato da dieta: texto livre vs estruturado); F15.2 (migração V1→V2) **CONCLUÍDA — produção rodando 100% V2** (API `treino-api-00013-867` + web `treino-web-00009-mfg`, regras Firestore/9 índices publicados, `GO_ENV=production`, CORS com as 2 origens, `RATE_LIMIT=120`, smoke/E2E de produção verdes); F15.3 (fechamento pós-migração) **CONCLUÍDA** — auditoria READ-ONLY PASS (revisões/tráfego corretos, 9/9 índices READY, zero dados de teste, zero processos órfãos, zero builds pendentes), migração técnica ENCERRADA; F14 (auditoria PWA) CONCLUÍDA com PASS sem alterações; **pendências humanas**: validação de produção pela Louise (login real + fluxos), PWA em dispositivo, decisão de produto sobre Google login (código ainda o expõe — ADR-002 não implementado) e F8; **próximo passo recomendado**: decisões de produto (Google + F8) e commit do working tree quando autorizado.

### Fase 14.1 — Testes PWA (23 set 2026)

PWA já implementado transformado em comportamento protegido por testes, **sem
alterar** `sw.js`/`PWA.tsx`/`PWAInstall.tsx`. `sw.js` testado verbatim via
`node:vm`; componentes via RTL; E2E dedicado com `serviceWorkers: "allow"`.
+22 testes Vitest (28→50→…), +3 E2E (19→22).

### Fase 5 — Biblioteca de exercícios (23 set 2026)

Catálogo global `exercises/{id}`. Decisão: **sem ownerId** (compartilhado);
treino guarda **snapshot** (`WorkoutExercise`) — alterar/excluir o exercício da
biblioteca não afeta treinos. Leitura aprovada; escrita só nutricionista/admin
via API Go (rules negam cliente). Modelo `ExerciseItem` (o `Exercise` legado do
modo original permanece intacto). Limites por campo em `service/exercise.go`
(resíduo F13 #2). +27 testes Go (120→147), +11 rules (53→64), +11 Vitest
(50→61), +1 E2E (22→23).

### Fase 14 — PWA em produção (auditoria) (23 set 2026)

Auditoria READ-ONLY do PWA para produção. **Veredito: PASS** — nenhuma alteração necessária. `manifest.json` completo (name, short_name, id, start_url, scope, display standalone, ícones any+maskable, screenshots, lang pt-BR); `sw.js` com precache do shell, network-first com fallback offline, nunca cacheia `/api/*`/`Authorization`/métodos não-GET/origens externas; `SKIP_WAITING` via mensagem + `clients.claim()`; headers PWA em `next.config.ts` (sw.js/manifest no-cache, ícones immutable, CSP sem `unsafe-eval`); HTTPS garantido pelo Cloud Run. Coberto por testes F14.1 (Vitest 22) + E2E (service worker real, offline, não-cache de /api). Relatório: `docs/reports/phase-14-pwa-production.md`.

### Fase 15.1 — Auditoria pré-deploy (23 set 2026)

Auditoria completa READ-ONLY (HEAD `248e83e`, commit `feat: add shared exercise library`). 8 gates sequenciais verdes: `go test ./...` 147/147, `go vet ./...` limpo, Firestore rules 64/64, Vitest 61/61, Playwright E2E 23/23, `tsc --noEmit` limpo, `next build` OK (21 rotas standalone), lint 0/0. Achados: 2 BAIXO + 2 INFORMATIVO (sem CRÍTICO/ALTO/MÉDIO); classificação READY. Produção INALTERADA, deploy 0, push 0, nenhum commit criado. `opencode.json` preservado (não commitado); relatório em `docs/reports/phase-15-1-pre-deploy-audit.md`. A revisão final de segurança dedicada (agente `review`, item §16/§18.3) foi concluída no mesmo dia: PASS, sem regressão, 1 achado novo INFORMATIVO (`ALLOWED_ORIGIN "vazio = todas"` em `frontend/.env.example` — em produção vazio = boot falha; não bloqueante, correção recomendada quando o arquivo for tocado), relatório em `docs/reports/phase-15-1-final-security-review.md`.

### Fase 15.2 — Migration V1→V2 em produção + Preparação de deploy (24 set 2026)

Preparação completa de deploy Cloud Run (projeto `treino-louise`, região `southamerica-east1`) **+ migração autorizada e executada**. Preparação: 8 gates revalidados sequenciais verdes (nota operacional `-p 1` para linker Go; correção de cache Turbopack/E2E) e auditoria do caminho de deploy 100% consistente; correções de doc `.env.example`/`README.md`. **Deploy executado (autorização explícita do dono):** (1) API `treino-api` V2 — build Cloud Build (digest `6789bdbf…`) + deploy revisão `00013-867` com `GO_ENV=production`, `ALLOWED_ORIGIN=https://treino-web-834622951375.southamerica-east1.run.app,https://treino-web-jn4epizxfq-rj.a.run.app`, `RATE_LIMIT=120`; (2) frontend `treino-web` V2 — build Cloud Build com valores reais `NEXT_PUBLIC_FIREBASE_*` extraídos do bundle público de produção (apiKey `[REDACTED]`, authDomain `treino-louise.firebaseapp.com`, projectId `treino-louise`, storageBucket `treino-louise.firebasestorage.app`, senderId `834622951375`, appId `1:834622951375:web:fd5f73b4f2aaefffc38cba`, `NEXT_PUBLIC_API_URL` apontando para a API real) — revisão `00009-mfg`; (3) `firebase deploy --only firestore` — regras V2 64/64 + 9 índices publicados (todos READY). **Smoke/E2E de produção todos verdes:** `/health` 200, CORS 2 origens 200 + origem maliciosa 403, `/api/me` token inválido 401, headers de segurança, CSP correto, manifest/sw.js/PWA servidos, `serviceWorker.register` no bundle, Firestore REST nega leitura/escrita cliente sem Auth (403), cadeia Auth real validada via signUp temporário (RANKING 403 por não-aprovado, `/api/me` cria perfil pending) com cleanup completo (deleteAccount + doc órfão removido, 404 confirmado). URLs finais preservadas: `treino-api-834622951375.southamerica-east1.run.app` e `treino-web-834622951375.southamerica-east1.run.app`. **Produção agora roda 100% V2; V1 sobrescrita (revisões históricas retidas, sem rollback automático).** Sem commit/push (governança). Relatório: `docs/reports/phase-15-2-deploy.md`.

### Fase 15.3 — Fechamento pós-migração (24 set 2026)

Auditoria READ-ONLY pós-deploy + documentação das validações humanas. **Veredito: PASS — migração técnica ENCERRADA.** Re-verificado: API `treino-api-00013-867` e web `treino-web-00009-mfg` (ambas Ready=True, latestRevision, 100% tráfego); env correto (`GO_ENV=production`, `ALLOWED_ORIGIN` 2 origens, `RATE_LIMIT=120`); `/health` 200; Firestore 9/9 índices READY + rules V2 negando cliente; zero dados de teste (Firestore 404 + Auth removido); zero processos órfãos locais (java/node ausentes, portas 8080/9099 livres); zero builds pendentes. Correção de documentação: F15.2 §0.6 relatava que a V2 "não oferece o botão Google" — **incorreto**: o código V2 em produção AINDA expõe o botão e o fluxo Google ativos (`login/page.tsx:99-124`, `auth.tsx:155-162`, `firebase.ts:41`; backend aceita `password|google.com`) — ADR-002 não implementado, classificado INFORMATIVO mantido (F15.1) e decisão de produto pendente (sem bloqueio: usuários V1 Google continuam logando). Documentados: checklist humano de login real/fluxos (A), checklist PWA em dispositivo (B), estado objetivo do Google (C — 3 opções técnicas sem prescrição), F8 mantida bloqueada com decisões pendentes registradas (D), e classificação do Git (E): docs/relatórios a versionar × `opencode.json`/`.opencode/agent-routing.md` (config local, não commitar) × artefatos ignorados (`.next`, `test-results`, `.env.local`). Relatório: `docs/reports/phase-15-3-post-migration.md`.

---

## Fase 13 — Revisão final de segurança, autorização e regressão

**Status: FASE 13 CONCLUÍDA (22 set 2026).** Backend `go vet`/`go test`
120/120 ✅ · Firestore rules 53/53 ✅ · Vitest 28/28 ✅ · Playwright E2E
19/19 ✅ · `tsc --noEmit` ✅ · `next build` ✅ · **Lint frontend 0/0** ✅.
Relatório completo em `docs/reports/phase-13-final-security-regression.md`.

**Correção classe A da F13:** `PUT /api/me` vira ALLOWLIST estrita
(name/email/photoURL/bio) — antes, `startDate`/`endDate`/`authProvider`
enviados no body eram gravados, e como `startDate` alimenta o denominador da
pontuação (`daysElapsedInCycle`), o aluno podia inflar a própria nota no
ranking. `GetOrCreateProfile` agora preserva também `StartDate`/`EndDate`.
Regressão coberta por `TestChainPutMeIsAllowlistBlockingMassAssignment`.
Demais auditorias (auth, ownership, timestamps, timezone, concorrência,
índices, dados públicos, payloads, config de produção) confirmadas íntegras;
resíduos classe C documentados no relatório.

**Próximo passo:** decidir as próximas fases do roadmap (F5 biblioteca de
exercícios / F8 alimentos / F14 PWA / F15 produção) + resíduos do backlog
(status `blocked` vs `paused`, limites por campo aninhado, reativação da regra
de lint na migração RSC/SWR).

### Fase 13 — Revisão final de segurança (22 set 2026)

Revisão sistemática (auth, roles, status, ownership/IDOR, mass assignment,
payloads, timestamps, timezone, concorrência, índices, dados públicos,
frontend, qualidade de testes). Um achado A corrigido (mass assignment em
`PUT /api/me` — allowlist + preservação de datas + AuthProvider do token);
resto confirmado ou documentado como resíduo C. Commit: `security: complete
F13 final security and regression review` (local, sem push/deploy).
`opencode.json` preservado fora do commit.

---

## Fase 3 — Testes E2E (Playwright) [concluída]

**Status: FASE 3 CONCLUÍDA (22 set 2026).** Playwright 17/17 ✅ · Backend
`go vet`/`go test` ✅ · `tsc --noEmit` ✅ · Vitest 28/28 ✅ · Firestore rules
53/53 ✅ · **Lint frontend 0 erros / 0 warnings** (retaguarda concluída 22 set
2026; decisão da regra `set-state-in-effect` registrada abaixo). Relatório
completo em `docs/reports/phase-03-e2e-tests.md`.

**Causa raiz do bloqueio "Carregando.":** Next 16 bloqueava recursos dev de
origem `127.0.0.1` (canônica = `localhost`) → `allowedDevOrigins: ["127.0.0.1"]`
+ CSP dev liberando emuladores locais. **Flakiness adicional:** SW do PWA
(`clients.claim()` → `controllerchange` → reload) → `serviceWorkers: "block"`
no contexto E2E.

**Próximo passo (registro histórico da fase 3):** decidir próximas fases do
roadmap (F5 biblioteca de exercícios / F8 alimentos / F13 revisão / F14 PWA /
F15 produção) + pendências remanescentes do backlog (status `blocked` vs
`paused`, demais correções SDD da Fase 1). O hardening pré-F13 (deep-link,
`time.Now`, tamanho de entrada, perfil público, payloads, docs) está concluído
— ver seção abaixo e `docs/reports/pre-f13-hardening.md`.

### Retaguarda — lint frontend (22 set 2026)

Dívida de lint pré-existente do V1 **resolvida: `npm run lint` passou de
31 erros + 11 warnings para 0/0.** O que foi feito (TDD de verificação:
lint → build → Vitest 28/28):

- **`react-hooks/set-state-in-effect` (25 erros) → regra desligada** em
  `frontend/eslint.config.mjs`, com rationale no próprio arquivo e aqui:
  a regra nova do eslint-config-next 16 marca como erro o padrão legítimo de
  fetch no mount de componentes client deste codebase
  (`useEffect(() => { void load(); }, [load])`, onde `load` é async e só chama
  setState após `await`). A correção estrutural (RSC/SWR) é trabalho das fases
  seguintes — **reativar a regra quando a busca de dados migrar**.
- **`react/no-unescaped-entities` (6 erros) → corrigido de verdade**
  (`&apos;`/`&quot;` em `RestTimer`, `WorkoutForm` e `workouts/page`).
- **`no-unused-vars` (1) → removido** import `WorkoutExercise` não usado.
- **`@next/next/no-img-element` (10 warnings) → componente `Avatar`
  compartilhado** (`components/Avatar.tsx`) com um único disable interno
  documentado (photoURL remota com dimensões desconhecidas; migração para
  `next/image` registrada como trabalho das fases PWA/otimização).

### Hardening pré-F13 — retaguarda de segurança/consistência (22 set 2026)

**Status: CONCLUSO — checkpoints verdes; commit `security: harden app before
final review`.** Corrige os achados levantados antes de abrir a F13 (revisão).
Relatório completo em `docs/reports/pre-f13-hardening.md`.

1. **Corrida de deep-link de papel**: `DashboardLayout` só decide redirect
   depois que o perfil carregou (`profileLoaded` no `AuthProvider`) — admin/
   nutritionist acessando `/admin`/`/nutritionist/*` por URL direta não é mais
   rebatido com o role default "student". Autorização real permanece no backend
   (RequireApproved/Allow). +2 testes E2E de deep-link.
2. **`time.Now()` em dado de negócio**: `postData` escreve `updatedAt` de
   `p.UpdatedAt` (nunca relógio cru no repository); posts passam a ganhar
   `UpdatedAt` na criação (manuais e automáticos) e em toda mutação
   transacional (like, comentário, soft-delete de moderação, despublicação do
   post automático de dieta). Regressão em `repository_test.go`. Único
   `time.Now()` restante: rate limit (relógio técnico, sem fuso de negócio).
3. **Limite de tamanho de entrada por campo**: helper `tooLong` (runas, não
   bytes) + constantes em `service/constants.go`; validação → 400 em posts,
   comentários, perfil (`/api/me`), treinos, dietas, planos, log de dieta,
   conclusão de treino, motivo de recusa e — fechado neste checkpoint — na
   duplicação de treino/dieta (`NewName`) e na edição de aluno (nome/bio).
   `MaxBody` (1 MiB) segue como teto global (middleware).
4. **Perfil público**: `PublicProfile` é DTO mínimo (sem email/status/planos/
   vínculos/histórico de aprovação); regressão
   `TestGetPublicProfileDoesNotExposeSensitiveFields`.
5. **Auditoria de payloads JSON**: decode malformado → 400 em todas as rotas de
   escrita; campos obrigatórios checados (id/role/nome/workoutId/planID/date);
   sem furos além do tamanho (item 3). Alguns counters numéricos sem range-check
   (ex.: duração da conclusão) foram classificados como risco residual aceitável.
6. **Docs de `createdAt`/regras**: `CLAUDE.md` e `docs/architecture/
   firestore-model.md` corrigidos (createdAt preservado em `dietLogData` desde a
   Fase 1; cláusula `UpdatePost` removida já na Fase 1; seção de regras de
   segurança descrita conforme o estado endurecido — escrita de negócio só via
   API Go).

Gates: backend `go vet` + **119 testes** ✅ · Firestore rules **53/53** ✅ ·
Vitest **28/28** ✅ · Playwright E2E **19/19** ✅ · `tsc --noEmit` ✅ ·
`next build` ✅ · lint frontend **0/0** ✅.

### Fase 2 — Vitest/frontend tests (22 set 2026)

- **Setup Vitest concluído**: `vitest.config.mts` (jsdom + RTL +
  vite-tsconfig-paths), `vitest.setup.ts` (matchMedia/ResizeObserver stubs +
  cleanup `localStorage`), deps e scripts `test`/`test:watch` no
  `package.json`. 6 arquivos / **28 testes**.
- **4 falhas corrigidas (todas classificadas TESTE INCORRETO — nenhuma
  mudança de comportamento de produto):**
  - `mealsToText` (2): testes exigiam cabeçalho em MAIÚSCULAS; contrato real =
    preservar nomes do legado + horário no cabeçalho (capitalização é
    apresentação). Testes ajustados; implementação intacta.
  - `EmptyDietState` (1): teste exigia "Ajude o aluno..." (inventado); texto
    real do produto ("Adicione uma refeição ou plano alimentar...") mantido.
  - `StudentDashboard` (1): teste era internamente contraditório (Treinos
    visível E empty state simultâneos). Regra real documentada
    (`docs/security/plans.md`): `workouts` é **sempre liberado** (tier
    gratuito) → empty state inalcançável; ramo mantido como guarda defensiva.
  - **Extra**: `vitest.setup.ts` usava o global `afterEach` sem import →
    `TS2304` no `tsc`/`next build`; corrigido com import explícito de
    `afterEach` (sem mexer em tsconfig/gates).
- **Decisões**: (1) `mealsToText` não normaliza caixa; (2) texto do
  `EmptyDietState` mantido; (3) Treinos = tier gratuito sempre visível;
  (4) import explícito no setup em vez de `types: ["vitest/globals"]`.
- **Gates**: Vitest 28/28 · typecheck ✅ · build ✅ (1 crash transitório
  `3221225477` do worker Next, reexecução passou) · lint 31E/11W só
  pré-existentes (nenhum nos arquivos da Fase 2) · backend `-count=1` ✅.
- **Checkpoint commitado**: hash abaixo no histórico.

Governança desde 20 set 2026: **execução contínua** — commits automáticos em
checkpoints verdes (Conventional Commits), sem push/deploy, sem tocar na V1 em
produção. Decisões técnicas rotineiras não requerem OK; parar apenas para
decisão de produto sem evidência, destruição, credenciais, stack ou
arquitetura fundamental.

### Checkpoint 1 — Integração do working tree V2 existente (20 set 2026)

Alterações não commitadas de sessões anteriores foram auditadas (classificação
A — features V2 válidas, sem segredos), testadas (go test, vet, 53 regras,
build frontend) e commitadas:

- `4c34243` **feat(api): auto-create profile on GET /me and persist free-text
  diet content** — `HandleGetMe` agora cria o cadastro automaticamente como
  `pending_approval` quando o perfil não existe (spec 4.1), preenchendo
  name/email/photoURL do registro do Firebase Auth via `GetOrCreateProfile`
  (preserva role/status — sem auto-promoção; nome ainda é obrigatório antes da
  tela de espera: contrato `needsProfile` mantido). `Diet.Content` (texto
  livre) persistido no Create/Update de dieta. +18 testes de cadeia real.
- `a7a047d` **feat(frontend): student dashboard, ranking view and free-text
  diets** — página `/dashboard` (StudentDashboard), página `/ranking`
  (Ranking), navegação inferior com Início/Ranking + guardas de rota por
  feature (`diet`/`community`/`ranking`; staff pula a guarda), formulário de
  dieta simplificado (texto livre com `mealsToText` convertendo dietas legadas;
  `meals: []` ao salvar — legado vira texto), EmptyDietState, ícones de app,
  demo com features completas no perfil aluno.

**Dívida de lint (registrada e resolvida em 22 set 2026):** `npm run lint`
tinha **31 erros + 11 warnings** pré-existentes do V1 (principalmente
`react-hooks/set-state-in-effect`, regra nova do eslint-config-next 16; o
padrão `void fetch()` em useEffect é usado em todo o codebase). **Resolvido:
0 erros / 0 warnings** — ver seção "Retaguarda — lint frontend" acima. A
regra `set-state-in-effect` foi desligada com rationale (reativar na migração
RSC/SWR); erros de entidades foram corrigidos e avatares migrados para o
componente `Avatar`. O build do Next 16 **não roda ESLint** (só TypeScript) —
build já ficava verde; agora o lint também é gate limpo.

### Fase 1 — Implementação (correções TDD)

Fase 0 aprovada em checkpoint. A Fase 1 começou pelas correções de maior
prioridade (Correção > Segurança > Testabilidade) identificadas na auditoria:
createdAt do diet log, a race condition do feed e o hardening de produção.
Status final: 3.3/3.5 corrigidos no backend (TDD) + Emulator/Security Rules
configurados e testados (53 testes) + Hardening de produção CORS/rate
limit/users allowlist concluído.

### Fase 1 — Hardening de produção: CORS, rate limit e allowlist de users (20 set 2026, TDD Red→Green→Refactor)

**Relatório completo em `docs/reports/phase-01-hardening.md`.**
**Decisão registrada (achado A3): NÃO criar índice `users(role, nutritionistID)`** — o
`ListStudents` (`Where(role)` + `Where(nutritionistID)`) sem `orderBy`/range é
atendido por index-merge; ver seção "Decisão A3 — índice composto" no relatório.

- **CORS estrito (sem mais `*`)**: `ALLOWED_ORIGIN` obrigatório com
  `GO_ENV=production` (boot falha se ausente); `*` rejeitado em qualquer
  ambiente; origem exata → `Access-Control-Allow-Origin` ecoa + `Vary: Origin`;
  origem negada → 403 sem ACAO; sem header `Origin` → passa; lista por vírgula
  (compatível com V1). Dev/test default `http://localhost:3000`.
- **Rate limit com defaults por ambiente + `Retry-After`**: default produção
  120 req/min/IP, dev/test 600; `RATE_LIMIT` explícito sobrescreve; produção
  rejeita `RATE_LIMIT=0`/inválido no boot (nunca mais "off por default");
  429 agora inclui `Retry-After` em segundos.
- **`loadConfig` (`backend/config.go`, novo)**: validação fail-fast no boot;
  `main.go` usa `os.Getenv` + `log.Fatalf` (sem fallback permissivo).
- **`firestore.rules`: users update por allowlist estrita** — substitui
  `sensitiveChanged()` (que não cobria `createdAt`/`authProvider`) por
  `allowedSelfProfileUpdate()` com `affectedKeys().hasOnly(['name','email',
  'photoURL','bio'])`: qualquer outro campo — role, status, planID, features,
  nutritionistID, approvedBy/At, rejectedReason, createdAt, authProvider — nega
  o update inteiro (inclusive combinações "name + role" etc.).
- Tests novos: 10 de config (CORS/RL por ambiente) + 11 de middleware (CORS
  behavior + Retry-After + IPs independentes + XFF) + 18 de regras (allowlist).

### Fase 1 — Firestore Emulator + Security Rules (20 set 2026, TDD Red→Green→Refactor)

**Roteiro completo em `docs/reports/phase-01-security-rules.md`.**

- **`firebase.json`**: bloco `emulators.firestore` (127.0.0.1:8080) adicionado
  (achado A5) — roda com `firebase emulators:exec`.
- **`firestore.rules` endurecido**: bug corrigido em `sensitiveChanged`
  (`fieldChanged()` tolera campo ausente); nova `isApprovedUser()` espelha o
  backend (`""|active|paused` + admin — bloqueados/pendentes fora de recursos
  de negócio); **escrita de dados de negócio = só API Go** (posts, dietLogs,
  plans, scores, scores_history, users update/delete admin via SDK → negado);
  admin mantém leitura administrativa.
- **`firestore-tests/` (novo, achado A14)**: suíte com `@firebase/rules-unit-testing`
  + mocha. **53 testes** (antes 35) cobrindo os cenários exigidos: regressão de
  auto-promote admin (create `users/{uid}` com role/status/plano/features/
  nutritionistID → NEGADO), escalada de privilégio (update → NEGADO), acesso ao
  próprio perfil, dados de terceiros (NEGADO), bloqueado/pendente em recursos
  protegidos (NEGADO), isolamento de nutricionista (NEGADO cross-aluno), operação
  administrativa somente via API Go, e a **allowlist de users** (Fase 1:
  cada campo protegido um a um → NEGADO; legítimos → PERMITIDO; combinações
  legítimo+sensível → NEGADO; documento administrativo completo → NEGADO).
- Red: 14 falhas nas regras antigas (confirmaram os buracos) + 2 novas no
  hardening (`createdAt`, `authProvider` escapavam). Green: 53/53 ✅.

### Fase 1 — o que foi feito (20 set 2026, TDD Red→Green→Refactor)

**Item 3.3 — `PutDietLog` sobrescrevia `createdAt` (achado A1):**
- `repository.dietLogData(log)` extraído e testado: preserva `createdAt`
  quando o log já tem data; usa `firestore.ServerTimestamp` só em log novo
  (mesma regra do `userProfileData`).
- Testes: `TestDietLogDataPreservesCreatedAt`, `TestDietLogDataUsesServerTimestampOnCreate`,
  `TestDietLogDataKeepsOtherFields`.

**Item 3.5 — race condition no feed (curtidas/comentários perdidos):**
- Novo `repository.UpdatePostTx(ctx, id, mutate)` — leitura + mutação + escrita
  dentro de `RunTransaction`. O padrão antigo `GetPost → modifica → UpdatePost`
  foi **removido** da interface (impossível voltar a usar sem transação).
- `postData(p)` extraído (mapa de escrita único, testado com likes/comments/
  moderação preservados) e compartilhado entre as escritas do post.
- `handlers.HandleToggleLike`, `HandleAddComment`, `HandleDeleteComment`,
  `HandleDeletePost` (soft-delete) e a remoção do post automático de
  `HandleUpsertDietLog` agora rodam dentro da transação.
- Erros sentinela: `repository.ErrPostNotFound` / `repository.ErrCommentNotFound`
  + `errForbidden` no handlers → HTTP 404/403/500 corretos.
- Bônus (item 3.6): trocas de `time.Now()` cru por `service.Now()` (America/Recife)
  nos pontos tocados do feed.
- Testes de integração da cadeia real (`main_test.go`): like/unlike, like em
  post inexistente (404), comentário (200 + vazio 400), remoção de comentário
  próprio (204 real), alheio por aluno (403), soft delete por nutri (204 com
  auditoria), remoção/moderacão de post (204) e aluno sem permissão (403).

### Cobertura de testes

- Backend: **119 testes** — `go test ./...` ✅ · `go vet ./...` limpo ✅
- Frontend: **28 testes (Vitest)** ✅ — `npm test` (6 arquivos: StudentDietPage,
  Ranking, StudentDashboard, mealsToText, EmptyDietState, auth-demo).
- Firestore Emulator: **53 testes de regras** ✅
  (`cd firestore-tests && npm test`)
- E2E (Playwright): **19 testes** ✅ — `npm run test:e2e` (auth, aluno,
  autorização, ranking, aprovação, deep-link de papel).

### Próximos passos (Fase 3+)

- [x] Configurar Firestore Emulator + testes de regras (seção 25 do plano).
- [x] Hardening de produção: ALLOWED_ORIGIN obrigatório, rate limit default,
      allowlist de users (relatório `phase-01-hardening.md`).
- [x] Decisão do achado A3: NÃO criar `users(role, nutritionistID)` (index-merge).
- [x] Integrar e commitar o working tree V2 existente (dashboard/ranking/dietas
      texto/auto-create /api/me).
- [x] **[Fase 2]** Frontend: setup Vitest e primeiros testes (28/28 verdes;
      relatório `phase-02-frontend-tests.md`).
- [x] **[Fase 3]** Frontend: Playwright (E2E) — login, aprovação, conclusão de
      treino (fluxos críticos). 17/17 verdes; relatório `phase-03-e2e-tests.md`.
- [x] Retaguarda: limpar dívida de lint do frontend (31E+11W → **0/0**, 22 set
      2026). Decisão: regra `react-hooks/set-state-in-effect` desligada (falso
      positivo no padrão de fetch no mount; reativar na migração RSC/SWR);
      entidades corrigidas; `Avatar` compartilhado para avatares.
- [x] Corrigir corrida de deep-link de papel (guard `DashboardLayout` decide
      redirect com `role` default "student" antes do perfil carregar — corrigido
      no hardening pré-F13 via `profileLoaded`; ver seção acima).
- [ ] Harmonizar pergunta em aberto do status `blocked` vs `paused/inactive`
      (achado A10 — regras já negam status fora da whitelist).
- [ ] Seguir com as demais correções/implementações do SDD da Fase 1.

---

## Fase 0 — Análise e planejamento (concluída)

**Status: DOCUMENTAÇÃO CONCLUÍDA — CHECKPOINT APROVADO (20 set 2026).**

### Entregáveis da Fase 0 (seção 48 do plano)

- [x] `CLAUDE.md` — contexto de governança e pontos de atenção
- [x] `docs/architecture/technology-decision.md` — decisão Go+Next+Firestore
- [x] `docs/architecture/system-architecture.md` — camadas e fluxo
- [x] `docs/architecture/firestore-model.md` — coleções, índices, regras
- [x] `docs/design/design-system.md` — tokens e componentes
- [x] `docs/api/api.md` — contrato profissional (base nas rotas V1)
- [x] `docs/security/plans.md` — planos, papéis, status, permissões
- [x] `docs/reports/phase-00-analysis.md` — auditoria da V1 (seção 3)
- [x] `docs/decisions/ADR-001-stack.md`
- [x] `docs/decisions/ADR-002-auth-email-senha.md`
- [x] `docs/decisions/ADR-003-timezone-createdat.md`
- [x] `docs/progress.md` (este)

### Verificação da seção 3 (contra o código real — relatório completo em
`docs/reports/phase-00-analysis.md`)

| Item | Problema da seção 3 | Status no código atual |
|---|---|---|
| 3.1 | Criação de usuário insegura | ✅ Corrigido (pending_approval + isPendingSelfProfile) |
| 3.2 | Índices compostos faltando | ✅ Corrigido (9 índices; ⚠ ausente users(role,nutritionistID) — ver achado A3) |
| 3.3 | createdAt sobrescrito | ✅ Corrigido na Fase 1 (dietLogData preserva createdAt; `UpdatePost` removido) |
| 3.4 | Reatribuição de ownership | ✅ Corrigido (nutri não transfere; admin pode) |
| 3.5 | Race condition no feed | ✅ Corrigido na Fase 1 (UpdatePostTx + transações no feed) |
| 3.6 | Timezone não-oficial | ✅ Corrigido (America/Recife; `service.Now()` no feed) |
| 3.7 | Falta de testes | 🟡 Backend 91 testes ✅ · Frontend 0 ❌ · Emulator 35 testes de regras ✅ |

### Decisões tomadas (Fase 0)

1. **Stack**: manter Go + Next.js + Firestore + Firebase Auth (ADR-001).
2. **Auth**: e-mail/senha apenas; remover Google (ADR-002).
3. **Timezone/datas**: America/Recife; createdAt imutável (ADR-003).
4. **Prioridades** (aplicar em toda implementação): Correção > Segurança >
   Testabilidade > Manutenibilidade > Simplicidade > Performance > Velocidade.
5. **TDD obrigatório**: Go (Red→Green→Refactor) + Vitest/Playwright no front
   + regras Firestore testadas com Emulator.
6. **Não commitar/pushar sem autorização**. Working tree atual (commits + não
   commitados) é o ponto de partida do V2.

### Riscos conhecidos

- Frontend sem testes hoje → risco alto na Fase 1 (mitigar cedo: setup Vitest/
  Playwright primeiro).
- Race condition no feed (3.5) → perder likes/comentários em concorrência.
- Índices não versionados podem quebrar produção com 500
  (`FAILED_PRECONDITION: requires index` — já houve com dietLogs).
- Hardening de produção (CORS `*`, rate limit off por default).
- Working tree tem mudanças não commitadas de sessões anteriores (não
  descartar; não commitá-las sem OK).

### Próximos passos

- [ ] **Checkpoint Fase 0**: revisar docs acima com o dono do projeto e
      validar recomendações em aberto (status `blocked` vs `paused/inactive`,
      plano vazio default, etc. — ver `docs/security/plans.md` "Perguntas em
      aberto").
- [ ] APÓS OK: iniciar Fase 1 (definir escopo/SDD no `docs/sdd/` e
      implementação TDD camada por camada). Nada é implementado antes do OK.

---

## Histórico

| Data | Fase | O que aconteceu |
|---|---|---|
| 20 set 2026 | 0 | Auditoria completa da V1 (seção 3 + achados); decisões e documentos da Fase 0 criados; checkpoint construído |
| 20 set 2026 | 1 | Checkpoint aprovado; correções TDD de 3.3 (dietLogData createdAt) e 3.5 (UpdatePostTx no feed); 91 testes backend |
| 20 set 2026 | 1 | Firestore Emulator configurado + rules endurecidas + 35 testes de regras (8 cenários + regressão admin); relatório phase-01-security-rules |
| 20 set 2026 | 1 | Hardening de produção: CORS estrito (ALLOWED_ORIGIN obrigatório, sem `*`), rate limit com defaults + Retry-After, users update por allowlist (createdAt/authProvider fechados); decisão A3 (sem índice composto users); 112 testes backend + 53 regras |
| 20 set 2026 | 2 | Working tree V2 integrado e commitado: auto-create /api/me + dieta texto (API) e dashboard/ranking/dietas texto (frontend); gates verdes; dívida de lint registrada |
| 22 set 2026 | 2 | Fase 2 (Vitest) concluída: 28/28 testes frontend verdes; 4 falhas classificadas TESTE INCORRETO e corrigidas sem mudar produto; fix TS2304 no vitest.setup.ts; build/typecheck/backend verdes; relatório phase-02-frontend-tests |
| 22 set 2026 | 3 | Fase 3 (Playwright E2E) concluída: 17/17 verdes; causa raiz do "Carregando." (allowedDevOrigins do Next 16 + CSP dev) e da flakiness (SW clients.claim → reload → serviceWorkers:block); relatório phase-03-e2e-tests |
| 22 set 2026 | 3→F13 | **Hardening pré-F13**: corrida de deep-link de papel corrigida (`profileLoaded`), `updatedAt` sem `time.Now()` cru (posts + mutações transacionais), limites de tamanho por campo (`tooLong`/constantes), DTO `PublicProfile` testado, auditoria de payloads, docs de createdAt/regras sincronizadas; gates backend 119 / rules 53 / Vitest 28 / E2E 19 + lint 0/0; relatório pre-f13-hardening |
| 22 set 2026 | 13 | **F13 concluída** (revisão final de segurança): mass assignment em `PUT /api/me` neutralizado por allowlist + `GetOrCreateProfile` preserva `StartDate`/`EndDate`; gates backend 120 / rules 53 / Vitest 28 / E2E 19 + lint 0/0; relatório phase-13-final-security-regression |
| 23 set 2026 | 14.1 | **F14.1 (testes PWA)**: SW testado verbatim (`node:vm`), `PWA.tsx`/`PWAInstall.tsx` via RTL, E2E de precache/offline/não-cache de `/api`; +22 Vitest (28→50), +3 E2E (19→22); relatório phase-14-1-pwa-tests |
| 23 set 2026 | 5 | **F5 (biblioteca de exercícios)**: catálogo global `exercises/{id}` + CRUD/busca + snapshot no treino; backend (model/repo/service/handlers/routes/rules) + frontend (página/sidebar/seletor); +27 Go (120→147), +11 rules (53→64), +11 Vitest (50→61), +1 E2E (22→23); relatório phase-5-exercise-library |
| 23 set 2026 | 15.1 | **F15.1 (auditoria pré-deploy)**: auditoria completa READ-ONLY, 8 gates verdes (147/147, 64/64, 61/61, 23/23, tsc, build, lint 0/0), achados 2 baixos + 2 informativos, classificação READY, produção inalterada, `opencode.json` preservado; relatório phase-15-1-pre-deploy-audit |
| 23 set 2026 | 14 | **F14 (auditoria PWA em produção)**: PASS, nenhuma alteração necessária — manifest, service worker, cache, HTTPS via Cloud Run, headers/CSP; relatório phase-14-pwa-production |
| 23 set 2026 | 15.2 | **F15.2 (preparação de deploy)**: 8 gates revalidados, auditoria do caminho de deploy 100% consistente, docs corrigidas (.env.example, README), inventário real confirmado; relatório phase-15-2-deploy |
| 24 set 2026 | 15.2 | **F15.2 (MIGRATION V1→V2 EM PRODUÇÃO — executada)**: autorização explícita do dono; API V2 (revisão 00013-867) + frontend V2 (00009-mfg) + regras Firestore/9 índices publicados (64/64); `GO_ENV=production`, CORS 2 origens, `RATE_LIMIT=120`; smoke/E2E de produção verdes (/health, CORS, auth 401, 403 não-aprovado, Firestore 403, PWA, CSP); valores públicos `NEXT_PUBLIC_FIREBASE_*` reais extraídos do bundle de produção; cleanup completo de usuário temporário de teste; URLs finais preservadas; produção 100% V2; sem commit/push |
| 24 set 2026 | 15.3 | **F15.3 (fechamento pós-migração)**: auditoria READ-ONLY PASS — revisões/tráfego V2 corretos, 9/9 índices READY, zero dados de teste, zero processos órfãos, zero builds pendentes; migração técnica ENCERRADA; documentados checklists de validação humana (login real, PWA), estado real do Google login (código ainda o expõe; ADR-002 pendente) e F8 bloqueada com decisões registradas; Git classificado (docs a versionar × config local); relatório phase-15-3-post-migration |