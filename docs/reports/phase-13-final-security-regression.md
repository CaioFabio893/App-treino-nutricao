# Fase 13 — Revisão final de segurança, autorização e regressão

**Data:** 22 set 2026
**Status:** CONCLUÍDA — todos os checkpoints verdes; commit
`security: complete F13 final security and regression review` (local, sem
push/deploy). Nenhuma feature das fases futuras (F5/F8/F14/F15/F16) foi tocada.

---

## 1. Status

Revisão sistemática do modelo de **autenticação, autorização, dados de negócio
e regressão** do backend Go + regras Firestore + frontend, classificando cada
achado como **A** (corrigir agora), **B** (corrigir se pequeno) ou **C**
(aceitar/documentar). Fechou **1 achado classe A** (mass assignment no
`PUT /api/me`); todo o restante auditado foi confirmado íntegro ou registrado
como resíduo documentado. `opencode.json` deliberadamente preservado fora do
commit (mudança de modelo — não deve entrar no histórico do app).

## 2. Baseline

| Gate | Baseline (pré-F13) | Pós-F13 |
|---|---|---|
| Backend `go test ./...` | 119 | **120** ✅ |
| Backend `go vet ./...` | limpo | limpo ✅ |
| Firestore rules (Emulator) | 53/53 | **53/53** ✅ |
| Vitest | 28/28 | **28/28** ✅ |
| Playwright E2E | 19/19 | **19/19** ✅ |
| `tsc --noEmit` | ✅ | ✅ |
| `next build` | ✅ | ✅ |
| Lint frontend | 0/0 | **0/0** ✅ |

## 3. Achados e correções

### A1 — Mass assignment em `PUT /api/me` (CORRIGIDO)

**Problema.**
`HandlePutMe` decodifica `models.UserProfile` inteiro do body e só zerava
`Role`/`Status`/`PlanID`/`Features`. O `GetOrCreateProfile` preserva os campos
administrativos do registro (`nutritionistID`, `approvedBy`, ...) mas **não**
`StartDate`/`EndDate` — e o handler também não os limpava. Os dois campos —
muito menos `AuthProvider` — chegavam ao Firestore vindos do body:

- `startDate` alimenta o **denominador da pontuação**
  (`daysElapsedInCycle(cycleStart, userStart, today)` em `RecomputeScore`): um
  aluno podia enviar uma data recente e **inflar a própria nota do ranking**.
- `endDate` era sobrescrito com qualquer valor do body.
- `authProvider` era aceito do body (spoofing "google.com" em metadado de
  login).

O frontend real nunca envia esses campos no `PUT /api/me` (`putMe` manda só
`{id, name, email, role, status}` no ProfileSetup e `nutritionistID` do próprio
perfil na página do nutri) — a correção é retrocompatível.

**Correção (backend).**
- `handlers/nutrition.go` → `HandlePutMe`: **allowlist estrita** — único
  efeito do body é `name`/`email`/`photoURL`/`bio`. Todos os demais campos são
  zerados no struct (`Role`, `Status`, `PlanID`, `Features`, `NutritionistID`,
  `StartDate`, `EndDate`, `ApprovedBy`, `ApprovedAt`, `RejectedReason`,
  `CreatedAt`) e `AuthProvider` passa a vir **sempre do ID token verificado**
  (`middleware.AuthProviderFrom`), nunca do body. Contrato idêntico ao
  `allowedSelfProfileUpdate` das regras Firestore (só `name`/`email`/
  `photoURL`/`bio`).
- `service/profile.go` → `GetOrCreateProfile`: passa a preservar também
  `StartDate`/`EndDate` do registro existente (campos de decisão
  administrativa — fluxo `HandleUpdateStudent`/aprovação). `GetOrCreateProfile`
  só é usado por GET/PUT `/api/me`; fluxos admin escrevem via
  `PutUserProfile` direto — sem efeito colateral.

**Teste (Red → Green):** `TestChainPutMeIsAllowlistBlockingMassAssignment`
(backend, package main — cadeia real de rotas/fakes). Na versão anterior ao
fix o teste falhava em `startDate`/`endDate`/`authProvider` envenenados; depois
do fix, verificam-se também `role`/`status`/`planID`/`features`/
`nutritionistID`/`approvedBy`/`approvedAt`/`rejectedReason`/`createdAt`
preservados e `name`/`email` editáveis.

## 4. Auditorias confirmadas (sem mudança de código)

- **Cadeia de auth/middleware**: `Require` popular o contexto (uid/role/status/
  features/provider do ID token real) e roda ANTES de `Allow`/
  `RequireApproved`/`RequireFeature` — ordem correta em todas as rotas de
  `main.go`. Sem token → 401; pendente/rejeitado → 403 nas rotas de negócio;
  admin passa independente do status; bypass de feature para admin — coberto
  pelos testes de cadeia (Fase 1) e E2E.
- **Sem token demo no backend**: `middleware/auth.go` verifica ID token via
  `VerifyIDToken` — não existe caminho "demo:" no backend. O modo demo é
  **frontend-only** (`lib/api.ts` + `lib/auth.tsx`, `NEXT_PUBLIC_DEMO=1`);
  `playwright.config.ts` força `NEXT_PUBLIC_DEMO: ""` + API local → o E2E
  exercita a cadeia real (idToken real do emulador de auth), sem falso
  positivo de mock.
- **createdAt nunca sobrescrito**: creates (`CreateWorkout`, `CreateDiet`,
  `CreateUser`/criação de perfil, `dietLogData`, `postData`) sempre usam
  `firestore.ServerTimestamp`; updates (`userProfileData`, `dietLogData`,
  `UpdateWorkout`/`UpdateDiet` com `Set(..., MergeAll)` sem createdAt) não
  tocam o campo. Confirmado por testes de regressão existentes.
- **Ownership imutável**: treino/dieta nunca são transferidos de nutricionista
  via body (`HandleUpdateWorkout`/`HandleUpdateDiet`/`HandleDuplicate*`) —
  backend sobrescreve `NutritionistID` com o do registro. `HandleUpdateStudent`
  e `HandleUpsertDietLog` passam por `CanAccessStudent` (nutricionista só em
  alunos vinculados); `HandleCompleteWorkout` exige `uid == StudentID`
  (admin bypassa). `GET /api/students` escopado por nutricionista, admin usa
  `ListStudentsAll` — testes de cadeia dedicados.
- **Payloads/validação**: decode malformado → 400 em todas as rotas de
  escrita; campos obrigatórios checados; `tooLong` (runas, constante por
  campo) cobre posts, comentários, perfil `/me`, treinos, dietas, planos, log
  de dieta, conclusão, motivo de recusa, duplicação (`newName`) e edição de
  aluno — conjunto completo, com testes de cadeia para cada classe.
- **Timezone**: negócio sempre via `service.Now()`/`AppLoc`
  (`America/Recife`); único `time.Now()` restante é o rate limit (relógio
  técnico, documentado).
- **Concorrência**: like/comentário/remoção/moderação de post rodam em
  transação (`UpdatePostTx`; `UpdatePost` fora da interface — impossível
  voltar ao padrão read→write sem transação).
- **Dados públicos**: `PublicProfile` é DTO mínimo (sem email/status/plano/
  vínculos/histórico/datas) — regressão `TestGetPublicProfileDoesNotExposeSensitiveFields`;
  ranking público (topo com nome/foto/score e próprios pontos) é recurso
  intencional do produto.
- **Config de produção**: `GO_ENV=production` exige `ALLOWED_ORIGIN` (nunca
  `*`) e rejeita `RATE_LIMIT=0`; fora de produção, defaults
  `http://localhost:3000` / 600 req/min/IP. CORS estrito no middleware.
- **Segredos/gitignore**: `frontend/.gitignore` cobre `.env*` (com
  `!.env.example`); `.env.local` e `firestore-debug.log` continuam untracked/
  ignorados. Nenhuma credencial no working tree.
- **Índices Firestore**: `firestore.indexes.json` (9 compostos) cobre todas
  as queries com `OrderBy`/`where` compostos. `ListPosts` (feed) usa
  `OrderBy(createdAt DESC)` + cursor por documento; o `__name__` implícito do
  `orderBy` de campo único é servido pelo **índice automático** do Firestore
  (documentação oficial: `ORDER BY a DESC` ⇒ `a DESC, __name__ DESC`) — **não
  é necessário** composite manual. Verificado contra a documentação de
  índices/OrderBy; emulador e produção comportam-se igual aqui.

## 5. Testes

- **+1 teste de cadeia** (`backend/main_test.go`):
  `TestChainPutMeIsAllowlistBlockingMassAssignment` — falha se qualquer campo
  administrativo enviado no body do `/api/me` for gravado.
- Total backend: **120** (Red → Green → Refactor; nenhum teste removido ou
  reduzido).
- Gates completos verdes: ver seção 2.

## 6. Segurança

- Mass assignment em endpoint de cadastro neutralizado por allowlist explícita
  no handler + preservação das datas no service — o cliente **nunca** define
  papel, status, plano, features, vínculo, datas ou histórico.
- `AuthProvider` deixa de ser influenciável por body (vem do ID token).
- Nenhuma nova superfície de ataque introduzida; contrato de edges (`401/403/
  400/404`) inalterado — evidenciado pelo E2E completo.

## 7. Resíduos aceitos (classe C, documentados)

- **Counters sem range-check** (`CompleteWorkoutRequest.duration/exercises`):
  display-only — o score deriva exclusivamente de `completedAt`, não dos
  counters.
- **Campos aninhados sem limite por campo** (exercícios de treino, refeições/
  itens de `MealCheck`): teto global `MaxBody` (1 MiB) cobre; limites
  granulares são candidatos a regra única quando F5/F8 estruturar bibliotecas.
- **Race do auto-post dedup** (`FindAutoPostToday` → `CreatePost` read→create
  não transacional): risco apenas de duplicidade cosmética de post automático;
  post nunca é criado sem autorização.
- **`from`/`to` do `GET /api/diet-logs` sem validação de formato**: escopo
  (CanAccessStudent) intacto; datas inválidas devolvem lista vazia.
- **Status `blocked` vs `paused`/`inactive`**: pergunta de produto em aberto
  (regras continuam negando status fora da whitelist).
- **`react-hooks/set-state-in-effect` desligada** no lint: dívida registrada na
  Fase 3; reativar na migração RSC/SWR de busca de dados.

## 8. Documentação

- `docs/reports/phase-13-final-security-regression.md` (este arquivo).
- `docs/progress.md`: fase atual = F13 concluída + contagens + resumo.
- `CLAUDE.md`: regra permanente nova — allowlist do `PUT /api/me` equiparada
  ao `allowedSelfProfileUpdate` das regras (item 10 ampliado).

## 9. Git

- `git status`: apenas os arquivos da F13 modificados; `opencode.json` fora do
  commit (mudança deliberada de modelo).
- Commit local: `security: complete F13 final security and regression review`
  (sem push, sem deploy — mantém execução contínua da governança).

## 10. Próximo passo

Decidir as próximas fases do roadmap com evidências em mãos: **F5** (biblioteca
de exercícios), **F8** (alimentos), **F14** (PWA), **F15** (produção) + resíduos
do backlog (status `blocked` vs `paused`, limites por campo aninhado,
reativação da regra de lint).