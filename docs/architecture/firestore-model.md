> Estado local F6 (30/09/2026): cinco coleções vivas e três índices compostos.
> Gamificação, comunidade, planos, histórico e diário retirados do código.
> Aluno consulta treinos/dietas; gestão usa admin. Trechos V1 abaixo são
> históricos; contrato atual em docs/reports/simplificacao-f6-reindex-plan.md.
> Nada publicado nem apagado em produção.

# Modelo de dados — Firestore

Status: Mapeamento do modelo V1 + direção V2 (Fase 0).
Fonte: `backend/repository/repository.go`, `backend/models/types.go`,
`firestore.rules`, `firestore.indexes.json`.

> **Estado da refatoração**: o plano vive em `docs/simplificacao/03-plano.md`
> (decisões de produto em aberto em `docs/simplificacao/04-perguntas.md` —
> P1–P8, com P1/P2 bloqueantes). **F4 (papel `nutritionist` → `admin`) já foi
> executado, ainda sem commit**; F1 (gamificação), F2 (comunidade), F3
> (planos/features), F5 (escrita do participante), F6 (modelo final +
> reindex) e F7 (provar a regra de acesso) estão **planejados, não
> executados**. Este documento descreve o código de HOJE.

## Convenções

- IDs: documentos usam auto-IDs (`Add`) ou chaves determinísticas
  (`users/{uid}`, `dietLogs/{studentID}_{date}`, `scores/{uid}`).
- Timestamps: `createdAt`/`updatedAt` via `firestore.ServerTimestamp`
  (**exceção**: `createdAt` preservado quando != zero em `userProfileData` e
  `dietLogData`; `UpdateWorkout`/`UpdateDiet` usam `Set(..., MergeAll)` sem
  `createdAt`, logo também não o sobrescrevem).
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
| `exercises/{id}` | ExerciseItem (biblioteca global) | auto | API Go |
| `diets/{id}` | Diet (meals/foods embutidos, ou content) | auto | API Go |
| `workoutHistory/{id}` | WorkoutHistoryEntry | auto | API Go |
| `posts/{id}` | Post (likes map, comments array) | auto | API Go |
| `dietLogs/{studentID_date}` | DietDailyLog | determinística | API Go |
| `scores/{uid}` | ScoreRecord | uid | API Go |
| `scores_history/{uid}/cycles/{cycleID}` | ScoreHistoryEntry | cycleID | API Go |
| `programs/{id}` | TrainingProgram (referências ordenadas a WorkoutDefine) | auto | API Go (admin) |

> **Remoções planejadas pela simplificação (F1–F3), ainda presentes no
> código**: as coleções `scores`, `scores_history` (F1 gamificação),
> `posts` (F2 comunidade) e `plans` (F3 planos/features) existem e são
> usadas hoje — a remoção está **planejada, não executada**.

## Detalhes por entidade

### UserProfile (`users/{uid}`)
```
id, name, email, photoURL, bio, role (admin|student),
startDate, endDate, status, createdAt,
planID, features[], authProvider, approvedBy, approvedAt, rejectedReason
```
- Papéis: **2 apenas** — `RoleAdmin = "admin"` e `RoleStudent = "student"`
  (`backend/models/types.go:12-15`). `RoleNutritionist` e o campo
  `nutritionistID` **não existem mais** em `UserProfile`
  (`backend/models/types.go:53-72`).
- Status: `pending_approval`, `active`, `paused`, `inactive`, `rejected`.
- Criação: **sempre `pending_approval`** sem campos administrativos
  (regra `isPendingSelfProfile`); admin define role/plano/status.
- `features[]` é **snapshot** do plano no momento da atribuição
  (remoção planejada — F3, ainda presente no código).

### Plan (`plans/{planId}`) — presente hoje, remoção planejada (F3)
```
name, description, features[] (workouts|diet|community|ranking), active,
createdAt, updatedAt
```
- `workouts` (treino) é sempre liberado; plano adiciona as demais features.
- Exclusão bloqueada (409) quando algum aluno usa (`CountStudentsWithPlan`).
- **Ainda existe no código**: `plans` é removido apenas no plano F3
  (`docs/simplificacao/03-plano.md`) — ainda não executado.

### WorkoutDefine (`workouts/{id}`)
```
studentId, name, description, objective, dayOfWeek,
exercises[] {id, name, description, sets, repetitions, weight, restSeconds,
            videoUrl, notes, order}, createdAt, updatedAt
```
- Sem `nutritionistId` no documento (`backend/models/types.go:78-88`).
- Ownership: o vínculo não é transferível via body (campo não existe mais).
- Pode existir como **template** (studentId vazio) para duplicar depois.

### ExerciseItem (`exercises/{id}` — biblioteca global, F5)
```
id, name, description, muscleGroup, equipment, videoUrl,
createdAt, updatedAt
```
- Catálogo GLOBAL compartilhado (sem ownerId). Admin mantêm;
  alunos apenas consultam.
- Listagem ordenada por `name` (índice automático de campo único — nenhum
  índice composto manual).
- Ao selecionar num treino, os dados são **copiados** para `WorkoutExercise`
  (snapshot) — a biblioteca nunca vira referência viva; alterar/excluir o
  exercício não afeta treinos existentes.

### Diet (`diets/{id}`)
```
studentId, name, description, startDate, endDate,
content (texto livre) OU meals[] {id, name, time, notes, order, foods[]},
createdAt, updatedAt
```
- Sem `nutritionistId` no documento (`backend/models/types.go:165-176`).

### TrainingProgram (`programs/{id}` — F19)
```
id, name, description, objective, notes, source,
studentId, workouts[] {workoutId, order, label, name, dayOfWeek},
createdAt, updatedAt
```
- Sem `nutritionistId` no documento (`backend/models/types.go:115-126`).
- Um programa de treino **NÃO é entidade nova**: cada elemento de `workouts[]`
  é uma referência a um `WorkoutDefine` já existente em `workouts/{id}`.
  O programa guarda apenas uma lista ordenada de referências (`ProgramWorkout`).
  Isso mantém uma única implementação de treino (histórico, execução, impressão,
  UI do aluno continuam apontando para `workouts/{id}`) e permite reordenar,
  duplicar e reatribuir materializando cópias.
- `studentId` vazio = programa de biblioteca (admin); definido = programa
  atribuído a um aluno (cópia dos treinos via assign).
- `notes` armazena PRs, periodização e estrutura semanal **verbatim** do markdown.
- `source` indica a origem da importação (ex.: `"treino.md"`).
- Ownership: `studentId` é tratado como incondicional do registro no
  `PUT /api/programs/{id}` (reatribuição só via `POST /assign`).
- Acesso cliente: **totalmente negado** (`allow read, write: if false`) —
  todo acesso passa pela API Go (Admin SDK).

### WorkoutHistoryEntry (`workoutHistory/{id}`)
```
studentId, workoutId, workoutName, completedAt,
duration, exercisesCompleted, totalExercises,
exercises[] {name, order, sets[] {weight, reps, done}, note}
```
- Sem `nutritionistId` no documento (`backend/models/types.go:215-225`).

### Post (`posts/{id}`) — presente hoje, remoção planejada (F2)
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
studentId, dietId, dietName, date, status
(not_followed|partial|followed), mealChecks[] {mealId, mealName, followed,
note, updatedAt}, note, caption, postId, createdAt, updatedAt
```
- Sem `nutritionistId` no documento.
- `dietLogData` preserva `createdAt` quando o log já tem data (só usa
  `ServerTimestamp` em log novo) — mesma regra do `userProfileData` (corrigido
  na Fase 1; regressão em `repository_test.go`).

### ScoreRecord / ScoreHistoryEntry — presentes hoje, remoção planejada (F1)
```
scores/{uid}: studentId, rawPoints, cycleId ("2026-Q3"), cycleStart, score,
             daysElapsed, daysCompleted, updatedAt
scores_history/{uid}/cycles/{cycleID}: studentId, cycleId, startDate, endDate,
             rawPoints, days, score, recordedAt
```
- Ciclo: trimestre civil (`cycleFor`); fechamento preguiçoso arquiva quando o
  ciclo muda (`RecomputeScore`).

## Índices compostos (`firestore.indexes.json` — 11 versionados)

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
| 10 | programs | nutritionistId, createdAt | Asc, Desc | `ListProgramsForNutritionist` |
| 11 | programs | studentId, createdAt | Asc, Desc | `ListProgramsForStudent` |

> **Dívida técnica (F6 — reindex, ainda não executada):** os **4 índices
> por `nutritionistId`** ainda estão versionados em `firestore.indexes.json`
> (workouts L20-27, programs L36-43, diets L52-59, workoutHistory L76-83),
> mas as queries que os usavam — `ListWorkoutsForNutritionist`,
> `ListDietsForNutritionist`, `ListProgramsForNutritionist` e
> `ListHistoryForNutritionist` — **não existem mais** em
> `backend/repository/repository.go` (sobraram só as variantes
> `...ForStudent` e `ListStudentsAll`, `repository.go:232-233`). Os índices
> são órfãos do campo `nutritionistId`, removido dos modelos em F4;
> o reindex para removê-los é F6, ainda planejado.

> **Achado da Fase 0 (3.2/3.3 adicional) — superado:** a query `ListStudents`
> em `repository.go` combinava `role == student` **e** `nutritionistID == uid`
> e exigia um índice composto `users(role ASC, nutritionistID ASC)` ausente
> do arquivo versionado. Essa query **não existe mais**: hoje
> `GET /api/students` usa `ListStudentsAll` (`backend/handlers/nutrition.go:300`
> e `repository.go:233`), sem filtro de vínculo. **V2 exige que TODOS os
> índices estejam versionados em `firestore.indexes.json`** e testados por
> regras/Emulator.

V1 aprendeu na prática (README): falta de índice → `FAILED_PRECONDITION:
the query requires an index` e 500 em produção (diet-logs). **V2 testa com
Emulator** e exige que o arquivo de índices seja a fonte da verdade.

## Regras de segurança (firestore.rules)

Camada extra sobre a API Go (que usa Admin SDK e ignora as regras) — bloqueia
acesso direto do cliente ao Firestore. Estado real (endurecido 20 set 2026,
Fase 1 + hardening pré-F13):

- `users/{uid}`: dono LÊ o próprio perfil; CRIA só o próprio perfil
  `pending_approval` SEM campos administrativos (`isPendingSelfProfile` —
  role/planID/features/approvedBy/approvedAt/rejectedReason =
  negado); ATUALIZA só os campos da allowlist estrita
  (`allowedSelfProfileUpdate` com `affectedKeys().hasOnly(['name','email',
  'photoURL','bio'])` — qualquer outro campo, inclusive `createdAt` e
  `authProvider`, nega o update INTEIRO, mesmo combinado com campos legítimos);
  DELETE negado até para admin (exclusão só pela API Go).
- `users/{uid}/{sub}/...`: somente o dono (modo original).
- `posts`, `plans`: LEITURA para usuário aprovado (`isApprovedUser` — status
  `""|active|paused` ou admin; `pending_approval`/`rejected`/`inactive` ficam
  fora); ESCRITA somente API Go (negada a clientes, inclusive admin).
- `exercises`: LEITURA para usuário aprovado (aluno consulta); ESCRITA somente
  API Go (negada a clientes — aluno e admin).
- `dietLogs`, `scores_history`: leitura do próprio aluno + admin
  (`canViewStudentData` = dono + admin, `firestore.rules:89-96` — modelo de
  2 papéis, sem terceiro papel de gestão); escrita só API Go.
- `workouts`, `diets`, `workoutHistory`, `scores`: **negados a clientes**
  (leitura e escrita — só API Go).
- `programs`: **negados a clientes** (leitura e escrita — só API Go).
  Todo acesso de programas passa pela API Go (Admin SDK ignora as regras).
- Toda escrita de dados de negócio passa pela API Go desde 20 set 2026 (regras
  testadas no Emulator — `firestore-tests/`, **86 testes**).

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
