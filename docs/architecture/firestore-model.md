# Modelo de dados — Firestore

Status: Mapeamento do modelo V1 + direção V2 (Fase 0).
Fonte: `backend/repository/repository.go`, `backend/models/types.go`,
`firestore.rules`, `firestore.indexes.json`.

## Convenções

- IDs: documentos usam auto-IDs (`Add`) ou chaves determinísticas
  (`users/{uid}`, `dietLogs/{studentID}_{date}`, `scores/{uid}`).
- Timestamps: `createdAt`/`updatedAt` via `firestore.ServerTimestamp`
  (**exceção**: `createdAt` preservado quando != zero — V1 corrigiu para
  perfil em `userProfileData`; `PutDietLog` ainda regrava → **corrigir no V2**).
- Datas de negócio: strings `YYYY-MM-DD` no fuso `America/Recife`.

## Coleções

| Coleção | Documento | Chave | Escrita |
|---|---|---|---|
| `users/{uid}` | UserProfile | uid Firestore/Firebase | API Go (admin fields) + regra p/ dono |
| `users/{uid}/sessions/{week_day}` | Session (modo original) | `{week}_{day}` | API Go |
| `users/{uid}/prs/main` | PR | fixo "main" | API Go |
| `users/{uid}/state/current` | AppState | fixo "current" | API Go |
| `plans/{planId}` | Plan | auto | API Go (admin) |
| `workouts/{id}` | WorkoutDefine (exercises embutidos) | auto | API Go |
| `diets/{id}` | Diet (meals/foods embutidos, ou content) | auto | API Go |
| `workoutHistory/{id}` | WorkoutHistoryEntry | auto | API Go |
| `posts/{id}` | Post (likes map, comments array) | auto | API Go |
| `dietLogs/{studentID_date}` | DietDailyLog | determinística | API Go |
| `scores/{uid}` | ScoreRecord | uid | API Go |
| `scores_history/{uid}/cycles/{cycleID}` | ScoreHistoryEntry | cycleID | API Go |

## Detalhes por entidade

### UserProfile (`users/{uid}`)
```
id, name, email, photoURL, bio, role (admin|nutritionist|student),
nutritionistID, startDate, endDate, status, createdAt,
planID, features[], authProvider, approvedBy, approvedAt, rejectedReason
```
- Status: `pending_approval`, `active`, `paused`, `inactive`, `rejected`.
- Criação: **sempre `pending_approval`** sem campos administrativos
  (regra `isPendingSelfProfile`); admin define role/plano/status.
- `features[]` é **snapshot** do plano no momento da atribuição.

### Plan (`plans/{planId}`)
```
name, description, features[] (workouts|diet|community|ranking), active,
createdAt, updatedAt
```
- `workouts` (treino) é sempre liberado; plano adiciona as demais features.
- Exclusão bloqueada (409) quando algum aluno usa (`CountStudentsWithPlan`).

### WorkoutDefine (`workouts/{id}`)
```
studentId, nutritionistId, name, description, objective, dayOfWeek,
exercises[] {id, name, description, sets, repetitions, weight, restSeconds,
            videoUrl, notes, order}, createdAt, updatedAt
```
- Ownership: nutricionista não transfere para outro nutricionista via body
  (backend força o `NutritionistID` do registro — seção 3.4, já corrigido).
- Pode existir como **template** (studentId vazio) para duplicar depois.

### Diet (`diets/{id}`)
```
studentId, nutritionistId, name, description, startDate, endDate,
content (texto livre) OU meals[] {id, name, time, notes, order, foods[]},
createdAt, updatedAt
```

### WorkoutHistoryEntry (`workoutHistory/{id}`)
```
studentId, workoutId, workoutName, nutritionistId, completedAt,
duration, exercisesCompleted, totalExercises,
exercises[] {name, order, sets[] {weight, reps, done}, note}
```

### Post (`posts/{id}`)
```
userId, userName, userPhotoURL, type (workout|diet|text), text,
workoutId, workoutName, dietId, dietName, date,
likes map[uid]bool, likeCount, comments[] PostComment, deleted,
moderatedBy, moderatedAt, createdAt, updatedAt
```
- Comentário: `id, userId, userName, userPhotoURL, text, createdAt, deleted,
  moderatedBy, moderatedAt` (soft delete p/ moderação).
- **Race condition conhecida** (3.5): `UpdatePost` = read-modify-write sem
  transação. V2: usar `RunTransaction`/incremento atômico.

### DietDailyLog (`dietLogs/{studentID_date}`)
```
studentId, nutritionistId, dietId, dietName, date, status
(not_followed|partial|followed), mealChecks[] {mealId, mealName, followed,
note, updatedAt}, note, caption, postId, createdAt, updatedAt
```
- `PutDietLog` regrava `createdAt: ServerTimestamp` **a cada save** (sobrescreve
  a data de criação original) — achado adicional, corrigir no V2.

### ScoreRecord / ScoreHistoryEntry
```
scores/{uid}: studentId, rawPoints, cycleId ("2026-Q3"), cycleStart, score,
             daysElapsed, daysCompleted, updatedAt
scores_history/{uid}/cycles/{cycleID}: studentId, cycleId, startDate, endDate,
             rawPoints, days, score, recordedAt
```
- Ciclo: trimestre civil (`cycleFor`); fechamento preguiçoso arquiva quando o
  ciclo muda (`RecomputeScore`).

## Índices compostos (`firestore.indexes.json` — 9 versionados)

| # | Coleção | Campos | Direção | Query que usa |
|---|---|---|---|---|
| 1 | posts | userId, type, createdAt | Asc, Asc, Desc | `FindAutoPostToday` |
| 2 | dietLogs | studentId, date | Asc, Desc | `ListDietLogsForStudent` |
| 3 | workouts | nutritionistId, createdAt | Asc, Desc | `ListWorkoutsForNutritionist` |
| 4 | workouts | studentId, createdAt | Asc, Desc | `ListWorkoutsForStudent` |
| 5 | diets | nutritionistId, createdAt | Asc, Desc | `ListDietsForNutritionist` |
| 6 | diets | studentId, createdAt | Asc, Desc | `ListDietsForStudent` |
| 7 | workoutHistory | studentId, completedAt | Asc, Desc | `ListHistoryForStudent` |
| 8 | workoutHistory | nutritionistId, completedAt | Asc, Desc | `ListHistoryForNutritionist` |
| 9 | workoutHistory | studentId, completedAt | Asc, Asc | `ListHistoryForStudentSince` |

> **Achado da Fase 0 (3.2/3.3 adicional):** a query `ListStudents` em
> `repository.go` combina `role == student` **e** `nutritionistID == uid`
> (dois filtros de igualdade), o que exige um índice composto
> `users(role ASC, nutritionistID ASC)` — **ausente do arquivo versionado**.
> O endpoint `/api/students` do nutricionista funciona em produção, então o
> índice deve ter sido criado manualmente no console (como o de dietLogs, que
> o README documenta como `gcloud firestore indexes composite create`). **V2
> exige que TODOS os índices estejam versionados em `firestore.indexes.json`**
> e testados por regras/Emulator.

V1 aprendeu na prática (README): falta de índice → `FAILED_PRECONDITION:
the query requires an index` e 500 em produção (diet-logs). **V2 testa com
Emulator** e exige que o arquivo de índices seja a fonte da verdade.

## Regras de segurança (firestore.rules)

- `users/{uid}`: dono lê/escreve dados próprios SEM campos administrativos;
  create só via `isPendingSelfProfile`; admins sobrescrevem; delete admin.
- `users/{uid}/{sub}/...`: somente o dono (modo original).
- `posts`: leitura autenticada; autor cria/edita/apaga; moderador (nutri/admin)
  edita/apaga.
- `dietLogs`: aluno e seu nutricionista leem; aluno/admin escrevem.
- `workouts`, `diets`, `workoutHistory`: **negados a clientes** (só API Go).
- `plans`: leitura autenticada; escrita admin.
- `scores`, `scores_history`: leitura autenticada/dono+nutri/admin; escrita
  somente API.
- A API Go usa Admin SDK (ignora rules) — regras são camada extra.

## Notas para o V2 (direção)

1. **Transações**: substituir read-modify-write (posts, dietLogs) por
   `RunTransaction`/algoritmos atômicos.
2. **createdAt imutável**: preservar em toda atualização (padronizar
   `userProfileData` para todas as entidades).
3. **Emulator**: configurar `firebase.json` + testes de regras (o plano exige).
4. **Índices**: manter `firestore.indexes.json` sincronizado; qualquer query
   nova passa por teste de regras/emulator.
5. Modelo de dados pode evoluir na V2 (nunca romper o backend V1 em produção —
   ver `docs/progress.md` para a estratégia de migração/versionamento).