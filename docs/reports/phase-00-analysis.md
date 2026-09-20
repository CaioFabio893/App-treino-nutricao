# Relatório da Fase 0 — Auditoria da V1

Data: 20 set 2026.
Escopo: verificação da seção 3 do plano ("problemas a corrigir na V2") contra
o **código real atual** do repositório (V1 em produção, working tree local),
mais levantamento complementar que embasa as decisões do V2.

Metodologia: leitura direta do código (`backend/`, `frontend/`,
`firestore.rules`, `firestore.indexes.json`, `firebase.json`, `README.md`) e
contagem de testes (`grep "func Test"`). Nenhum código foi alterado nesta fase.

---

## 1. Verificação da seção 3 — status real

Legenda: ✅ corrigido na V1 atual · 🟡 parcialmente corrigido · ❌ ainda presente.

### 3.1 — Criação de usuário insegura (auto-declarar admin) → ✅ CORRIGIDO

Na V1 atual a criação de perfil pelo cliente é **restrita**:
- `firestore.rules` `isPendingSelfProfile()` exige `status ==
  "pending_approval"` e **bloqueia as keys** `role`, `planID`, `features`,
  `nutritionistID`, `approvedBy`, `approvedAt`, `rejectedReason` no create.
- `service/profile.go` `GetOrCreateProfile` cria perfil novo **sempre** como
  `pending_approval` com role vazio; preserva campos administrativos no update.
- `handlers/nutrition.go` `HandlePutMe` zera `Role/Status/PlanID/Features` do
  body (não deixa o próprio aluno se promover).
- `HandleGetMe` **cria** o perfil automaticamente (pending) na primeira visita
  — excelente: qualquer conta recém-criada no Firebase Auth já aparece na fila
  de aprovação (teste `TestChainGetMeCreatesPendingProfile`).

### 3.2 — Índices compostos faltando → ✅ CORRIGIDO

- `firestore.indexes.json` declara **9 índices compostos** cobrindo todas as
  queries com OrderBy/Where combinada (`workouts`, `diets`, `workoutHistory`,
  `posts`, `dietLogs`).
- Queries do `repository.go` conferem com os índices (workouts/diets por
  nutritionist|student + createdAt; workoutHistory por student|nutritionist +
  completedAt; posts por userId+type+createdAt; dietLogs por studentId+date).
- 📌 **Achado**: `ListStudents` usa `Where(role) + Where(nutritionistID)`
  sem OrderBy; **não há índice versionado `users(role ASC, nutritionistID
  ASC)`** no arquivo. Como `/api/students` funciona em produção, o índice deve
  ter sido criado manualmente no console (igual ao de dietLogs, que o README
  documenta via `gcloud firestore indexes composite create`). Isso reforça a
  exigência do V2: **índices versionados + testados com Emulator**.

### 3.3 — createdAt sobrescrito em update → 🟡 PARCIALMENTE CORRIGIDO

- `repository.go` `userProfileData` **preserva `CreatedAt`** quando != zero e
  usa `ServerTimestamp` só na criação; `TestUserProfileDataPreservesCreatedAt`
  protege o comportamento.
- `GetOrCreateProfile` e `HandleUpdateUser` repassam `existing.CreatedAt`.
- ✅ Coberto para **perfis** e para o fluxo principal.
- ❌ **Persistência ainda pode sobrescrever** se um chamador passar
  `CreatedAt` zero num update (depende do caller respeitar o contrato);
  🟡 **`PutDietLog` regrava `createdAt: firestore.ServerTimestamp` a cada
  save** — sobrescreve a data de criação original do log (achado adicional,
  mesmo bug da seção 3.3 aplicado a dietLogs). **Corrigir no V2.**

### 3.4 — Reatribuição de ownership → ✅ CORRIGIDO (com ressalva)

- `HandleUpdateWorkout`/`HandleUpdateDiet`: nutricionista **sempre** recebe
  `NutritionistID = existing.NutritionistID` (não transfere via body); admin
  pode mudar no body (mecanismo de transferência administrativa, documentado).
- Rotas de escrita (PUT workouts/diets) restritas a nutricionista|admin.
- Testes: `TestChainNutritionistCannotTransferWorkout`,
  `TestChainNutritionistCannotTransferDiet`, `TestChainAdminPreserves...`.
- ✅ Correto para o risco citado; `CanAccessResource` é função pura testada
  (`service_test.go: TestCanAccessResource`).

### 3.5 — Race condition no feed (curtidas/comentários) → ❌ AINDA PRESENTE

- `repository.go` `UpdatePost` = `GetPost` → modifica → `Set(MergeAll)` —
  **read-modify-write sem `RunTransaction`**; NENHUM `RunTransaction`/batch
  existe no repositório (verificado: interface + firestoreRepo).
- `handlers/social.go` `HandleToggleLike`/`HandleAddComment`/
  `HandleDeleteComment`/`HandleDeletePost` seguem o mesmo padrão
  (curtidas/comentários podem ser perdidos em concorrência).
- ❌ **Corrigir no V2** com `RunTransaction` (incremento atômico de likes,
  append de comentários com transação no documento do post).

### 3.6 — Timezone não-oficial → ✅ CORRIGIDO

- `service/timezone.go`: `AppLoc = America/Recife` (com `time/tzdata`
  embutido p/ distroless); `Now()` no fuso do app. Teste dedica
  `TestAppLocIsRecife`.
- Consumo: `score.go` (`CompletedAt.In(AppLoc)` p/ dia), `cycle.go`
  (`parseDateYMD`, `startOfDay`, `cycleFor`), `handlers` (datas default via
  `service.Now()`), `service/social.go` (PublishWorkoutPost).
- ✅ Nenhum `time.Now()` cru em datas de negócio no fluxo principal.

### 3.7 — Falta de testes → 🟡 BACKEND OK, FRONTEND NÃO

**Backend: 77 testes** (chain de integração real sem Firebase em
`main_test.go`):
- `main_test.go`: 35 (authz por role, pendente/features, ownership,
  transferência, get-me pendente, serialização [] vs null…)
- `repository/repository_test.go`: 9 · `service/service_test.go`: 11 ·
  `service/approval_test.go`: 4 · `handlers/handlers_test.go`: 2 ·
  `handlers/approval_test.go`: 4 · `handlers/nutrition_test.go`: 3 ·
  `middleware/auth_test.go`: 5 · `middleware/http_test.go`: 4
- `go test ./...` verde (V1). TDD funciona neste repo (padrão de ouro p/ V2).

**Frontend: ZERO testes.** `package.json` só tem dev/build/start/lint; nenhum
framework de teste instalado (Vitest/Jest/Playwright ausentes) e nenhum
teste de regras Firestore (sem config `emulators` em `firebase.json`).
→ V2 adiciona Vitest + Playwright e rotinas com Emulator (seção 25 do plano).

---

## 2. Achados complementares (além da seção 3)

| # | Achado | Severidade | Decisão V2 |
|---|---|---|---|
| A1 | `PutDietLog` regrava `createdAt` (mesma classe da 3.3) | Média | Transações + createdAt imutável |
| A2 | Feed usa read-modify-write (3.5 confirmado em código) | Alta | `RunTransaction` |
| A3 | Índice `users(role, nutritionistID)` ausente do arquivo (só console) | Média | Versionar índices + Emulator |
| A4 | Frontend sem teste algum | Alta | Vitest + Playwright (novo) |
| A5 | Sem config de Emulator/Firestore em `firebase.json` | Média | Adicionar (seção 25) |
| A6 | Login Google presente na V1 (`loginWithGoogle`, `googleProvider`) | Baixa | **V2 remove** (e-mail/senha only — decisão de produto) |
| A7 | Modo demo `NEXT_PUBLIC_DEMO` (localStorage) no front | Baixa | Manter como dev-only; proibido em prod (README já documenta) |
| A8 | `RATE_LIMIT` desligado por default (vazio = 0) | Média | Default rígido em produção + documentado |
| A9 | `ALLOWED_ORIGIN` default `*` (CORS) | Média | Exigir origem explícita em produção |
| A10 | Status `blocked` (plano) x `paused/inactive` (V1) | Baixa | Harmonizar (ver plans.md) |
| A11 | `ScoreRecord` reutiliza `ListStudentsAll` (ranking global = todos alunos) | Baixa | Revisar escopo por ciclo/plano na Fase 1+ |
| A12 | `IsApproved` aceita `""` (legado) — perfis sem status acessam | Baixa | Manter migração; restringir no novo cadastro |
| A13 | `RoleFrom` default `student` p/ role vazio | Baixa | Manter compat (legado) |
| A14 | Sem testes de regras do Firestore | Média | Emulator (seção 25) |
| A15 | Frontend PWA: manifest + SW + safe-areas (bom estado) | Info | Preservar no rebuild |
| A16 | CSP sem `unsafe-eval` em prod (next.config.ts) | Info | Continuar exigindo |

## 3. Estado do repositório (working tree)

- Branch `main`, sem push autorizado. **Há alterações não commitadas** de
  sessões anteriores (backend handlers/main_test/types/repository, CSS,
  componentes do aluno, lib) e **arquivos novos não trackeados**
  (`frontend/app/(aluno)/dashboard|ranking/`, `EmptyDietState.tsx`,
  `StudentDashboard.tsx`, `icons/`).
- Eles **não devem ser revertidos** nem assumidos: o V2 continua **do estado
  atual do working tree** (governança: sem commit/push sem autorização).
- `docs/sdd/backlog.md` e `docs/sdd/status.md` documentam o histórico SDD da
  V1 (SB-001: aprovação/papéis/planos/Google) — **fonte de contexto**, não de
  planos do V2.

## 4. Conclusões

1. **A V1 atual já corrigiu a maioria da seção 3**: 3.1, 3.2, 3.4 e 3.6 estão
   resolvidos no código; 3.3 parcial (perfil ok, dietLogs não); 3.7 parcial
   (backend forte, frontend zero); **3.5 segue aberto** (feed sem transações).
2. A base Go é **um ativo**: 77 testes e clean-lite architecture => decisão
   de manter Go (ver `technology-decision.md`) é a de menor risco.
3. Os maiores buracos do V2: **frontend sem testes**, **race condition no
   feed**, **Emulator/regras sem teste**, **hardening de produção** (CORS,
   rate limit), **createdAt em dietLogs**.
4. Tudo o que é decidido nesta fase vira **ADR** (`docs/decisions/`) e
   **progresso** (`docs/progress.md`).

> Checkpoint Fase 0: ver `docs/progress.md`. Aguardando validação do dono do
> projeto antes de qualquer implementação (Fase 1).