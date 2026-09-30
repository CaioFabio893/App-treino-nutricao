# Planos, papéis e permissões — Treino & Nutrição V2

Status: Proposta Fase 0 (aprovação pendente). Base = modelo real da V1
(`service/approval.go`, `middleware/auth.go`, `models/types.go`) + decisões do
projeto. Este arquivo cobre **política de planos, roles, status e matriz de
permissões**.

> **Revisão 30 set 2026** — seções de papéis, aprovação e matriz **reescritas
> contra o código real**: `backend/main.go:135-230` (roteamento),
> `backend/handlers/*.go`, `backend/middleware/auth.go`,
> `backend/service/access.go`, `backend/service/approval.go` e
> `firestore.rules`. O modelo passou a ter **2 papéis** (`admin`, `student`):
> o papel `nutritionist`, o campo `NutritionistID` e a função
> `service.CanAccessStudent` foram **removidos** (simplificação F4). Cada linha
> da matriz traz a evidência `arquivo:linha`.

## Papéis (roles)

Só existem **2** papéis — `RoleAdmin = "admin"` e `RoleStudent = "student"`
(`backend/models/types.go:12-15`). Não existe `RoleNutritionist` nem campo
`NutritionistID`; `service.CanAccessStudent` foi deletada (o access control
restante é `CanAccessResource`, `backend/service/access.go:10-15`).

| Role | Quem | Acesso |
|---|---|---|
| `admin` | Dono / administradora (profissional de gestão) | Tudo: usuários, planos, aprovações, todo conteúdo, moderação do feed |
| `student` | Aluno | Só a si mesmo; visualiza treinos/dietas/programas atribuídos; conclui treinos; features do plano |

### Ownership — regra única de acesso a dado de aluno

`service.CanAccessResource(uid, role, studentID)` (`backend/service/access.go:10-15`):

- `admin` → **sempre `true`**;
- `student` → `true` **somente** se `uid == studentID`;
- qualquer outro valor de papel → `false`.

É uma função pura (sem I/O) e é a **mesma relação `dono + admin`** das regras do
Firestore (`canViewStudentData`, `firestore.rules:89-96`). Todo handler que
expõe dado de um aluno delega a ela via `canAccessResource(r, studentID)`
(`backend/handlers/handlers.go:50-56`).

Regras herdadas (confirmadas no código):
- `RoleFrom` (`middleware/auth.go:175-181`) devolve `student` se o role estiver
  vazio (compatibilidade — documento sem role é tratado como aluno).
- Admin **sempre passa** em `RequireApproved` (`middleware/auth.go:124-136`) e
  em `RequireFeature` (`middleware/auth.go:140-158`).
- Moderação do feed (apagar post/comentário alheio) é **admin apenas**:
  `canModerate` (`handlers/social.go:22-25`).

## Status do usuário (máquina de estados)

| Status | Significado | Transições |
|---|---|---|
| `pending_approval` | Cadastro criado, aguardando aprovação do admin (o papel resultante é sempre `student`; o plano é definido na aprovação) | → `active` (approve) \| → `rejected` (reject) |
| `active` | Aprovado, acesso normal | → `paused` \| `inactive` \| `rejected` |
| `paused` | Pausado manualmente | → `active` |
| `inactive` | Desligado manualmente | → `active` |
| `rejected` | Recusado pelo admin (conta Firebase excluída; doc permanece p/ auditoria) | terminal |

Comportamento de acesso:
- `IsApproved` (middleware `:163-166`): `""` (legado), `active`, `paused`
  passam; `pending_approval`, `rejected`, `inactive` bloqueiam.
- O dono de perfil pendente só acessa GET/PUT `/api/me` (cadastro começa aí —
  `main.go:139-140`, rota com `Require` apenas).
- Perfil inexistente tratado como pendente: `Require` injeta
  `status = pending_approval` (`middleware/auth.go:76`).

## Fluxo de aprovação (anti-escalada)

Confirmado em `backend/service/approval.go` e `backend/handlers/approval.go`:

- `POST /api/users/{id}/approve` (admin — `main.go:151`) recebe `{role, planID}`.
- `service.ApproveUser` **rejeita qualquer papel diferente de `RoleStudent`**
  com `ErrInvalidRole` (`service/approval.go:16-19`) → o handler traduz para
  HTTP 400 `"papel invalido"` (`handlers/approval.go:202-203`). Ou seja:
  **aprovar nunca concede `admin`** — não há como escalar um cadastro pendente
  por essa via.
- **Aprovar define plano, não papel**: o papel é gravado como `student`
  (`approval.go:29`) e, se `planID` vier, as features do plano são
  snapshoteadas (`approval.go:35-47`); sem `planID`, `PlanID=""` e
  `Features=nil` — só free tier (`approval.go:48-52`).
- O papel `admin` vem de **criação/edição feita pelo admin** em
  `POST /api/users` ou `PUT /api/users/{id}` (`handlers/nutrition.go:148-203`);
  role vazio cai para `student` (`nutrition.go:158-160`). A edição comum
  preserva `planID`/`features`/`authProvider`/histórico de aprovação
  (`preserveAdminFields`, `nutrition.go:208-215`).
- `POST /api/users/{id}/reject` marca `status=rejected` + motivo e exclui a
  conta do Firebase Auth (`handlers/approval.go:53-78`).
- `POST /api/users/{id}/assign-plan` troca plano/features sem re-aprovação
  (`service.ApproveUser` → `AssignPlan`, `approval.go:75-100`).
- O fluxo `pending_approval` foi **preservado**.

## Planos (entitlements)

Modelo V1 (confirmado):
- `plans/{id}`: `name`, `description`, `features[]`, `active`, timestamps.
- **Features**: `workouts` (sempre liberado), `diet`, `community`, `ranking`
  (`models/types.go:33-38`).
- Ao **aprovar** ou **atribuir** um plano, o perfil recebe **snapshot** das
  features (`features[]` + `planID`) — alterar o plano depois **não** muda
  quem já está vinculado; re-atribuir é o mecanismo de atualização.
- Exclusão de plano em uso → `409` (`CountStudentsWithPlan`,
  `handlers/approval.go:139-158`).
- Planos inativos não aparecem para atribuição (`ErrPlanInactive`,
  `service/approval.go:43-45`).

> **Nota (30 set 2026)**: planos e features **ainda existem e valem hoje**
> (`plans/`, `planID`, `features`, `RequireFeature`, `PlansManager`). A
> remoção desse modelo está **planejada** na refatoração de simplificação
> (**F3**, `docs/simplificacao/`) — ainda **não executada**.

Política V2 (deliberada):
1. **Autorização por feature no backend** (existe via `RequireFeature`):
   menu oculto no front **não basta** — a API nega.
2. **Snapshot é a fonte de verdade do acesso** do usuário (não leitura em
   tempo real do plano). Mantido da V1.
3. Cadastro novo **nunca** se auto-atribui features/role (regra
   `isPendingSelfProfile`). Mantido da V1.
4. **Admin não é limitado por plano** (bypass de `RequireFeature` em
   `middleware/auth.go:144-147`); o aluno é limitado pelo snapshot do plano.
5. Novas features entram como constantes novas sem quebrar planos
   existentes (backward compatible).

## Matriz de permissões (rota × papel × feature)

Legenda: ✅ permite · ⛔ bloqueia · *(EV)* exige cadastro aprovado
(`RequireApproved`). **Coluna `nutritionist` removida — o papel não existe
mais.** Cada linha traz a evidência: gate da rota em `backend/main.go` +
checagem dentro do handler. "Feature extra" só restringe **aluno** (admin tem
bypass — `middleware/auth.go:144-147`).

| Recurso/Rota | student | admin | Feature extra | Evidência |
|---|---|---|---|---|
| `/api/me` GET/PUT | ✅ (pendente também) | ✅ | — | `main.go:139-140` (`Require` apenas, sem `RequireApproved`); allowlist zerada em `nutrition.go:95-107` |
| `/api/users*` (CRUD, pending, approve, reject, assign-plan) | ⛔ | ✅ | — | `main.go:143-153` `Allow(RoleAdmin)` |
| `/api/plans*` (CRUD) | ⛔ | ✅ | — | `main.go:156-159` `Allow(RoleAdmin)` |
| `GET /api/students` | ⛔ | ✅ (todos) | — | `main.go:162` `Allow(RoleAdmin)`; `nutrition.go:300` `ListStudentsAll` |
| `GET /api/students/{id}` | ✅ (só o próprio) | ✅ | — | `main.go:163` (`Require` apenas); ownership em `nutrition.go:310` `canAccessResource` |
| `PUT /api/students/{id}` | ⛔ | ✅ | — | `main.go:164` `Allow(RoleAdmin)`; camada extra em `nutrition.go:223` `canAccessResource` |
| `GET /api/workouts` | ✅ (próprios) | ✅ (todos) | — | `main.go:167` `RequireApproved`; bifurca por papel em `nutrition.go:333-338` |
| `POST/PUT/DELETE /api/workouts`, `/duplicate` | ⛔ | ✅ | — | `main.go:168-172` `Allow(RoleAdmin)`; ownership em `nutrition.go:357`, `:408`, `:451`, `:473` |
| `GET /api/programs` | ✅ (atribuídos a ele) | ✅ (todos) | — | `main.go:184` `RequireApproved`; bifurca em `program.go:33-38` |
| `GET /api/programs/{id}` | ✅ (atribuído) | ✅ | — | `main.go:187`; ownership em `program.go:284` `canAccessResource` |
| Escrita `/api/programs` (create, import, put, delete, assign, duplicate) | ⛔ | ✅ | — | `main.go:185-191` `Allow(RoleAdmin)`; dupla checagem em `program.go:63`, `:184`, `:253`; posse do treino referenciado em `program.go:75`, `:130` + `service/program.go:106` |
| `GET /api/exercises`, `GET /api/exercises/{id}` | ✅ | ✅ | — | `main.go:196-197` `RequireApproved` (catálogo global, sem ownership) |
| Escrita `/api/exercises` (POST/PUT/DELETE) | ⛔ | ✅ | — | `main.go:198-200` `Allow(RoleAdmin)` |
| `GET /api/diets`, `GET /api/diets/{id}` | ✅ (próprias) | ✅ (todas) | `diet` | `main.go:203`, `:205` `RequireFeature(FeatureDiet)`; lista bifurca em `nutrition.go:526-531`; ownership em `nutrition.go:550` |
| Escrita `/api/diets` (POST/PUT/DELETE, `/duplicate`) | ⛔ | ✅ | — | `main.go:204`, `:206-208` `Allow(RoleAdmin)`; ownership em `nutrition.go:601`, `:643`, `:665` |
| `GET /api/workout-history` | ✅ (próprio) | ✅ (todos) | — | `main.go:211` `RequireApproved`; bifurca em `nutrition.go:732-737` |
| `POST /api/workouts/complete` | ✅ (próprio) | ✅ | — | `main.go:212`; `nutrition.go:811` (`role != admin && uid != workout.StudentID` → 403) |
| `POST /api/posts` | ✅ | ✅ | `community` | `main.go:215` `RequireFeature(FeatureCommunity)`; posse do treino/dieta referenciado em `social.go:67`, `:87` |
| `GET /api/posts` | ✅ | ✅ | `community` | `main.go:216` |
| `POST /api/posts/{id}/like`, `POST /api/posts/{id}/comments` | ✅ | ✅ | `community` | `main.go:217-218` |
| `DELETE /api/posts/{id}`, `DELETE .../comments/{cid}` | ✅ (autor: exclusão real) | ✅ (modera com soft delete) | `community` | `main.go:219-220`; moderação = **admin apenas** (`social.go:22-25`, `:316`) |
| `GET /api/diet-logs` | ✅ (próprio) | ✅ (qualquer aluno) | `diet` | `main.go:223`; ownership em `diet.go:22` |
| `PUT /api/diet-logs` | ✅ (próprio) | ✅ (qualquer aluno) | `diet` | `main.go:224`; `diet.go:70` (`role == student && studentID != uid` → 403) |
| `GET /api/ranking` | ✅ (top público + self) | ✅ (`full`) | `ranking` | `main.go:227`; `scores.go:47-59` |
| `GET /api/scores/history` | ✅ (próprio) | ✅ (qualquer aluno) | `ranking` | `main.go:228`; ownership em `scores.go:71` |
| `GET /api/public/profile/{id}` | ✅ | ✅ | `ranking` | `main.go:229`; `scores.go:88-99` |

**Linha removida:** a matriz antiga continha `/api/sessions|prs|state`. Essas
rotas **não existem** no roteamento atual (`registerRoutes`,
`backend/main.go:135-230`) — era uma linha órfã.

Mecânica real (confirmada no código):
- `RequireApproved` (`middleware/auth.go:124-136`) envolve as rotas de
  negócio; **admin tem bypass** de status. Ficam de fora: `/api/me`
  (`main.go:139-140`), as rotas `admin-only` (que usam só `Allow(RoleAdmin)`)
  e `GET /api/students/{id}` (`main.go:163`).
- `Allow(roles...)` (`middleware/auth.go:102-115`): admin-only em escrita e
  gestão. Lesão de papel → 403 JSON `{"error":"sem permissao"}`.
- `RequireFeature(f)` (`middleware/auth.go:140-158`): **admin passa sempre**;
  aluno precisa de `f` no snapshot `features`. Aplicado **só** em diets,
  posts, diet-logs e ranking (`main.go:203-229`). A feature `workouts` **nunca**
  é exigida — treino é free tier (não existe `RequireFeature(FeatureWorkouts)`
  em lugar nenhum).
- Ownership dentro do handler (camada extra): `canAccessResource` →
  `service.CanAccessResource` (`handlers/handlers.go:50-56`,
  `service/access.go:10-15`).

## Regras do Firestore (camada extra — já ativas)

Papel nas regras: **2 papéis** (`firestore.rules:9-10`); `isAdmin()` = `role ==
'admin'` (`:51-53`); relação de dado de aluno = dono + admin
(`canViewStudentData`, `:89-96`) — idêntica a `service.CanAccessResource`.

- `users/{uid}`: dono lê/cria/atualiza **somente** os campos da allowlist
  `name`/`email`/`photoURL`/`bio` (`allowedSelfProfileUpdate`, `:106-113`,
  via `affectedKeys().hasOnly`); create só como pendente e sem campos
  administrativos (`isPendingSelfProfile`, `:119-124`); `delete: if false`
  (`:135`) — exclusão é só API Go. `role`/`status`/`planID`/`features`/
  histórico de aprovação/`createdAt`/`authProvider` mudam **somente pela API
  Go**, nem admin via SDK de cliente.
- `posts`: leitura para aprovados (`canUseBusinessResources`), escrita
  `if false` — só API Go (`:141-144`).
- `dietLogs`: leitura dono + admin (`canViewStudentData`, `:149-152`);
  escrita `if false`.
- `workouts` / `programs` / `diets` / `workoutHistory`: leitura **e** escrita
  negadas a clientes (`:155-169`) — só API Go.
- `plans` (`:174-177`), `exercises` (`:183-186`), `scores` (`:190-193`):
  leitura para aprovados, escrita `if false`.
- `scores_history` (`:197-200`): leitura dono + admin, escrita `if false`.

## Perguntas ainda em aberto (para o dono do projeto)

1. Status `blocked` (mencionado no plano) não existe na V1 (usa `paused`/
   `inactive`) — **manter os 5 da V1** ou introduzir `blocked`? Proposta:
   manter compatibilidade, `blocked` como alias de `inactive`.
2. Novo aluno pode ter **plano vazio** (features só `workouts`)? — Proposta:
   sim, default livre.
3. ~~Nutricionista pode ter acesso a plano/features?~~ — **obsoleta desde a
   F4**: o papel `nutritionist` não existe mais. O admin não é limitado por
   plano (bypass de `RequireFeature`, `middleware/auth.go:144-147`).

> Decisões acima são **recomendações de Fase 0**; validação no checkpoint.
