# 01 — Baseline medido (estado ATUAL)

> Todos os números abaixo foram **medidos** com comando, não estimados.
> Data da medição: 2026-09-28. Comando e saída estão em `docs/simplificacao/00-comandos.md`.
> Regra: se um número não foi medido, está escrito `TBD`.

---

## 1. Tamanho do código

| Métrica | Valor medido |
|---|---|
| Arquivos `.go` + `.ts` + `.tsx` (sem `node_modules`/`.next`/`vendor`) | **167** |
| Linhas totais | **29.667** |
| Arquivos Go | **48** (33 de implementação + 15 de teste) |
| Linhas Go | **12.930** |
| Arquivos `.ts`/`.tsx` | **119** |
| Linhas `.ts`/`.tsx` | **16.737** |

> A contagem por pasta de `.ts`/`.tsx` soma 16.530; a diferença de 207 linhas são
> 4 arquivos de rota dinâmica cujo nome contém `[id]` e que o `Get-Content`
> padrão não lê (interpretado como wildcard). Medidos individualmente:
> `(aluno)/programas/[id]` 18L, `nutritionist/programs/[id]` 18L,
> `nutritionist/students/[studentId]` 58L, `profile/[id]` 92L = 186L, mais os
> arquivos `.css` do grupo `(aluno)` (844 + 295 + 207 = 1.346L) lidos na
> contagem por pasta.

## 2. Gates (verificados hoje — `.gates`)

| Gate | Estado | Timestamp em `.gates` |
|---|---|---|
| `go vet` | limpo | 2026-09-28T02:58 |
| `go test` | **208 PASS** | 2026-09-28T02:58 |
| Vitest | **131 PASS** (20 arquivos) | 2026-09-28T03:05 |
| Regras Firestore | `.gates` diz **76 PASS** | 2026-09-28T03:00 |
| Playwright E2E | **30 PASS** (10 arquivos) | 2026-09-28T02:47 |
| `tsc --noEmit` | OK | 2026-09-28T02:55 |
| `next lint` | 0/0 | 2026-09-28T02:55 |
| `next build` | OK | 2026-09-28T03:07 |

### ⚠️ Discrepância encontrada (não é erro meu, é do `.gates`)

`firestore-tests/rules.test.js` tem **64 blocos `it()`** em **15 `describe()`**
(medido por `Select-String`). O arquivo `.gates` registra **76**. Nenhum dos
dois números foi inventado — mas **não são o mesmo número**. Provável causa: o
`.gates` contou asserções ou testes de um estado anterior do arquivo.

**Consequência para o plano:** o gate da Fase 2+ não pode ser "76 → 76". Tem de
ser o número que `npm test` imprimir, conferido contra `it()` no arquivo.
Corrigir o `.gates` é tarefa da Fase 0.

## 3. Superfície da API Go

- **Rotas registradas: 63** (`backend/main.go`, 63 `mux.HandleFunc`, L136–L237).
  > Um subagente de busca reportou "47 rotas" e errou. O número confiável é 63,
  > conferido contando as linhas. Isso é exatamente o risco do bloco 12.
- Cadeia de middlewares (`main.go` L71–L78): `Recover` → `MaxBody` →
  `RateLimit` → `CORS` → `SecurityHeaders` → `mux`. **Preservar.**

### 63 rotas por tema

| Tema | Rotas | Rotas |
|---|---|---|
| health | 1 | `GET /health` |
| **modo original V1** (sessions/prs/state) | **6** | `GET/PUT /api/sessions/{week}/{day}`, `GET/PUT /api/prs`, `GET/PUT /api/state` |
| perfil próprio | 2 | `GET/PUT /api/me` |
| usuários (admin) | 5 | `GET/POST /api/users`, `GET/PUT/DELETE /api/users/{id}` |
| aprovação (admin) | 3 | `GET /api/users/pending`, `POST /api/users/{id}/approve`, `POST /api/users/{id}/reject` |
| **planos** | **5** | `POST /api/users/{id}/assign-plan` + CRUD `/api/plans` (4) |
| **papel nutricionista** | 3 | `GET /api/students`, `GET /api/students/{id}`, `PUT /api/students/{id}` |
| treinos | 7 | `GET/POST /api/workouts`, `GET/PUT/DELETE /api/workouts/{id}`, `POST /api/workouts/{id}/duplicate`, `POST /api/workouts/complete` |
| programas | 8 | `GET/POST /api/programs`, `POST /api/programs/import`, `GET/PUT/DELETE /api/programs/{id}`, `POST /api/programs/{id}/assign`, `POST /api/programs/{id}/duplicate` |
| exercícios | 5 | `GET/POST /api/exercises`, `GET/PUT/DELETE /api/exercises/{id}` |
| dietas | 6 | `GET/POST /api/diets`, `GET/PUT/DELETE /api/diets/{id}`, `POST /api/diets/{id}/duplicate` |
| **histórico de treino** | **2** | `GET /api/workout-history`, `POST /api/workouts/complete` |
| **comunidade** | **6** | `POST/GET /api/posts`, `POST /api/posts/{id}/like`, `POST /api/posts/{id}/comments`, `DELETE /api/posts/{id}/comments/{cid}`, `DELETE /api/posts/{id}` |
| **log de dieta** | **2** | `GET/PUT /api/diet-logs` |
| **ranking/score/perfil público** | **3** | `GET /api/ranking`, `GET /api/scores/history`, `GET /api/public/profile/{id}` |

**A remover por tema: 3 + 5 + 6 + 6 + 2 + 2 = 24 rotas** (38% da API).
Fora do escopo das decisões 1–5: as 6 rotas de "modo original" (L139–L144) →
vira pergunta bloqueante.

## 4. Distribuição de linhas Go (implementação, sem testes)

| Arquivo | Linhas | Nota |
|---|---|---|
| `backend/repository/repository.go` | **1.337** | arquivo mais pesado; concentra score, social, planos, histórico |
| `backend/handlers/nutrition.go` | **966** | 27 handlers: me, users, students, workouts, diets, history |
| `backend/models/types.go` | 514 | 45 structs |
| `backend/programmd/parser.go` | 503 | import markdown — **preservar** |
| `backend/cmd/e2eseed/main.go` | 355 | seed E2E (inclui asserções de score, L291–L310) |
| `backend/handlers/program.go` | 337 | programas |
| `backend/handlers/social.go` | 336 | comunidade — remover |
| `backend/main.go` | 238 | rotas |
| `backend/handlers/approval.go` | 214 | aprovação + **CRUD de planos** |
| `backend/handlers/diet.go` | 195 | log de dieta — remover |
| `backend/handlers/handlers.go` | 189 | modo original (sessions/prs/state) |
| `backend/middleware/http.go` | 194 | CORS/rate limit/headers — preservar |
| `backend/middleware/auth.go` | 193 | **preservar** |
| `backend/handlers/diet.go`/`exercise.go` | 112 | |
| `backend/handlers/scores.go` | 112 | remover |
| `backend/service/cycle.go` | 128 | ciclo de nota — remover |
| `backend/service/score.go` | 118 | remover |
| `backend/service/program.go` | 382 | preservar (simplificar) |
| `backend/service/approval.go` | 106 | preservar |
| `backend/service/social.go` | 106 | remover |
| `backend/service/constants.go` | 62 | revisar (constantes de feature?) |
| `backend/service/public.go` | 61 | remover |
| `backend/service/diet.go` | 48 | revisar |
| `backend/service/ranking.go` | 45 | remover |
| `backend/service/profile.go` | 44 | preservar |
| `backend/service/access.go` | 43 | **simplificar** (núcleo da regra de acesso) |
| `backend/service/errors.go` | 40 | preservar |
| `backend/service/normalize.go` | 23 | preservar |
| `backend/service/timezone.go` | 25 | **preservar** (item 3 do CLAUDE.md) |
| `backend/service/service.go` | 17 | preservar |
| `backend/config.go` | 84 | preservar |
| `backend/cmd/programimport/main.go` | 172 | CLI de import — preservar |

## 5. Papéis e `RoleNutritionist` — medição real

O prompt estimava "30 ocorrências em 13 arquivos". **Medido: 51 ocorrências em
15 arquivos** (o número real é maior que o estimado — bom, o plano fica mais
realista).

| Ocorrências | Arquivo |
|---|---|
| **20** | `backend/main.go` (as `a.Allow(models.RoleNutritionist, ...)`) |
| **12** | `backend/handlers/nutrition.go` |
| **5** | `backend/handlers/program.go` |
| 2 | `backend/service/access.go` |
| 2 | `backend/service/service_test.go` |
| 1 cada | `models/types.go`, `handlers/approval.go`, `handlers/social.go`, `handlers/scores.go`, `handlers/diet.go`, `middleware/auth.go`, `handlers/nutrition_test.go`, `handlers/approval_test.go`, `middleware/auth_test.go`, `main_test.go` |

No frontend, `"nutritionist"` (case-insensitive) aparece **200 vezes** em
**19 arquivos de implementação** + arquivos de teste. Maiores Concentration:

| Ocorrências | Arquivo |
|---|---|
| 49 | `frontend/app/nutritionist/*/page.tsx` somados |
| 26 | `frontend/lib/api.ts` |
| 14 | `frontend/components/Sidebar.tsx` |
| 10 | `frontend/components/StudentDetail.tsx` |
| 10 | `frontend/lib/auth.tsx` |
| 9 | `frontend/lib/types.ts` |
| 5 | `frontend/components/StudentLayout.tsx` |
| 4 | `frontend/components/DemoRoleSwitch.tsx` |

## 6. Modelo de dados

### `UserProfile` — `backend/models/types.go` L90–L110 (17 campos)

| Campo | Destino | Justificativa medida |
|---|---|---|
| `ID`, `Email`, `CreatedAt` | **PRESERVAR** | auth |
| `Name` | **PRESERVAR** | identificação na fila de aprovação |
| `Role` | **PRESERVAR** (2 valores) | admin/student |
| `Status` | **PRESERVAR** | `pending_approval` → `active`/`paused`/`inactive`/`rejected` |
| `ApprovedBy`, `ApprovedAt`, `RejectedReason` | **PRESERVAR** | fluxo de aprovação (decisão 5) |
| `AuthProvider` | **PRESERVAR** | regra `allowedSelfProfileUpdate` o exclui |
| `NutritionistID` (L97) | **REMOVER** | vínculo aluno↔nutricionista; sem papel, não tem sentido |
| `PlanID` (L104) | **REMOVER** | decisão 4 |
| `Features` (L105) | **REMOVER** | decisão 4 |
| `StartDate` (L98), `EndDate` (L99) | **REMOVER** | alimentavam o denominador da nota: `cycleScoreFromData(cycle, userStart, ...)` em `service/cycle.go` L112. Sem score, **nenhum consumidor** |
| `Bio` (L95) | **REMOVER** | decisão 3 (perfil público sai) |
| `PhotoURL` (L94) | **REMOVER** | V2 é e-mail/senha (sem Google), logo **nada preenche esse campo** — é lixo de dado |

### Coleções Firestore — 11 (medido em `firestore.rules`, 176 linhas, 12 blocos `match`)

| Coleção | Destino | Quem lê hoje |
|---|---|---|
| `users` | **PRESERVAR** | auth, aprovação |
| `users/{uid}/{subcollection}` (L108) | **depende de P1** | sessions/prs/state |
| `workouts` | **PRESERVAR** | treinos |
| `programs` | **PRESERVAR** | programas |
| `diets` | **PRESERVAR** | dietas |
| `exercises` | **PRESERVAR** | catálogo |
| `posts` | **REMOVER** | comunidade |
| `plans` | **REMOVER** | planos |
| `scores` | **REMOVER** | pontuação |
| `scores_history` | **REMOVER** | histórico de nota |
| `dietLogs` | **REMOVER** (ver §7) | score + auto-check do aluno |
| `workoutHistory` | **REMOVER** (ver §7) | score + "treino feito" |

### Índices compostos — 11 (medido em `firestore.indexes.json`)

| Índice | Destino |
|---|---|
| `posts` userId+type+createdAt | **REMOVER** |
| `dietLogs` studentId+date | **REMOVER** |
| `workoutHistory` studentId+completedAt DESC | **REMOVER** |
| `workoutHistory` nutritionistId+completedAt DESC | **REMOVER** |
| `workoutHistory` studentId+completedAt ASC | **REMOVER** |
| `workouts` nutritionistId+createdAt | **REMOVER na F4** (query some) |
| `programs` nutritionistId+createdAt | **REMOVER na F4** |
| `diets` nutritionistId+createdAt | **REMOVER na F4** |
| `workouts` studentId+createdAt | **PRESERVAR** |
| `programs` studentId+createdAt | **PRESERVAR** |
| `diets` studentId+createdAt | **PRESERVAR** |

**Restam 3 índices compostos** (de 11) e **5 coleções** (de 11).

## 7. ⚠️ Achado mais forte da análise: `workoutHistory` e `dietLogs` ficam sem consumidor

Este é o ponto que o prompt apenas *suspeitava*. Medindo **todos** os leitores:

**`workoutHistory`** — leitores medidos (grep exaustivo por `ListHistoryFor*`):

| Leitor | Local | Sobrevive? |
|---|---|---|
| `RecomputeScore` | `service/score.go` L17 | ❌ sai (Fase 1) |
| `ComputeStreak` | `service/score.go` L86 | ❌ sai (Fase 1) |
| `GetPublicProfile` | `service/public.go` L29 | ❌ sai (Fase 1) |
| `HandleListHistory` | `handlers/nutrition.go` L846 | ❌ **é escrita do participante** — participante vira read-only (Fase 5) |
| `RecomputeScore` pós-criação | `handlers/nutrition.go` L960, `handlers/diet.go` L189 | ❌ saem com o score |

**`dietLogs`** — leitores:

| Leitor | Local | Sobrevive? |
|---|---|---|
| `RecomputeScore` | `service/score.go` L35 | ❌ |
| `ComputeStreak` | `service/score.go` L96 | ❌ |
| `HandleListDietLogs` | `handlers/diet.go` L35 | ❌ **é escrita do participante** |
| `DietCheck.tsx` | componente (216L) + `StudentDietPage` + teste | ❌ cai com o participante read-only |

**Conclusão:** as duas coleções são *log de uso do participante* e o único motivo
de existirem era alimentar a pontuação. Com a pontuação fora e o participante
em modo leitura, **nenhuma escrita e nenhuma leitura sobrevive**. As duas
coleções saem inteiras, junto com 4 índices, 4 rotas, 2 handlers e 5 telas.

⚠️ Isso **não** é "remover por omissão": é conclusão de medição. Mas tem custo
operacional: os dados de produção de histórico/log do aluno também serão
perdidos. O prompt só autorizou apagar `scores/` e `scores_history/`.
**→ Pergunta P6.**

## 8. Regras Firestore — o que muda

| Linha | Regra | Ação |
|---|---|---|
| L57–L65 | `canViewStudentData` com clause de `nutritionist` | **SIMPLIFICAR** → `isOwner \|\| isAdmin` |
| L61–L63 | `me().data.role == 'nutritionist' && ... nutritionistID == uid` | **REMOVER** |
| L75–L82 | `allowedSelfProfileUpdate` (`name/email/photoURL/bio`) | **SIMPLIFICAR** → `name/email` (L82 muda) |
| L88–L93 | `isPendingSelfProfile` (`hasAny` de campos admin) | **SIMPLIFICAR** → tirar `planID`, `features`, `nutritionistID` da lista |
| L115–L118 | `posts` | **REMOVER** |
| L123–L126 | `dietLogs` | **REMOVER** |
| L141–L143 | `workoutHistory` | **REMOVER** |
| L148–L151 | `plans` | **REMOVER** |
| L164–L167 | `scores` | **REMOVER** |
| L171–L174 | `scores_history` | **REMOVER** |
| L100–L105 | `users` | **PRESERVAR** (só muda a allowlist) |
| L129–L140 | `workouts`/`programs`/`diets` | **PRESERVAR** (já `allow read, write: if false`) |
| L157–L160 | `exercises` | **PRESERVAR** |
| L108–L110 | subcoleção de `users` | depende de P1 |

**Melhoria de segurança resultante:** hoje `workouts`, `programs`, `diets`,
`workoutHistory` já são `if false` (L129–L143). Ou seja, o SDK de cliente **já
não alcança** os dados de negócio — a garantia de "A não acessa B" depende
inteiramente da API Go. Isso é bom: significa que a regra de acesso a ser
testada na Fase 7 é a do **backend**, e o modelo de Firestone não precisa de
nova prova além de manter `if false`.

## 9. Frontend — 119 arquivos, 16.737 linhas

### 9.1 Rotas (37 arquivos em `app/`)

| Grupo | Arquivos | Linhas | Destino |
|---|---|---|---|
| `(aluno)/` | `layout`, `comunidade`, `dashboard`, `dietas`, `programas`, `programas/[id]`, `ranking`, `treinos` (8) | 79 | **2 saem** (ranking, comunidade), 6 ficam |
| `(aluno)/*.css` | `base.css` 844, `dashboard.css` 295, `student.css` 207 | 1.346 | preservar (alguma regra vira órfã) |
| `nutritionist/` | 14 rotas + `layout` | ~2.700 | **MOVER** para `admin/` (8) · **REMOVER** (5) · revisar (1) |
| `admin/` | `page.tsx` 346, `layout.tsx` 12 | 358 | **SIMPLIFICAR** (hoje é fila de aprovação + `PlansManager`) |
| raiz | `login` 112, `cadastro` 187, `recuperar-senha` 136, `profile/[id]` 92, `page.tsx` 37, `error` 45, `global-error` 55, `layout` 64, `not-found` 24 | 752 | preservar 8 · **REMOVER** `profile/[id]` |
| CSS/misc | — | — | — |

### 9.2 `frontend/lib/` (11 arquivos, 2.726 linhas)

| Arquivo | Linhas | Destino |
|---|---|---|
| `api.ts` | **1.880** (65 exports: 63 funções) | **SIMPLIFICAR** — ~25 funções saem |
| `types.ts` | 436 | **SIMPLIFICAR** — 7 tipos saem |
| `auth.tsx` | 235 | **PRESERVAR** (ver P2) |
| `data.ts` | 152 | depende de P1 |
| `useNewCompletions.ts` | 76 | **REMOVER** (depende de `workoutHistory`) |
| `auth-errors.ts` | 51 | preservar |
| `programDays.ts` | 41 | preservar |
| `firebase.ts` | 37 | preservar |
| `days.ts` | 30 | depende de P1 |
| `exercise.ts` | 24 | preservar |
| `config.ts` | 6 | depende de P2 (DEMO_MODE) |

### 9.3 `frontend/components/` (41 arquivos, ~4.200 linhas)

**REMOver (comunidade/gamificação/social):** `Feed` 151, `PostCard` 207,
`AdherenceChart` 196, `Ranking` 99, `DietCheck` 216, `RestTimer` 104,
`TodayWorkout` 365, `student/StudentCommunityPage` 24, `DemoRoleSwitch` 87 (P2),
`Avatar` 22 (campo sai, componente depende de decisão — ver P3),
`useNewCompletions` (em lib).

**MOVER para `admin/`:** `Sidebar` 123, `StudentLayout` 119, `StudentDetail` 855,
`DashboardLayout` 57, `AdminAreaSwitch` 55, `WorkoutForm` 503, `DietForm` 241,
`programs/ProgramDetail` 280, `programs/ProgramForm` 254,
`programs/ProgramImport` 181, `admin/PendingApprovals` 258,
`EmptyDietState` 55, `ConfirmModal` 56, `LoadError` 23, `Logo` 22,
`PasswordInput` 110, `Skeleton` 339, `DashIcon` 160, `icons/AppIcons` 138,
`PWA` 88, `PWAInstall` 106, `SetupNeeded` 32, `PendingApproval` 60,
`ProfileSetup` 76, `Providers` 19.

**Preservar:** `student/StudentDashboard` 99, `student/StudentDietPage` 138,
`student/StudentProgramsPage` 108.

**RECRIAR:** `student/StudentWorkoutsPage` 219 (hoje embute `TodayWorkout` +
`RestTimer` + marcar-feito; vira leitura pura).

**Maior arquivo isolado do projeto:** `StudentDetail.tsx` = **855 linhas** com
abas de treino, dieta, score, feed. É a maior superfície de mistura.

### 9.4 Testes frontend

| Suíte | Arquivos | Testes | Destino |
|---|---|---|---|
| Vitest | 20 | **131** | `Ranking.test.tsx` (5) sai; `StudentDietPage` (6) recria; `auth-demo` (4) depende de P2 |
| Playwright | 10 | **30** | `ranking.spec.ts` (1) sai; `aluno.spec.ts` (4) revisa; `autorizacao.spec.ts` (5) **base da Fase 7** |

## 10. Testes Go — 208 em 15 arquivos (conferido: soma dos nomes = 208)

| Arquivo | Testes | Destino |
|---|---|---|
| `main_test.go` (chain) | 66 | preservar ~40 · remover ~20 (posts/diet/plan) · **reescrever ~15** (papel) |
| `main_programs_test.go` (chain) | 28 | preservar ~12 · reescrever ~16 (ownership) |
| `program_test.go` | 17 | preservar (simplificar 3) |
| `parser_test.go` | 15 | **PRESERVAR** (import markdown) |
| `http_test.go` | 16 | **PRESERVAR** (CORS/rate limit/headers) |
| `repository_test.go` | 12 | remover `TestPostDataPreserves*` (1) |
| `service_test.go` | 12 | remover 6 de score/cycle/ranking · preservar `TestAppLocIsRecife`, `TestCanAccessResource` (reescrever) |
| `exercise_test.go` | 11 | preservar |
| `config_test.go` | 10 | preservar |
| `auth_test.go` (middleware) | 5 | preservar; `TestRequireFeature` cai (Fase 3) |
| `approval_test.go` (service) | 5 | remover `TestAssignPlan` (1) |
| `approval_test.go` (handlers) | 4 | remover `TestHandleDeletePlan*` (2) |
| `http_test.go`/`handlers_test.go` | 3 | preservar |
| `nutrition_test.go` | 3 | preservar |
| `public_test.go` | 1 | **REMOVER** (arquivo inteiro) |

### Testes de papel `nutritionist` (mover na Fase 4, com cuidado)

Nestes 208 testes, os que **dependem do papel** e **não podem simplesmente ser
apagados** (o comportamento novo precisa continuar provado):

- `TestChainStudentCannotReadOtherStudentProgram` — **PRESERVAR** (é a regra de acesso!)
- `TestChainStudentCannotReadUnassignedDiet` / `...Workout` — **PRESERVAR**
- `TestChainStudentCannotCreateDietOrWorkout` — **PRESERVAR**
- `TestChainNutritionistCannotTransferWorkout` / `Diet` — trocar o sujeito por
  `admin` + aluno, **preservando a asserção** (reassign é proibido)
- `TestChainAssignProgramToOtherNutritionistStudentForbidden` — reescrever como
  "admin não materializa programa de aluno alheio"
- `TestChainNutritionistCannotReadOtherNutritionistProgram` — **vira
  `TestChainAdminCannotReadOtherStudentProgram`** (o caso análogo que importa)

⚠️ **"Reescrever teste para fazer código errado passar" é proibido.** Quando um
teste cair, primeiro confirmar que o comportamento novo está certo. Os 6 testes
marcados acima são a **âncora** da Fase 7.

## 11. `DEMO_MODE` — um 5º eixo de remoção que o prompt não menciona

Achado que **não estava na lista de remoção** e é grande:

| Arquivo | Ocorrências de `DEMO_MODE`/`demoAs`/`ll_demo_` |
|---|---|
| `frontend/lib/api.ts` | **67** (L35–L56, L589, e um ramo em **cada** função exportada) |
| `frontend/lib/auth.tsx` | **26** |
| `frontend/components/DemoRoleSwitch.tsx` | 10 |
| `frontend/lib/config.ts` | 1 (a definição) |
| `frontend/__tests__/auth-demo.test.tsx` | 4 |
| `frontend/__tests__/programs-api.test.ts` | 3 |
| `frontend/__tests__/ProgramDetail.test.tsx` | 3 |

Isto é o que explica `api.ts` ter 1.880 linhas: **cada função tem dois
caminhos** (demo em `localStorage` / real em HTTP). Remover o modo demo corta
aproximadamente metade das linhas de `api.ts` e de `auth.tsx`.

**Por que é bloqueio e não decisão minha:** remove `demoAs`/`setDemoAs` de
`lib/auth.tsx`, que é **arquivo de autenticação**. O prompt tem regra dura:
*"se qualquer passo exigir alterar um arquivo de autenticação, PARE e
pergunte"*. → **Pergunta P2.**

## 12. O que NÃO foi encontrado

Escrito para cumprir o bloco 12 (anti-alucinação):

- `check-in diário` como entidade própria: **não encontrado** como coleção ou
  tipo. O check-in é `dietLogs` + `workoutHistory` + `DietCheck.tsx`.
- `streak` persistido em Firestore: **não encontrado**. `ComputeStreak`
  (`service/score.go` L85) é calculado em memória a cada leitura.
- `badges`/`conquistas`/`metas`: **não encontrado** como código. Só o termo
  `Feature` e o cálculo de score.
- `payments`/`billing`/`stripe`: **não encontrado**. `plans` é só um documento
  com `features: []`; não há cobrança (confirma a decisão 4).
- login Google na V2: **não encontrado** em código. `AuthProvider` aceita
  `"google.com"` como valor legado (L106 do types.go) mas não há fluxo que o
  produza.
- diretório `contexto/` com notas de área: existe, mas **`contexto/scores-ranking.md`
  está desatualizado** — diz "não há teste de score ainda" e cita
  `backend/handlers/social.go` para score; hoje o score está em
  `handlers/scores.go` + `service/score.go` + `service/cycle.go`.

## 13. Comandos usados (reprodução)

Ver `docs/simplificacao/00-comandos.md`.
