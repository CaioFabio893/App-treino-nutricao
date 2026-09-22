# Progresso — Treino & Nutrição V2

**Fonte da verdade de status.** Atualizar a cada fase concluída/decisão.

---

## Fase atual: 3 — Testes E2E (Playwright)

**Status: FASE 3 CONCLUÍDA (22 set 2026).** Playwright 17/17 ✅ · Backend
`go vet`/`go test` ✅ · `tsc --noEmit` ✅ · Vitest 28/28 ✅ · Firestore rules
53/53 ✅ · Lint só dívida pré-existente (31+11). Relatório completo em
`docs/reports/phase-03-e2e-tests.md`.

**Causa raiz do bloqueio "Carregando.":** Next 16 bloqueava recursos dev de
origem `127.0.0.1` (canônica = `localhost`) → `allowedDevOrigins: ["127.0.0.1"]`
+ CSP dev liberando emuladores locais. **Flakiness adicional:** SW do PWA
(`clients.claim()` → `controllerchange` → reload) → `serviceWorkers: "block"`
no contexto E2E.

**Próximo passo:** retaguarda de lint (31E+11W) + decidir próximas fases do
roadmap (F5 biblioteca de exercícios / F8 alimentos / F13 revisão / F14 PWA /
F15 produção).

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

**Dívida conhecida registrada:** `npm run lint` tem **31 erros + 11 warnings**
pré-existentes do V1 (principalmente `react-hooks/set-state-in-effect`, regra
nova do eslint-config-next 16; o padrão `void fetch()` em useEffect é usado em
todo o codebase). O build do Next 16 **não roda ESLint** (só TypeScript) —
build fica verde. Limpeza de lint entra como tarefa de retaguarda (não
bloquear features; evitar novos erros no código novo).

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

- Backend: **112+ testes** — `go test ./...` ✅ · `go vet ./...` limpo ✅
- Frontend: **28 testes (Vitest)** ✅ — `npm test` (6 arquivos: StudentDietPage,
  Ranking, StudentDashboard, mealsToText, EmptyDietState, auth-demo).
- Firestore Emulator: **53 testes de regras** ✅
  (`cd firestore-tests && npm test`)
- E2E (Playwright): **17 testes** ✅ — `npm run test:e2e` (auth, aluno,
  autorização, ranking, aprovação).

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
- [ ] Retaguarda: limpar dívida de lint do frontend (31 erros + 11 warnings
      `set-state-in-effect`/`no-img-element` pré-existentes).
- [ ] Corrigir corrida de deep-link de papel (guard `DashboardLayout` decide
      redirect com `role` default "student" antes do perfil carregar — registrado
      no relatório da Fase 3).
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