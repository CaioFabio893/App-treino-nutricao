# 03 — Plano em fases

> **Uma fase = um tema, com gate verificável.** Cada fase termina com a suíte
> **verde**. Remover código não pode deixar teste vermelho.
>
> ⚠️ **"Verde" não significa "mesmo número".** Cada fase **reduz** o número de
> testes porque remove os testes do que removeu. O gate de cada fase declara o
> **novo número esperado** e nomeia os testes que saíram. Um gate que exige
> "208 → 208" bloquearia a simplificação legítima.
>
> Ordem: **F1 → F2 → F3 → F4 → F5 → F6 → F7**. O papel `nutritionist` cai
> **depois** de gamificação e comunidade — senão você mexe em 51 arquivos Go
> com a suíte ainda cheia de teste de papel, e não dá para saber se um vermelho
> é do que você removeu ou do que você quebrou.
>
> Regra de governança em vigor (`CLAUDE.md`): commit automático em checkpoint
> verde, **sem push, sem deploy**, sem tocar na V1 em produção.

---

## Fase 0 — Corrigir o `.gates` (15 min, sem risco)

**Por quê:** `01-baseline.md` §2 mediu **64 `it()`** em `rules.test.js`, mas
`.gates` registra **76**. Todo gate de regras da Fase 2 em diante ficaria
ambíguo. Não dá para começar a remover regras com a régua quebrada.

**Arquivos:** `.gates` (só a linha `rules=`).
**NÃO tocar:** nada.

```powershell
cd firestore-tests; npm test 2>&1 | Select-String "passing|failing"; cd ..
```

**Gate:** a linha `rules=` do `.gates` bate com o número que o mocha imprimir.

**Quebra se der errado:** nada — é um arquivo de estado, sem código.

---

## Fase 1 — Remover gamificação

**Tema:** pontuação, ranking, check-in, streak, perfil público, e as duas
coleções que só existiam para alimentá-los.

**Arquivos tocados (~40):**

| Camada | O que sai |
|---|---|
| service | `score.go`, `cycle.go`, `ranking.go`, `public.go`, `public_test.go` |
| handlers | `scores.go` |
| repository | `GetScoreRecord`, `PutScoreRecord`, `ListScoreRecords`, `PutScoreHistory`, `ListScoreHistory` + 5 entradas da interface |
| models | `ScoreRecord`, `ScoreHistoryEntry`, `RankingEntry`, `RankingResponse`, `PublicProfile`, `Cycle`, `DayPoints`, `RankingEntry` |
| main.go | 3 rotas (L235–L237) |
| e2eseed | asserts L291–L310 |
| rules | blocos `scores` (L164) e `scores_history` (L171) |
| indexes | — (nenhum índice é de score) |
| rules.test.js | describes de scores/scores_history |
| frontend | `Ranking.tsx`, `AdherenceChart.tsx`, `(aluno)/ranking/`, `nutritionist/ranking/`, `nutritionist/timeline/`, `__tests__/Ranking.test.tsx`, `e2e/ranking.spec.ts` |
| api.ts / types.ts | `getRanking`, `getScoreHistory`, `getPublicProfile` + 6 tipos |

**NÃO tocar:** `service/timezone.go` e `TestAppLocIsRecife` (o ciclo de nota
usava `AppLoc`, mas o timezone é regra do projeto inteiro — item 3 do
CLAUDE.md); `StartDate`/`EndDate` **ficam por agora** (são removidos na F3,
juntos com o resto da allowlist); `auth.go`; `firestore.indexes.json`.

**Ordem dentro da fase:** models → repository → service → handlers → rotas →
seed → rules → testes de regra → frontend. Remover a struct primeiro força o
compilador a listar todo mundo que a usa.

**Gate:**
```powershell
cd backend
go vet ./...
go test ./... -count=1 -v 2>&1 | Select-String "^--- PASS" | Measure-Object
cd ..\frontend
npx tsc --noEmit
npm test 2>&1 | Select-String "Tests"
npm run lint
cd ..\firestore-tests; npm test 2>&1 | Select-String "passing"; cd ..
```

| Suíte | Antes | **Esperado depois** | Testes que saem |
|---|---|---|---|
| Go | 208 | **201** | `service_test.go`: `TestCycleFor`, `TestDaysElapsedInCycle`, `TestScoreFromPointsAndRaw`, `TestCycleScoreFromData`, `TestBuildRanking`, `TestAggregateStatus` (6) + `public_test.go` inteiro (1) |
| Vitest | 131 | **126** | `Ranking.test.tsx` (5) |
| E2E | 30 | **29** | `ranking.spec.ts` (1) |
| Regras | 64 `it()` | TBD — medir e registrar no `.gates` | 2 describes |

**Quebra se der errado:** `go vet` falha com "undefined: ScoreRecord" → sobrou
referência em algum arquivo. É o *melhor* erro possível: o compilador acha
tudo. O erro perigoso é o oposto — compilar e o `TestCycleFor` continuar
passando porque o dado de score ainda existe.

**Apagar dados de produção:** **depois** do gate verde, e só então.
```powershell
# scripts/drop-scores.ts — pede confirmação, imprime contagem, apaga scores/ e scores_history/
```
⚠️ Autorizado (decisão 2), mas **irreversível**. Fazer backup antes, mesmo
autorizado.

---

## Fase 2 — Remover comunidade

**Tema:** `posts`, comentário, curtida, compartilhamento, feed, perfil público.

**Arquivos tocados (~30):**

| Camada | O que sai |
|---|---|
| service | `social.go` |
| handlers | `social.go` (336L, 6 rotas) |
| repository | todos os métodos de post/like/comment |
| models | `Post`, `PostComment`, `PostType`, `CreatePostRequest`, `CommentRequest` |
| main.go | 6 rotas (L223–L228) |
| e2eseed | seed de posts |
| rules | bloco `posts` (L115–L118) |
| indexes | índice `posts userId+type+createdAt` |
| frontend | `Feed.tsx`, `PostCard.tsx`, `(aluno)/comunidade/`, `nutritionist/feed/`, `nutritionist/activities/`, `nutritionist/profile/`, `profile/[id]/page.tsx`, `StudentCommunityPage.tsx` |
| testes | `e2e/aluno.spec.ts` (parcial) |

**NÃO tocar:** `repository_test.go::TestPostDataPreservesLikesCommentsAndModeration`
some **junto** com `postData` — mas antes confirme que nenhuma outra função usa
`postData`. `e2e/aluno.spec.ts` e `e2e/auth.spec.ts` mentionam "Feed" — o
`auth.spec.ts` tem 13 testes e **não pode** ser tocado sem rever (é auth).

**Gate:** mesmo bloco da F1.

| Suíte | Antes | **Esperado depois** |
|---|---|---|
| Go | 201 | **~191** (remove ~10: `TestChainToggleLike*` 2, `TestChainAddComment*` 2, `TestChainCreatePost*` 1, `TestChainDeleteOwnComment`, `TestChainStudentCannotDeleteOthersComment`, `TestChainAuthorDeletesOwnPost`, `TestChainNutritionistSoftDeletesPost`, `TestChainStudentCannotDeleteOthersPost`) — **conferir nome a nome** |
| Vitest | 126 | 126 (nenhum teste de feed isolado) |
| E2E | 29 | **~27** |

**Quebra se der errado:** o `RunTransaction` de post (`UpdatePostTx`) é a
correção do race condition da F1 e some com ele. **Não há nada a recriar** —
ninguém mais escreve post. Mas não deixar vestígio de interface `UpdatePostTx`
na `Repository` (CLAUDE.md item 5: o padrão antigo foi *removido da interface*
de propósito; ele não deve voltar).

---

## Fase 3 — Remover planos, features e o gate de assinatura

**Tema:** `plans/`, `planID`, `features`, `RequireFeature`.

**Arquivos tocados (~25):**

| Camada | O que sai |
|---|---|
| models | `Feature` + 4 consts (L68–75), `Plan` (L79–87), `AssignPlanRequest`; `UserProfile.PlanID` (L104) e `.Features` (L105) |
| middleware | `RequireFeature` (em `auth.go`) |
| handlers | `approval.go` L83–L198 (5 handlers de plano) |
| service | `approval.go::AssignPlan`; `constants.go` (constantes de feature) |
| repository | métodos de `plans` |
| main.go | 5 rotas (L161, L164–L167) + remover `RequireFeature` das 7 rotas que o usam (L211, 213, 231, 232, 235–237) |
| rules | bloco `plans` (L148–L151); `isPendingSelfProfile` L91–L92 tira `planID`/`features` |
| frontend | `PlansManager.tsx` (244L), `app/admin/page.tsx` L10+L140 |
| testes | `TestHandleDeletePlanInUse`, `TestHandleDeletePlanOK`, `TestAssignPlan`, `TestRequireFeature` |

**NÃO tocar:** `users` rules L100–L105 (só a allowlist muda); `auth.go` além
de `RequireFeature` — o resto de `Require`/`Allow` é auth.

⚠️ **Este é o momento de remover `StartDate`/`EndDate`.** Eles sobreviveram até
aqui só porque a nota era o consumidor (`cycleScoreFromData(cycle, userStart,...)`
em `service/cycle.go` L112, já removido na F1). Agora estão órfãos. Remover junto
em: `models/types.go` L98–L99, `service/profile.go`, `handlers/nutrition.go`
(`mergeStudentEdits`, `preserveAdminFields`), `repository` (`userProfileData`),
`firestore.rules` comentário L15, e a UI de edição no `StudentDetail`.
**Ver P4.**

**Gate:** mesmo bloco.

| Suíte | Antes | **Esperado depois** |
|---|---|---|
| Go | ~191 | **~185** (4 nomeados acima + os de `RequireFeature`/`Preserve*` que citarem `planID`/`features`) |
| Vitest | 126 | **~124** (se `PendingApprovals` pierde o select de plano) |
| E2E | 27 | 27 |

**Quebra se der errado:** `RequireFeature` é o gate de `diets` (L211, L213). Ao
removê-lo, **`GET /api/diets` passa a exigir só `RequireApproved`** — que é
exatamente o requisito novo ("libreleased = participante ativo"). Mas um
participante `paused` ainda passa (`isApprovedUser` aceita `paused` em
`firestore.rules` L53). **Conferir se `paused` deve ver dieta** → P5.

---

## Fase 4 — Remover o papel `nutritionist` e reduzir a ownership a admin

**A fase mais cara.** 51 ocorrências de `RoleNutritionist` em 15 arquivos Go,
200 em 19 arquivos de frontend, mais os testes.

### 4.1 Decisão de modelo (aplicar em todo o resto da fase)

**`NutritionistID` SAI do modelo. Não vira `ownerId`.**

Justificativa: com um único admin, `ownerId == auth.uid` é **tautologia** — não
pode falhar, logo não protege nada. E mantê-lo sugere multi-tenancy que não
existe, inviting o próximo dev a escrever `if ownerId != uid` e acreditar que
está checando algo. A simplificação real é **deletar a dimensão**, não renomeá-la.

```go
// ANTES (service/access.go L32)
func CanAccessResource(uid string, role models.Role, studentID, nutritionistID string) bool {
    if role == models.RoleAdmin { return true }
    if role == models.RoleStudent { return uid == studentID }
    if role == models.RoleNutritionist { return uid == nutritionistID }
    return false
}

// DEPOIS
func CanAccessResource(uid string, role models.Role, studentID string) bool {
    return role == models.RoleAdmin || uid == studentID
}
```

E **`CanAccessStudent` (L12) é removida**: com um só dono ela é idêntica a
`CanAccessResource` sem o campo extra. Duas funções com o mesmo predicado é uma
das fontes clássicas de bug de autorização — alguém conserta uma e esquece a
outra. Unificar em uma.

**Todos os call sites** de `canAccessResource(r, x.StudentID, x.NutritionistID)`
passam a `canAccessResource(r, x.StudentID)`. Buscar por `NutritionistID` em
`handlers/` e `service/`.

### 4.2 Ordem de execução

1. `models/types.go`: remove `RoleNutritionist` e `UserProfile.NutritionistID`
2. `middleware/auth.go`: tira `RoleNutritionist` do `Allow`/`RoleFrom`
3. `service/access.go`: aplica 4.1
4. `repository/repository.go`: remove os 4 `List*ForNutritionist` e o campo
   `nutritionistId` das queries; os `List*` (todos) ficam só para admin
5. `handlers/nutrition.go` + `program.go`: `RoleNutritionist` → só `RoleAdmin`;
   remove as checagens de posse (`ValidateProgramWorkoutOwnership`)
6. `main.go`: 20 `RoleNutritionist` → `RoleAdmin`
7. `firestore.rules`: `canViewStudentData` (L57–L65) → `isOwner || isAdmin`;
   `isPendingSelfProfile` (L88–L93) tira `nutritionistID`; comentário L12–L21
8. `firestore.indexes.json`: remove os 3 `nutritionistId+createdAt`
9. Frontend: `lib/auth.tsx` (10 ocorrências), `lib/types.ts`, `lib/api.ts` (26),
   `Sidebar` (14), `StudentDetail` (10), `StudentLayout` (5),
   `AdminAreaSwitch` (4), `DashboardLayout` (1), `ProgramForm` (1),
   `DietForm` (1), `WorkoutForm` (1)
10. **Mover** `app/nutritionist/*` → `app/admin/*` (8 rotas + `layout.tsx`)
11. `StudentDetail.tsx` (855L): cortar score+feed já foi F1/F2; agora cortar a
    coluna "nutricionista" e transformar "atribuir a nutricionista" em
    "vincular ao participante"
12. Testes: reescrever os de papel (ver abaixo)

**NÃO tocar:** `middleware/auth.go` além do `RoleNutritionist`; qualquer coisa
de auth no frontend sem P2 resolvida; os testes de acesso do aluno (são a âncora).

### 4.3 Testes: o que reescrever e o que nunca reescrever

⚠️ **"Reescrever teste para fazer código errado passar" é proibido.** Se um
teste cair, primeiro confirmar que o comportamento novo está certo.

**Reescrever o SUJEITO, manter a ASSERÇÃO** (o comportamento continua
importante, só mudou quem faz):

| Teste atual | Novo | Por que a asserção continua válida |
|---|---|---|
| `TestChainNutritionistCannotReadOtherNutritionistProgram` | `TestChainAdminCannotReadOtherStudentProgram` | **o caso que importa agora**: A não lê o recurso de B |
| `TestChainNutritionistCannotTransferWorkout` | admin não reatribui treino a outro aluno | ownership imutável (CLAUDE.md item 2) |
| `TestChainNutritionistCannotTransferDiet` | idem para dieta | idem |
| `TestChainNutritionistListStudentsRemainsScopedToOwn` | **REMOVER** — não há escopo, admin vê todos | o comportamento some de propósito |
| `TestChainAssignProgramToOtherNutritionistStudentForbidden` | admin não materializa para aluno alheio | vira `TestChainAssignProgramRejectsStudentWithoutAccess` |
| `TestChainNutritionistEditsUnassignedWorkout` | admin edita treino sem aluno | idem |
| `TestCanAccessResource` (service_test) | 3 papéis → 2 | reescrever a tabela |

**Preservar sem tocar no nome** (são a regra de acesso do §5 do prompt):

```
TestChainStudentCannotReadOtherStudentProgram
TestChainStudentCannotReadUnassignedDiet
TestChainStudentCannotReadUnassignedWorkout
TestChainStudentCannotCreateDietOrWorkout
TestChainStudentCannotCreateProgram
TestChainStudentCannotImportProgram
TestChainStudentCannotUpdateExercise / DeleteExercise
TestChainPendingUserCannotAccessPrograms
```

**Gate:**

| Suíte | Antes | **Esperado depois** |
|---|---|---|
| Go | ~185 | **~175** (TBD: contar os `TestChain*Nutritionist*` com `Select-String` antes de começar) |
| Regras | — | **TBD** (recontar `it()`) |
| Vitest | ~124 | **~110** (tira asserções de coluna nutricionista) |
| E2E | 27 | 27 |

⚠️ **Contagem honesta de referência:**
```powershell
# quantos testes citam o papel (este é o número que deve cair a ~0)
(Get-ChildItem -Recurse -File -Filter *_test.go backend |
  Select-String -Pattern 'Nutritionist').Count
```
Meta da fase: **0**.

**Quebra se der errado:** o modo de falha mais caro é o `Allow` ficar com
`RoleNutritionist` removido do enum mas ainda referenciado no `main.go` — o Go
não compila, então isso é seguro. O modo de falha silencioso é o **oposto**:
`canViewStudentData` continuar com a clause de nutricionista e a regra negar
leitura ao admin indevidamente — nesse caso o `firestore-tests` acusa, e é
exatamente para isso que ele existe.

---

## Fase 5 — Reduzir o participante a leitura

**Tema:** o participante não escreve nada.

**Arquivos tocados (~15):**

| Caminho | O que muda |
|---|---|
| `main.go` | remove `POST /api/workouts/complete` (L220), `GET /api/workout-history` (L219), `GET/PUT /api/diet-logs` (L231–232) |
| `handlers/nutrition.go` | remove `HandleListHistory` (L835) e `HandleCompleteWorkout` (L894) |
| `handlers/diet.go` | **arquivo inteiro** (195L) |
| `repository/repository.go` | remove `CreateHistoryEntry`, `ListHistory*`, `GetDietLog`, `PutDietLog`, `ListDietLogsForStudent` |
| `models/types.go` | remove `WorkoutHistoryEntry`, `CompleteWorkoutRequest`, `DietDailyLog`, `UpsertDietLogRequest`, `DietLogStatus`, `MealCheck`, `HistorySet`, `HistoryExercise` |
| `firestore.rules` | remove blocos `workoutHistory` (L141) e `dietLogs` (L123) |
| `firestore.indexes.json` | remove os **3** índices de `workoutHistory` + 1 de `dietLogs` |
| `frontend/components/TodayWorkout.tsx` | **REMOVER** (365L) |
| `frontend/components/RestTimer.tsx` | **REMOVER** (104L) |
| `frontend/components/DietCheck.tsx` | **REMOVER** (216L) |
| `frontend/lib/useNewCompletions.ts` | **REMOVER** (76L) |
| `frontend/components/student/StudentWorkoutsPage.tsx` | **RECRIAR** (219L → leitura pura) |
| `frontend/lib/api.ts` | remove `listHistory`, `listHistoryPage`, `completeWorkout`, `listDietLogs`, `putDietLog` |
| `e2e/aluno.spec.ts` | tira o caso de "finalizar treino" |

**NÃO tocar:** `app/(aluno)/layout.tsx`, `dashboard`, `programas`, `dietas`
(rotas); `StudentDashboard`, `StudentProgramsPage`; `StudentDietPage` só perde
o `DietCheck`.

⚠️ **Esta fase é a que mais incomoda o usuário, e é intencional.** O
participante deixa de poder marcar treino feito e registrar refeição. Isso
cai por consequência de "read-only" + "sem gamificação", não por escolha minha —
mas é uma decisão de produto disfarçada de consequência técnica. **→ P6.**

**Gate:** mesmo bloco.

| Suíte | Antes | **Esperado depois** |
|---|---|---|
| Go | ~175 | **~173** (só 2 testes: `TestDietLogDataPreserves*` já saíram na F1) |
| Vitest | ~110 | **~100** (StudentDietPage -6, recria-se teste do `StudentWorkoutsPage` de leitura) |
| E2E | 27 | **~25** |

**Quebra se der errado:** a tela de treinos do participante fica em branco se
`StudentWorkoutsPage` for removido sem recriação. É o único ponto desta fase que
**não** é dado de backend — é UX, e não tem teste de compilação que pegue.

---

## Fase 6 — Modelo final + reindexação

**Arquivos tocados:**

| O quê | Antes | Depois |
|---|---|---|
| Coleções Firestore | **11** | **6** (`users`, `workouts`, `programs`, `diets`, `exercises`, + `users/{uid}/{subcollection}` **se P1 = preservar**) ou **5** |
| Índices compostos | **11** | **3** |
| Rotas Go | **63** | **39** (P1 preservar) / **33** (P1 remover) |
| Linhas Go | 12.930 | **~7.500** |
| Linhas TS/TSX | 16.737 | **~11.000** |

**NÃO tocar:** `firestore.rules` L100–L105, L108–L110, L129–L140, L157–L160.
Essas regras já estão corretas e são a garantia de que o SDK de cliente não
toca dado de negócio.

**Tarefas:**
1. Aplicar `scripts/strip-legacy-fields.ts` **opcional** — remove
   `nutritionistId`/`planID`/`features` de documentos existentes. Não é
   necessário para funcionar; é higiene. O campo vira inerte.
2. Deploy da nova `firestore.rules` + `firestore.indexes.json`.
3. **Não** apagar `workoutHistory`/`dietLogs`/`posts`/`plans` de produção sem
   autorização explícita → **P6**.

**Gate:** o gate completo (7 suítes) + `next build`.

**Quebra se der errado:** remover um índice que ainda é usado por uma query faz
a query falhar em produção com `FAILED_PRECONDITION: missing index` — e **só**
em produção, porque o emulador não exige índice composto. Por isso o gate de
regras roda contra emulador mas o risco de índice é de deploy.

---

## Fase 7 — Provar a regra de acesso com teste

**Tema:** o §5 do prompt exige **teste**, não afirmação. Esta fase existe
porque "está no backend" não é prova — foi assim que os 2 bugs da F19
apareceram.

### 7.1 Cenário obrigatório (Go, integração, sem emulador)

Já existe a infraestrutura: `main_test.go` monta o `mux` real por
`registerRoutes` com repositório fake (L133–L134 do `main.go`). Os testes
`TestChain*` já autenticam com token e batem na rota.

```
Dado:  participante A (approved) e participante B (approved), cada um com
       1 programa, 1 treino e 1 dieta próprios (studentId = próprio uid)
Quando: A chama, com o token DE A:
         GET /api/programs/{id de B}      => 403 (ou 404)
         GET /api/workouts/{id de B}      => 403 (ou 404)
         GET /api/diets/{id de B}         => 403 (ou 404)
         GET /api/students/{id de B}      => 403 (ou 404)
Então:  nenhum corpo de B é devolvido
```

⚠️ **Verificar a escolha de 403 vs 404.** Hoje `HandleGetWorkout` (L385–L391)
devolve **404 se o recurso não existe** e **403 se existe mas é de outro** —
isso é *resource enumeration*: o atacante descobre que o ID existe. A
recomendação é **404 nos dois casos** (`if !podeAcessar { 404 }`). Isso é uma
mudança de comportamento deliberada → **P7**.

### 7.2 Cenário obrigatório (Firestore, emulador)

`firestore-tests/rules.test.js`: participant A lendo `workouts/{de B}`,
`programs/{de B}`, `diets/{de B}` — **negado**. E continua **negado** para admin
via SDK cliente (L129–L140 são `if false`: a garantia é que o SDK cliente não
alcança dado de negócio, independentemente de role).

### 7.3 Cenário E2E

`e2e/autorizacao.spec.ts` (5 testes, já existe) — **revisar e estender**: ele
hoje cobre o eixo "A não é B" no papel nutricionista; adapting para 2 papéis.

**Gate:** os três, verdes. Este é o gate de **aceitação** do projeto.

**Quebra se der errado:** o teste passar sem provar nada — ex.: se o fake de
`users` devolver role `admin` para todo mundo, todo teste de 403 falha (barulhento,
ok) ou todo teste de 200 passa (silencioso, **perigo**). O teste precisa ter
**um caso positivo e um negativo** para o mesmo recurso: A lê o próprio (200) e
o de B (403). Sem o positivo, o 403 não prova nada.

---

## Ordem, dependências e resumo

```
F0  corrigir .gates                        15 min   sem risco
F1  gamificação                           ~2 h      40 arquivos   Go 208→201
F2  comunidade                            ~2 h      30 arquivos   Go 201→191
F3  planos + features                     ~1,5 h    25 arquivos   Go 191→185
F4  papel nutricionista                   ~6 h      51 arquivos   Go 185→~175  ← a cara
F5  participante read-only                ~3 h      15 arquivos   Go ~175→~173
F6  modelo final + reindexação            ~1 h      config        11→3 índices
F7  provar a regra de acesso              ~2 h      3 arquivos    gate de aceitação
```

Estimativa total: **~18 h de execução**, mais revisão. Os números "Go →" são
**named tests** que saem (verificado no `01-baseline.md` §10); onde marco TBD,
é porque depende de testes que ainda não caíram — **medir na fase, não estimar**.

**Antes de começar a F1**, as respostas de `04-perguntas.md` precisam estar
resolvidas, porque **P1 e P2 mudam o escopo de todas as fases**.
