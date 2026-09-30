# Arquitetura do sistema — Treino & Nutrição V2

Status: Proposto na Fase 0 (aprovação pendente no checkpoint).
Documento vivo: atualizar conforme decisões da Fase 1+.

> **Estado da refatoração**: plano em `docs/simplificacao/03-plano.md`;
> decisões de produto em aberto em `docs/simplificacao/04-perguntas.md`
> (P1–P8, P1/P2 bloqueantes). **F4 (papel `nutritionist` → `admin`) já
> executado, ainda sem commit**; F1 gamificação, F2 comunidade, F3
> planos/features, F5 escrita do participante, F6 modelo final + reindex e
> F7 provar a regra de acesso estão **planejados, não executados**.

## Visão geral (C4 simplificado — nível container)

```
┌──────────────────┐      HTTPS       ┌──────────────────┐      Admin SDK      ┌──────────────┐
│  Browser (PWA)   │ ───────────────► │ API REST (Go)     │ ─────────────────► │  Firestore   │
│  Next.js 16      │  Bearer JWT      │  Cloud Run        │  (ignora rules)    │  (NoSQL)     │
│  Cloud Run       │                  │  southamerica     │                    └──────┬───────┘
└───────┬──────────┘                  └───────┬──────────┘                           │
        │  Firebase Auth (e-mail/senha)       │                                      │
        ▼                                     │                                      ▼
┌──────────────────┐                          └── Admin SDK ──►  Firebase Auth       │
│ Firebase Auth    │                                                (verifica JWT)   │
└──────────────────┘                                                               │
                                                                                    ▼
                                                            ┌──────────────────────────────┐
                                                            │  clientes NUNCA acessam      │
                                                            │  workouts/diets/history      │
                                                            │  direto; regras negam        │
                                                            └──────────────────────────────┘
```

## Componentes

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| `frontend/` | Next.js 16 (App Router, standalone) | UI, estado, PWA, chamadas à API via `lib/api.ts` |
| `backend/` | Go 1.23 (net/http, ServeMux) | API REST, autorização, regras de negócio |
| `firestore.rules` | Regras de segurança | Proteção contra acesso direto de cliente |
| `firestore.indexes.json` | Índices compostos | Queries com OrderBy/Where (11 índices) |
| Firebase Auth | Identity provider | Emissão/verificação de ID tokens |

## Camadas do backend (Clean-lite, por diretório)

| Camada | Diretório | Papel |
|---|---|---|
| Handlers | `handlers/` | HTTP: parse/decode, resposta, orquestra service+repo |
| Middlewares | `middleware/` | Auth (JWT)→Allow/RequireApproved/RequireFeature, CORS, SecurityHeaders, RateLimit, MaxBody, Recover |
| Service | `service/` | Regras de negócio puras e testáveis (acesso, aprovação, ciclo, dieta, ranking, score, social, timezone, profile, normalize, public) |
| Repository | `repository/` | Interface `Repository` + implementação `firestoreRepo` (CRUD Firestore) |
| Models | `models/` | Structs/consts de domínio (Role, Status, Feature, Plan, UserProfile, Workout, Diet…) |

Regra de dependência: **handlers → service → repository → Firestore** e
**models compartilhado**. Nada de regra de negócio em repository;
nada de Firestore em handler.

## Fluxo de uma requisição autenticada

1. `middleware.Recover` (externo) → `MaxBody` → `CORS` → `SecurityHeaders` → `RateLimit`.
2. `middleware.Auth.Require`: verifica `Authorization: Bearer <idToken>`
   via `VerifyIDToken`; carrega `users/{uid}`; injeta no contexto:
   `uid`, `role`, `status`, `features`, `authProvider`.
   **Ordem obrigatória**: `Require` é SEMPRE o mais externo em relação aos
   gates (`Allow`/`RequireApproved`/`RequireFeature`) para o contexto estar
   populado quando eles rodarem (causa raiz de 403 corrigida na V1).
3. Gates: papel (`Allow`), status aprovado (`RequireApproved` — admin
   sempre passa), feature do plano (`RequireFeature` — admin tem bypass;
   o aluno precisa da feature no snapshot `features[]` do perfil —
   `middleware/auth.go:140`; `FeatureWorkouts` nunca é exigido).
4. Handler: valida, chama service/repo, responde JSON.

## Regras de autorização (função pura)

Modelo de **2 papéis** (`backend/models/types.go:12-15`): `admin` e
`student` — não existe `nutritionist` nem `CanAccessStudent` (removidos em
F4). A camada de acesso é **admin-vs-aluno**.

`service/access.go`:
- `CanAccessResource(uid, role, studentID)` — função pura (sem I/O,
  `service/access.go:10`): admin acessa tudo; `student` só o recurso com
  `uid == studentID`. É a mesma matriz de `canViewStudentData` nas regras
  (`firestore.rules:89-96`).

`middleware/auth.go`:
- `RoleFrom`: devolve `student` se role vazio (compatibilidade legado).
- `IsApproved`: `""` (legado), `active`, `paused` passam; `pending_approval`,
  `rejected`, `inactive` bloqueiam (não-aluno).

## Segurança HTTP (produção)

- CSP via `next.config.ts`: produção sem `unsafe-eval`; `frame-ancestors 'none'`.
- Backend: CORS com `ALLOWED_ORIGIN` (default `*` **em dev** — produção deve
  setar origem exata), `SecurityHeaders`, `RateLimit` (env `RATE_LIMIT`;
  vazio=0=desativado — V2 define default explícito), `MaxBody`, `Recover`.
- Secrets: nunca no git (`.gitignore`), `.env.example` versionado, secrets no
  Cloud Run via env; `NEXT_PUBLIC_*` só para valores públicos de cliente.

## Timezone e datas de negócio

- Fuso oficial: `America/Recife` (`service/timezone.go` — `AppLoc`, `Now()`).
- datas de negócio (dietLogs.date, posts.date, workout-history day) são
  strings `YYYY-MM-DD` locais. Nunca `time.Now()` cru.
- `score.go`/`cycle.go` derivam dia do aluno com `CompletedAt.In(AppLoc)`.

## Deploy (V1 — referência para V2)

- Cloud Run `southamerica-east1`; API `treino-api`, web `treino-web`.
- Frontend: build via `frontend/cloudbuild.yaml` + `gcloud builds submit`
  (passa `NEXT_PUBLIC_*` como build args; SEM `--source ... --build-arg` — não
  existe no SDK atual).
- Backend: `gcloud builds submit --tag southamerica-east1-docker.pkg.dev/...`.
- `firebase deploy --only firestore` para rules/índices.
- Emuladores **configurados** em `firebase.json` (Firestore `127.0.0.1:8080`,
  Auth `9099`) — testes de regras rodam contra o emulador (`firestore-tests/`).

## Observações V2 (deliberadas)

1. **Tudo passa pela API Go** — Firestore fica closed ao cliente (rules).
2. **Firestore Emulator** para testes de regras configurado em `firebase.json`
   (`firestore-tests/`).
3. V2 corrige **race condition do feed** com `RunTransaction` (3.5).
4. V2 corrige **`PutDietLog` regravando `createdAt`**.
5. V2 adota **TDD obrigatório** em Go (back) e Vitest/Playwright (front).