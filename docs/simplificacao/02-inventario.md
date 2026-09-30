# 02 — Inventário por caminho

> `AÇÃO` ∈ PRESERVAR · REAPROVEITAR · SIMPLIFICAR · REMOVER · RECRIAR
> `RISCO` ∈ baixo · médio · **alto** (apaga dado de produção, mexe em auth, ou quebra teste)
> `DEPENDE DE` = caminhos que precisam sair antes. **A ordem importa.**
>
> "MOVER" não é uma ação: usar `REAPROVEITAR` e escrever o destino no PORQUÊ.
> Convenções: **F1**=gamificação · **F2**=comunidade · **F3**=planos ·
> **F4**=papel nutricionista · **F5**=participante read-only · **F6**=modelo final.
> **P1..P8** = perguntas bloqueantes de `04-perguntas.md`.
>
> Legenda de peso: `L` = linhas.

---

## RESUMO

| | Arquivos | Linhas | alto | médio | baixo |
|---|---|---|---|---|---|
| Backend Go | 48 | 12.930 | 8 | 9 | 31 |
| Frontend | 119 | 16.737 | 14 | 10 | 95 |
| Firestore/config | 5 | — | 2 | 1 | 2 |
| Testes de regras | 1 | 629 | 1 | 0 | 0 |
| **Total** | **173** | **~30.300** | **25** | **20** | **128** |

**Economia projetada:** ~40 rotas fora (63 → 39 com P1 SIM, 63 → 33 com P1 NÃO),
5 coleções fora (11 → 6), 8 índices fora (11 → 3), **~8.000 linhas** a menos.

---

## BACKEND — raiz

```
backend/main.go                | SIMPLIFICAR | 238L, 63 rotas → 39. Remove 24 rotas (score/ranking/perfil-público, posts/likes/comments, planos+assign-plan, workout-history, diet-logs) e 20 `RoleNutritionist` | alto | F1,F2,F3,F4
backend/config.go              | PRESERVAR   | 84L. Hardening: `ALLOWED_ORIGIN` obrigatório e `RATE_LIMIT=0` rejeitado em produção (item 9 do CLAUDE.md) | baixo | —
backend/main_test.go           | SIMPLIFICAR | 66 chain tests. Remove ~20 (posts/diet/plans); **reescreve ~15** de papel; preserva os 6 que provam a regra de acesso | alto | F1,F2,F3,F4
backend/main_programs_test.go  | SIMPLIFICAR | 28 chain tests de programa. 16 dependem de ownership por nutricionista; `TestChainStudentCannotReadOtherStudentProgram` é âncora de segurança | alto | F4
backend/config_test.go         | PRESERVAR   | 10 testes de hardening. Nenhum toca o que sai | baixo | —
```

## BACKEND — `handlers/`

```
backend/handlers/scores.go        | REMOVER   | 112L, 3 rotas (`/api/ranking`, `/api/scores/history`, `/api/public/profile/{id}`). Gamificação inteira | baixo | F1
backend/handlers/social.go        | REMOVER   | 336L, 6 rotas de posts/like/comentário. Comment é o único lugar com UpdatePostTx (a correção de race da F1) — some junto, sem resquício | baixo | F2
backend/handlers/diet.go          | REMOVER   | 195L, log de dieta (GET/PUT `/api/diet-logs`). Único consumidor é a nota (L189 chama RecomputeScore) | médio | F1
backend/handlers/approval.go      | SIMPLIFICAR | 214L. **Mantém** HandleListPendingUsers/Approve/Reject (decisão 5). **Remove** HandleListPlans/CreatePlan/UpdatePlan/DeletePlan/AssignPlan (L83–L198) | médio | F3
backend/handlers/handlers.go      | PRESERVAR | 189L, "modo original" V1 (sessions/prs/state, L92–L190). Não está na lista de remoção **nem** no formato novo → **bloqueado por P1** | baixo | P1
backend/handlers/nutrition.go     | SIMPLIFICAR | **966L, maior arquivo de handler.** 27 handlers → ~14. Some HandleListHistory/CompleteWorkout (L835–L966) e a recomposição de score (L960) | alto | F1,F4
backend/handlers/program.go       | SIMPLIFICAR | 337L. `loadProgram` (L321) valida ownership por nutricionista; os testes da F19 (workouts de outro dono) viram um caso só | alto | F4
backend/handlers/exercise.go      | PRESERVAR | 112L. CRUD de exercício: escrita é do admin, que é o requisito | baixo | —
backend/handlers/handlers_test.go | PRESERVAR | 3 testes utilitários (parse/writeJSON/TooLong) | baixo | —
backend/handlers/nutrition_test.go| SIMPLIFICAR | 3 testes de `preserveAdminFields`/`mergeStudentEdits`: a allowlist perde planID/features/nutritionistID | médio | F3
backend/handlers/approval_test.go | SIMPLIFICAR | 4 testes; remove `TestHandleDeletePlanInUse` e `TestHandleDeletePlanOK` | baixo | F3
```

## BACKEND — `middleware/`

```
backend/middleware/auth.go     | PRESERVAR | 193L. `Require`/`Allow`/`RequireApproved` popula o contexto. Só sai o `RoleNutritionist` do switch. **Item 2 do prompt: não reescrever** | alto | F4
backend/middleware/auth_test.go | SIMPLIFICAR | 5 testes. `TestRequireFeature` (L?) **cai na F3** — o gate de feature deixa de existir | médio | F3
backend/middleware/http.go     | PRESERVAR | 194L. CORS, RateLimit, SecurityHeaders, MaxBody, Recover. Fora do escopo | baixo | —
backend/middleware/http_test.go | PRESERVAR | 16 testes dos middlewares. Nenhum toca o que sai | baixo | —
```

## BACKEND — `models/`

```
backend/models/types.go | SIMPLIFICAR | 514L, 45 structs. **Remove:** `Feature`+4 consts (L68–75), `Plan` (L79–87), `NutritionistID`/`StartDate`/`EndDate`/`PlanID`/`Features`/`Bio`/`PhotoURL` de `UserProfile` (L94–L105), 7 structs de score/ranking (`ScoreRecord`, `ScoreHistoryEntry`, `RankingEntry`, `RankingResponse`, `PublicProfile`, `Cycle`, `DayPoints`), 4 structs de post (`Post`, `PostComment`, `PostType`, `CreatePostRequest`, `CommentRequest`), `AssignPlanRequest`, 5 de histórico/dietLog (`WorkoutHistoryEntry`, `CompleteWorkoutRequest`, `DietLogStatus`, `MealCheck`, `DietDailyLog`, `UpsertDietLogRequest`) | alto | F1,F2,F3,F4
```

## BACKEND — `service/`

```
backend/service/score.go     | REMOVER   | 118L. `RecomputeScore` (L13) e `ComputeStreak` (L85) — os dois únicos cálculos de nota do projeto | baixo | F1
backend/service/cycle.go     | REMOVER   | 128L. `cycleFor`, `cycleScoreFromData` (L112) — o denominador da nota era o `StartDate` do aluno | baixo | F1
backend/service/ranking.go   | REMOVER   | 45L. `BuildRanking` | baixo | F1
backend/service/public.go    | REMOVER   | 61L. Perfil público: junta `ComputeStreak` (L29) + `GetScoreRecord` (L36) | baixo | F1
backend/service/social.go    | REMOVER   | 106L | baixo | F2
backend/service/access.go    | SIMPLIFICAR | **43L, núcleo da regra de acesso.** `CanAccessResource` (L32) passa de 3 papéis para 2: `admin → tudo; student → uid == studentID`. `CanAccessStudent` (L12) **some**: com um só dono, é idêntica — unificar reduz superfície | alto | F4
backend/service/program.go   | SIMPLIFICAR | 382L. Remove `ValidateProgramWorkoutOwnership` (checagem de posse do F19) e o campo de dono. **Manter** o resto: import markdown, assign, duplicate | alto | F4
backend/service/approval.go  | SIMPLIFICAR | 106L. Remove `AssignPlan`. **Mantém** `GetOrCreateProfile` (cria `pending_approval` — decisão 5), Approve, Reject | médio | F3
backend/service/diet.go      | PRESERVAR | 48L. Revisar: se só alimenta o log de dieta, sai na F1; se tem validação usada pelo form de dieta, fica | médio | F1
backend/service/constants.go | SIMPLIFICAR | 62L. Remove constantes de feature/plan | baixo | F3
backend/service/profile.go   | SIMPLIFICAR | 44L. `StartDate`/`EndDate` saem do merge de perfil | médio | F3,F4
backend/service/exercise.go  | PRESERVAR | 75L. Validação de exercício | baixo | —
backend/service/normalize.go | PRESERVAR | 23L | baixo | —
backend/service/errors.go    | PRESERVAR | 40L. Mapeamento de erro HTTP | baixo | —
backend/service/timezone.go  | PRESERVAR | 25L. `AppLoc`/`Now()`. **Item 3 do CLAUDE.md: nunca `time.Now()` cru.** Não é gamificação | baixo | —
backend/service/service.go    | PRESERVAR | 17L. Construtor | baixo | —
```

## BACKEND — `service/` (testes)

```
backend/service/public_test.go    | REMOVER   | 1 arquivo, 1 teste (`TestGetPublicProfileDoesNotExposeSensitiveFields`). O perfil público sai inteiro | baixo | F1
backend/service/service_test.go   | SIMPLIFICAR | 12 testes. **Remove 6:** `TestCycleFor`, `TestDaysElapsedInCycle`, `TestScoreFromPointsAndRaw`, `TestCycleScoreFromData`, `TestBuildRanking`, `TestAggregateStatus`. **Preserva** `TestAppLocIsRecife` (timezone). **Reescreve** `TestCanAccessResource` para 2 papéis | alto | F1,F4
backend/service/approval_test.go  | SIMPLIFICAR | 5 testes. Remove `TestAssignPlan` | baixo | F3
backend/service/exercise_test.go  | PRESERVAR | 11 testes de validação | baixo | —
backend/service/program_test.go   | SIMPLIFICAR | 17 testes. 3 dependem de "outro nutricionista" (`TestAssignProgramRejectsOtherStudent`, `TestCreateProgramFromImportOwnsTheWorkouts`, `TestDuplicateWorkoutForStudent*`) | alto | F4
```

## BACKEND — `repository/`

```
backend/repository/repository.go     | SIMPLIFICAR | **1.337L, maior arquivo do backend.** Remove ~15 métodos: score (`GetScoreRecord` L1250, `PutScoreRecord` L1265, `ListScoreRecords` L1279, `PutScoreHistory` L1302, `ListScoreHistory` L1316), post (todos), plan (todos), history (`CreateHistoryEntry` L874, `ListHistoryForStudent` L892, `ListHistoryForNutritionist` L901, `ListHistory` L910, `ListHistoryForStudentSince` L941), dietLog (`GetDietLog` L1169, `PutDietLog` L1210, `ListDietLogsForStudent` L1217), e os 4 `*ForNutritionist` (workout/program/diet) | alto | F1,F2,F3,F4
backend/repository/repository_test.go| SIMPLIFICAR | 12 testes. Remove `TestPostDataPreservesLikesCommentsAndModeration`, `TestDietLogDataPreserves*` (2). **Preserva** `TestUserProfileDataPreservesCreatedAt` (item 4 do CLAUDE.md) | baixo | F1,F2
```

## BACKEND — import markdown e comandos

```
backend/programmd/parser.go        | PRESERVAR | 503L. Import de treino em markdown é **requisito do admin** (§4 do prompt) | baixo | —
backend/programmd/parser_test.go   | PRESERVAR | 15 testes, todos de parser | baixo | —
backend/cmd/programimport/main.go  | PRESERVAR | 172L. CLI de import | baixo | —
backend/cmd/e2eseed/main.go        | SIMPLIFICAR | 355L. Remove asserts de score (L291–L310), o bloco de studentA/studentB de ranking, e o seed de posts/plans/dietLogs/workoutHistory. **Preserva** o seed de usuários admin/aluno, treinos, programas, dietas | alto | F1,F2,F3
```

## FIRESTORE

```
firestore.rules              | SIMPLIFICAR | 176L. **Remove 6 blocos `match`:** posts (L115), dietLogs (L123), workoutHistory (L141), plans (L148), scores (L164), scores_history (L171). **Simplifica 3 helpers:** `canViewStudentData` L57–L65 (perde a clause de nutricionista L61–L63 → vira `isOwner \|\| isAdmin`), `allowedSelfProfileUpdate` L75–L82 (allowlist `name/email/photoURL/bio` → `name/email`), `isPendingSelfProfile` L88–L93 (tira `planID`/`features`/`nutritionistID` do `hasAny`). L108–L110 depende de P1 | alto | F1,F2,F3,F4
firestore.indexes.json       | SIMPLIFICAR | 11 → **3** índices. Remove: posts(1), dietLogs(1), workoutHistory(3), e os 3 `nutritionistId+createdAt` (workouts/programs/diets) na F4. **Preserva:** workouts/programs/diets `studentId+createdAt` | médio | F1,F4
firebase.json                | PRESERVAR | Emuladores. Fora do escopo | baixo | —
firestore-tests/rules.test.js| SIMPLIFICAR | 629L, **64 `it()` em 15 `describe()`**. Remove os describes de posts, plans, scores, scores_history, dietLogs, workoutHistory e reescreve os de `canViewStudentData` | alto | F1,F2,F3,F4
firestore-tests/package.json | PRESERVAR | 14L | baixo | —
```

## FRONTEND — `app/(aluno)/` (participante)

```
frontend/app/(aluno)/layout.tsx        | PRESERVAR | 9L. Guard de rota do participante | baixo | —
frontend/app/(aluno)/dashboard/page.tsx| PRESERVAR | 7L | baixo | —
frontend/app/(aluno)/programas/page.tsx| PRESERVAR | 7L. Lista o programa do aluno | baixo | —
frontend/app/(aluno)/programas/[id]/page.tsx | PRESERVAR | 18L | baixo | —
frontend/app/(aluno)/treinos/page.tsx  | RECRIAR  | 7L hoje aponta p/ `StudentWorkoutsPage`, que embute "marcar feito" (escrita). Nova tela = **leitura pura** do programa→treino→exercício | médio | F5
frontend/app/(aluno)/dietas/page.tsx  | PRESERVAR | 7L. A rota fica, mas `StudentDietPage` perde o `DietCheck` (escrita do log) | médio | F5
frontend/app/(aluno)/ranking/page.tsx  | REMOVER   | 7L | baixo | F1
frontend/app/(aluno)/comunidade/page.tsx| REMOVER  | 7L | baixo | F2
frontend/app/(aluno)/base.css          | SIMPLIFICAR | 844L. Regras de score/feed/curtida ficam órfãs — varrer, não reescrever | baixo | F1,F2
frontend/app/(aluno)/dashboard.css    | PRESERVAR | 295L | baixo | —
frontend/app/(aluno)/student.css      | PRESERVAR | 207L | baixo | —
```

## FRONTEND — `app/nutritionist/` → **vira `app/admin/`**

Esta é a descoberta estrutural da análise: **a área "nutricionista" já É a área de
administração.** Com o papel removido, essas telas não somem — mudam de dono.
`app/admin/page.tsx` (346L) hoje só tem a fila de aprovação + `PlansManager`.

```
frontend/app/nutritionist/layout.tsx            | REAPROVEITAR | 14L → `admin/layout.tsx`. O guard checa `role === 'nutritionist'`; passa a checar `admin` | alto | F4
frontend/app/nutritionist/workouts/page.tsx     | REAPROVEITAR | 351L → `admin/treinos` | alto | F4
frontend/app/nutritionist/diets/page.tsx        | REAPROVEITAR | 251L → `admin/dietas` | alto | F4
frontend/app/nutritionist/programs/page.tsx     | REAPROVEITAR | 457L → `admin/programas` | alto | F4
frontend/app/nutritionist/programs/[id]/page.tsx| REAPROVEITAR | 18L → `admin/programas/[id]` | alto | F4
frontend/app/nutritionist/exercises/page.tsx    | REAPROVEITAR | 347L → `admin/exercicios` | alto | F4
frontend/app/nutritionist/students/page.tsx     | REAPROVEITAR | 247L → `admin/participantes` | alto | F4
frontend/app/nutritionist/students/[studentId]/page.tsx | REAPROVEITAR | 58L → `admin/participantes/[id]` | alto | F4
frontend/app/nutritionist/print/page.tsx        | REAPROVEITAR | 308L → `admin/imprimir` | alto | F4
frontend/app/nutritionist/page.tsx              | REMOVER   | 174L. Dashboard do nutricionista. Substituído pelo índice do admin | baixo | F4
frontend/app/nutritionist/feed/page.tsx         | REMOVER   | 17L | baixo | F2
frontend/app/nutritionist/activities/page.tsx   | REMOVER   | 226L. Feed do nutricionista | baixo | F2
frontend/app/nutritionist/ranking/page.tsx      | REMOVER   | 11L | baixo | F1
frontend/app/nutritionist/timeline/page.tsx     | REMOVER   | 196L. Linha do tempo de adesão, alimentada por `AdherenceChart` | baixo | F1
frontend/app/nutritionist/profile/page.tsx      | REMOVER   | 170L. Perfil social do nutricionista (`bio`/`photoURL`) | baixo | F2
```

## FRONTEND — `app/` raiz

```
frontend/app/admin/page.tsx    | SIMPLIFICAR | 346L. Hoje: fila de aprovação + `PlansManager` (L10, L140). Vira o hub do admin: participantes, treinos, programas, dietas, exercícios, impressão | alto | F3,F4
frontend/app/admin/layout.tsx  | SIMPLIFICAR | 12L | médio | F4
frontend/app/login/page.tsx        | PRESERVAR | 112L. **REGRA DURA — arquivo de auth. Não reescrever** | baixo | P2
frontend/app/cadastro/page.tsx     | PRESERVAR | 187L. Auth + criação de perfil `pending_approval` (**decisão 5**) | baixo | P2
frontend/app/recuperar-senha/page.tsx | PRESERVAR | 136L. Auth | baixo | P2
frontend/app/page.tsx          | PRESERVAR | 37L. Roteia por papel. Ajusta o destino: `admin` → `/admin`, `student` → `/dashboard` | baixo | F4
frontend/app/layout.tsx        | PRESERVAR | 64L | baixo | —
frontend/app/error.tsx         | PRESERVAR | 45L | baixo | —
frontend/app/global-error.tsx  | PRESERVAR | 55L | baixo | —
frontend/app/not-found.tsx     | PRESERVAR | 24L | baixo | —
frontend/app/profile/[id]/page.tsx | REMOVER | 92L. Perfil público (decisão 3) | baixo | F2
```

## FRONTEND — `lib/`

```
frontend/lib/api.ts          | SIMPLIFICAR | **1.880L, 65 exports (63 funções).** Remove ~25: `getRanking` L1822, `getScoreHistory` L1854, `getPublicProfile` L1865, `listPosts` L1624, `createPost` L1645, `toggleLike` L1670, `addComment` L1688, `deleteComment` L1718, `deletePost` L1737, `listPlans` L916, `createPlan` L943, `updatePlan` L956, `deletePlan` L971, `assignPlan` L898, `listHistory` L1527, `listHistoryPage` L1545, `completeWorkout` L1572, `listDietLogs` L1748, `putDietLog` L1764, + as de `*ForNutritionist`. **Preserva:** `getMe`/`putMe`/auth, users, approve/reject, workouts, programs(+import/assign/duplicate), exercises, diets | alto | F1,F2,F3,F4,F5
frontend/lib/types.ts        | SIMPLIFICAR | 436L. Remove `Plan`, `Feature`, `ScoreRecord`, `ScoreHistoryEntry`, `RankingEntry`, `RankingResponse`, `PublicProfile`, `Post`, `PostComment`, `CreatePostRequest`, `CommentRequest`, `PostType`, `WorkoutHistoryEntry`, `CompleteWorkoutRequest`, `DietDailyLog`, `UpsertDietLogRequest`, `DietLogStatus`, `MealCheck`, `HistorySet`, `HistoryExercise`; e os campos `nutritionistID`/`planID`/`features`/`startDate`/`endDate`/`bio`/`photoURL` de `UserProfile` | alto | F1,F2,F3,F4
frontend/lib/auth.tsx        | PRESERVAR | 235L. **REGRA DURA — arquivo de auth.** Tem 10 ocorrências de "nutritionist" (guard de rota) a remover e 26 de `demoAs`. Adaptação mínima, nunca reescrita | alto | P2,F4
frontend/lib/useNewCompletions.ts | REMOVER | 76L. "Novos concluimentos" depende de `workoutHistory` — morre com a coleção | baixo | F5
frontend/lib/config.ts       | PRESERVAR | 6L. `DEMO_MODE` — **depende de P2** | baixo | P2
frontend/lib/auth-errors.ts  | PRESERVAR | 51L. Auth | baixo | P2
frontend/lib/firebase.ts     | PRESERVAR | 37L. Auth | baixo | P2
frontend/lib/programDays.ts  | PRESERVAR | 41L. Dias do programa | baixo | —
frontend/lib/exercise.ts     | PRESERVAR | 24L | baixo | —
frontend/lib/data.ts         | PRESERVAR | 152L. "Modo original" (sessions/prs/state) — **depende de P1** | baixo | P1
frontend/lib/days.ts         | PRESERVAR | 30L. **Depende de P1** | baixo | P1
```

## FRONTEND — `components/` — REMOVER

```
frontend/components/Feed.tsx                     | REMOVER | 151L. Feed de posts | baixo | F2
frontend/components/PostCard.tsx                 | REMOVER | 207L. Card de post + curtida + comentário | baixo | F2
frontend/components/AdherenceChart.tsx           | REMOVER | 196L. Gráfico de adesão (usado só por `nutritionist/timeline`) | baixo | F1
frontend/components/Ranking.tsx                  | REMOVER | 99L | baixo | F1
frontend/components/DietCheck.tsx                | REMOVER | 216L. Check-in de dieta = **escrita** pelo participante. Cai com o read-only | médio | F5
frontend/components/RestTimer.tsx                | REMOVER | 104L. Só usado por `TodayWorkout` | baixo | F5
frontend/components/TodayWorkout.tsx             | REMOVER | 365L. Só usado por `StudentWorkoutsPage`. Marca-treino-feito = escrita | médio | F5
frontend/components/student/StudentCommunityPage.tsx | REMOVER | 24L | baixo | F2
frontend/components/DemoRoleSwitch.tsx           | REMOVER | 87L. Alterna papel em modo demo. **Toca `auth.tsx`** → **P2** | alto | P2
frontend/components/admin/PlansManager.tsx       | REMOVER | 244L. CRUD de planos (decisão 4) | baixo | F3
frontend/components/Avatar.tsx                   | PRESERVAR | 22L. **Atenção:** o *campo* `photoURL` sai do modelo (nada o preenche na V2), mas o *componente* gera iniciais e é como o admin identifica o participante na fila. **P3** | baixo | P3
```

## FRONTEND — `components/` — RECRIAR

```
frontend/components/student/StudentWorkoutsPage.tsx | RECRIAR | 219L hoje. Embute `TodayWorkout` + `RestTimer` + `useNewCompletions` (marcar feito, log de série, timer). Nova versão: **leitura pura** programa→treino→exercício, conforme §4 do prompt | alto | F5
frontend/components/StudentDetail.tsx              | SIMPLIFICAR | **855L, maior componente isolado.** Abas de treino, dieta, score e feed. Corta score+feed (F1/F2); preserva treino+dieta; a atribuição "vínculo ao participante" absorve o que era "atribuir ao nutricionista" | alto | F1,F2,F4
```

## FRONTEND — `components/` — REAPROVEITAR (mover para `admin/`)

```
frontend/components/Sidebar.tsx              | REAPROVEITAR | 123L. Menu lateral. Tira item de feed/ranking e o `useNewCompletions` (L7, L41) | alto | F1,F2,F4,F5
frontend/components/StudentLayout.tsx        | REAPROVEITAR | 119L. Layout do participante | médio | F4
frontend/components/DashboardLayout.tsx      | REAPROVEITAR | 57L. Layout do admin | baixo | F4
frontend/components/AdminAreaSwitch.tsx      | REAPROVEITAR | 55L. Alterna admin↔nutricionista → perde o lado "nutricionista" | alto | F4
frontend/components/WorkoutForm.tsx          | REAPROVEITAR | 503L. Form de treino. Remove o seletor de nutricionista (14 ocorrências) | alto | F4
frontend/components/DietForm.tsx             | REAPROVEITAR | 241L. Mesmo, para dieta | alto | F4
frontend/components/programs/ProgramDetail.tsx | REAPROVEITAR | 280L. Tira a coluna "nutricionista" (3 ocorrências) | alto | F4
frontend/components/programs/ProgramForm.tsx | REAPROVEITAR | 254L | alto | F4
frontend/components/programs/ProgramImport.tsx | REAPROVEITAR | 181L. **Import markdown — requisito do admin** | baixo | —
frontend/components/admin/PendingApprovals.tsx | REAPROVEITAR | 258L. Fila de aprovação. **Preserva (decisão 5).** Tira o `Avatar` se P3 mudar, e o select de plano | alto | F3,P3
frontend/components/EmptyDietState.tsx       | REAPROVEITAR | 55L | baixo | F4
frontend/components/ConfirmModal.tsx         | REAPROVEITAR | 56L | baixo | —
frontend/components/LoadError.tsx            | REAPROVEITAR | 23L | baixo | —
frontend/components/Logo.tsx                 | REAPROVEITAR | 22L | baixo | —
frontend/components/PasswordInput.tsx        | REAPROVEITAR | 110L. Auth UI | baixo | P2
frontend/components/Skeleton.tsx             | REAPROVEITAR | 339L. Tira variantes de feed/ranking | baixo | F1,F2
frontend/components/DashIcon.tsx             | REAPROVEITAR | 160L. Tira ícone de feed | baixo | F2
frontend/components/icons/AppIcons.tsx       | REAPROVEITAR | 138L. Tira ícone de feed | baixo | F2
frontend/components/PWA.tsx                  | REAPROVEITAR | 88L | baixo | —
frontend/components/PWAInstall.tsx           | REAPROVEITAR | 106L | baixo | —
frontend/components/SetupNeeded.tsx          | REAPROVEITAR | 32L | baixo | —
frontend/components/PendingApproval.tsx      | REAPROVEITAR | 60L. Tela de "aguardando aprovação" — **decisão 5** | baixo | —
frontend/components/ProfileSetup.tsx         | REAPROVEITAR | 76L. Nome no primeiro acesso. Fluxo de cadastro | baixo | P2
frontend/components/Providers.tsx            | SIMPLIFICAR | 19L. Renderiza `DemoRoleSwitch` (L6, L15) → **P2** | médio | P2
frontend/components/student/StudentDashboard.tsx | REAPROVEITAR | 99L. Tira cards de ranking e comunidade | alto | F1,F2
frontend/components/student/StudentDietPage.tsx   | SIMPLIFICAR | 138L. Tira `DietCheck` (5 ocorrências) | médio | F5
frontend/components/student/StudentProgramsPage.tsx | REAPROVEITAR | 108L | baixo | —
```

## FRONTEND — testes Vitest (20 arquivos, 131 testes)

```
frontend/__tests__/Ranking.test.tsx        | REMOVER   | 5 testes | baixo | F1
frontend/__tests__/StudentDietPage.test.tsx| SIMPLIFICAR | 6 testes; perde as asserções de `DietCheck` | médio | F5
frontend/__tests__/StudentDashboard.test.tsx| SIMPLIFICAR | 5 testes; tira card de ranking/comunidade | médio | F1,F2
frontend/__tests__/ProgramDetail.test.tsx  | SIMPLIFICAR | 10 testes; tira a coluna de nutricionista (L7, L8, L18) | alto | F4,P2
frontend/__tests__/programs-api.test.ts    | SIMPLIFICAR | 23 testes; tira `assignPlan`/`planID` e as variantes de demo (L4, L15, L16) | alto | F3,F4,P2
frontend/__tests__/WorkoutForm.test.tsx    | SIMPLIFICAR | 2 testes; tira o campo nutricionista | alto | F4
frontend/__tests__/DietForm.test.tsx       | SIMPLIFICAR | 2 testes; idem | alto | F4
frontend/__tests__/auth-demo.test.tsx      | PRESERVAR | 4 testes de modo demo — **P2** | alto | P2
frontend/__tests__/login-page.test.tsx     | PRESERVAR | 6. **Auth — regra dura** | baixo | P2
frontend/__tests__/signup-page.test.tsx    | PRESERVAR | 9. **Auth — regra dura** (fluxo de cadastro, decisão 5) | baixo | P2
frontend/__tests__/recover-page.test.tsx   | PRESERVAR | 8. **Auth** | baixo | P2
frontend/__tests__/password-input.test.tsx | PRESERVAR | 6. **Auth** | baixo | P2
frontend/__tests__/auth-errors.test.ts     | PRESERVAR | 6. **Auth** | baixo | P2
frontend/__tests__/ExercisesPage.test.tsx  | PRESERVAR | 5 | baixo | —
frontend/__tests__/EmptyDietState.test.tsx | PRESERVAR | 3 | baixo | —
frontend/__tests__/exerciseToWorkoutExercise.test.ts | PRESERVAR | 4 | baixo | —
frontend/__tests__/mealsToText.test.ts      | PRESERVAR | 5 | baixo | —
frontend/__tests__/pwa-sw.test.ts          | PRESERVAR | 10 | baixo | —
frontend/__tests__/PWA.test.tsx            | PRESERVAR | 7 | baixo | —
frontend/__tests__/PWAInstall.test.tsx     | PRESERVAR | 5 | baixo | —
```

## FRONTEND — testes Playwright (10 arquivos, 30 testes)

```
frontend/e2e/autorizacao.spec.ts | PRESERVAR | **5 testes — é a base da Fase 7.** Autentica como A e pede recurso de B | baixo | —
frontend/e2e/auth.spec.ts       | PRESERVAR | 13 testes. **Auth — regra dura** | baixo | P2
frontend/e2e/zz-aprovacao.spec.ts| PRESERVAR | 1 teste. Fluxo cadastro→aprovação (**decisão 5**) | baixo | —
frontend/e2e/dieta-nova.spec.ts  | PRESERVAR | 1 | baixo | —
frontend/e2e/exercicios.spec.ts | PRESERVAR | 1 | baixo | —
frontend/e2e/pwa.spec.ts         | PRESERVAR | 3 | baixo | —
frontend/e2e/ranking.spec.ts     | REMOVER   | 1 teste | baixo | F1
frontend/e2e/aluno.spec.ts      | SIMPLIFICAR | 4 testes; tira ranking e comunidade | médio | F1,F2,F5
frontend/e2e/programas.spec.ts  | SIMPLIFICAR | 1 teste; tira o papel nutricionista | alto | F4
frontend/e2e/helpers.ts          | SIMPLIFICAR | 75L. Helpers criam/logam com papel de nutricionista | alto | F4
```

## SCRIPTS DE PRODUÇÃO (a criar)

```
scripts/drop-scores.ts          | RECRIAR | Apaga `scores/` e `scores_history/` em produção. **Autorizado pelo dono** (decisão 2). Deve pedir confirmação e imprimir a contagem antes de apagar | alto | F1
scripts/strip-legacy-fields.ts  | RECRIAR | Opcional. Remove `nutritionistId`/`planID`/`features` de documentos existentes. **Não é necessário para funcionar** — o campo vira inerte | alto | F4
```

---

## Itens PRESERVAR sem ressalva (a garantia mais barata do projeto)

Estes não são tocados em nenhuma fase, exceto adaptação mínima:

| O quê | Por quê |
|---|---|
| `backend/middleware/http.go` + `http_test.go` (194L + 16 testes) | CORS, rate limit, headers, MaxBody, Recover |
| `backend/config.go` + `config_test.go` (84L + 10 testes) | Hardening de produção (item 9 do CLAUDE.md) |
| `backend/middleware/auth.go` (`Require`, `RequireApproved`) | Verificação de ID token |
| `backend/programmd/parser.go` + testes (503L + 15 testes) | Import markdown é requisito do admin |
| `backend/service/timezone.go` + `TestAppLocIsRecife` | Item 3 do CLAUDE.md |
| `TestUserProfileDataPreservesCreatedAt` | Item 4 do CLAUDE.md |
| `frontend/lib/auth.tsx`, `firebase.ts`, `auth-errors.ts` | Auth (regra dura) |
| `app/login`, `app/cadastro`, `app/recuperar-senha` + seus 5 testes | Auth (regra dura) |
| Fluxo `pending_approval` → `approvedBy`/`approvedAt` | Decisão 5 |
| `handlers/approval.go` (3 handlers de aprovação) | Decisão 5 |
| `components/PendingApproval.tsx`, `ProfileSetup.tsx` | Decisão 5 |
| `e2e/auth.spec.ts`, `zz-aprovacao.spec.ts` | Decisão 5 |
| `repository/repository.go` — `RunTransaction` de post | Sai com o post; **não há padrão equivalente a recriar** |
