# Fase 15.1 — Revisão Final de Segurança (agente review, item §16/§18.3)

**Data:** 23 set 2026
**Baseline:** `248e83e` (`feat: add shared exercise library`) — HEAD verificado com `git rev-parse` e `git log`
**Modo:** READ-ONLY — nenhum arquivo de código de produção foi alterado. Único arquivo criado: este relatório.
**Base:** reaproveita a auditoria completa da F15.1 (`docs/reports/phase-15-1-pre-deploy-audit.md`, READY, 8 gates verdes), sem re-executar gates (nenhum código mudou desde `248e83e`).

**Estado do repositório na revisão** (`git status --short`): `M opencode.json` (config local, fora de produção), `?? .opencode/agent-routing.md`, `?? docs/reports/phase-15-1-pre-deploy-audit.md`. **Nenhuma mudança em código de produção desde `248e83e`.**

---

## Sumário — PASS/FAIL por foco

| # | Foco | Veredito |
|---|---|---|
| 1 | AuthN/AuthZ | **PASS** |
| 2 | Ownership/IDOR | **PASS** |
| 3 | Mass assignment | **PASS** |
| 4 | Regras Firestore | **PASS** |
| 5 | Hardening de produção | **PASS** |
| 6 | Secrets | **PASS** |
| 7 | Riscos residuais conhecidos | **RECONFIRMADOS** (documentados) |

**Veredito final: PASS** — o HEAD `248e83e` mantém integralmente as garantias de segurança da F15.1. Regressões: nenhuma.

---

## 1. AuthN/AuthZ — PASS

- **`Require` valida ID token via Admin SDK**: `backend/middleware/auth.go:49-62` — extrai `Bearer` do header `Authorization` e chama `a.auth.VerifyIDToken` (linha 58; interface `tokenVerifier` na linha 30-32 implementada pelo `*firebaseAuth.Client`). Token ausente/inválido = 401 (linhas 54, 60).
- **Injeção de contexto**: `auth.go:64, 92-95` — injeta `uid`, `role`, `status`, `features` e `authProvider` no contexto.
- **Perfil ausente = `pending_approval`**: `auth.go:76` — `status := models.StatusPendingApproval` quando `GetUserProfile` devolve nil (linhas 70-85); nenhuma rota de negócio libera sem aprovação (`RequireApproved`, linhas 124-136).
- **Ordem `Require(...)` por fora dos gates**: `backend/main.go:139-218` — TODAS as 45+ rotas usam `a.Require(...)` como wrapper mais externo (`GET /api/sessions` linha 139, `PUT /api/me` linha 148, `GET /api/users` linha 151, workouts linha 175-180, exercises 185-189, diets 192-197, feed 204-209, diet-logs 212-213, ranking/scores 216-218). Única exceção deliberada: `GET /health` (linha 136, público). O padrão errado `Allow(...)(Require(...))` não ocorre em nenhuma rota (verificado linha a linha).
- **`Allow`/`RequireApproved`/`RequireFeature`**: `auth.go:102-115` (Allow 403 para papel fora da lista), `auth.go:124-136` (RequireApproved com bypass explícito para admin na linha 126), `auth.go:140-158` (RequireFeature — admin/nutricionista sempre passam, linhas 143-147).
- **`AuthProvider` só do token/perfil do banco**: `auth.go:84-90` — provider vem do campo do perfil ou da claim `verified.Firebase.SignInProvider` do token verificado; `handlers/nutrition.go:108` — `HandlePutMe` grava `p.AuthProvider = middleware.AuthProviderFrom(r.Context())`, nunca do body (comentário na linha 106-107).
- **`IsApproved`**: `auth.go:163-166` — aceita `""` (legado)/active/paused, espelhado pelas rules.

## 2. Ownership/IDOR — PASS

- **Funções de acesso**: `backend/service/access.go:12-28` (`CanAccessStudent`: admin tudo, aluno só a si, nutricionista só alunos com `NutritionistID == uid`) e `access.go:32-43` (`CanAccessResource`, função pura). Helper do handler: `handlers/handlers.go:52-59`.
- **Alunos**: `HandleGetStudent` (`handlers/nutrition.go:333-344`) e `HandleUpdateStudent` (`nutrition.go:226-234`) chamam `CanAccessStudent` antes de tocar o recurso. `HandleListMyStudents` (`nutrition.go:310-331`) escopa por papel (admin todos, nutricionista só os próprios).
- **Treinos**: `HandleGetWorkout`/`HandleUpdateWorkout`/`HandleDeleteWorkout`/`HandleDuplicateWorkout` (`nutrition.go:389, 451, 509, 531`) — todos validam `canAccessResource(existing.StudentID, existing.NutritionistID)`. `HandleListWorkouts` (358-370) e `HandleListHistory` (835-847) escopam por papel. `HandleCompleteWorkout` (894-924): só o próprio aluno ou admin (linha 921).
- **Nutricionista nunca transfere treino**: `nutrition.go:477-489` — em `HandleUpdateWorkout`, se o papel é nutricionista, `workout.NutritionistID = existing.NutritionistID` (linha 478) e o novo `StudentID` passa por `CanAccessStudent` (480-484). **Dieta**: `nutrition.go:708-720` — mesmo padrão em `HandleUpdateDiet` (`d.NutritionistID = existing.NutritionistID`, linha 709). Criação: `HandleCreateWorkout` força `workout.NutritionistID = uid` (linha 417) + `CanAccessStudent` se houver aluno (418-424); `HandleCreateDiet` idem (649-656).
- **Dieta diária (logs)**: `handlers/diet.go:24-32` (`HandleListDietLogs` — `CanAccessStudent`) e `diet.go:70-84` (`HandleUpsertDietLog` — aluno só marca o próprio dia, linha 77-79; nutricionista é NEGADO, linha 81-84; admin pode marcar qualquer aluno; vínculo `NutritionistID` vem do perfil/dieta do aluno, linhas 97-118).
- **Feed**: `handlers/social.go` — `HandleCreatePost` valida `canAccessResource` em posts com referência a treino (linha 67) e dieta (linha 87); `HandleDeletePost` (295-335): autor remove, moderador (nutricionista/admin, `canModerate` linha 22-25) faz soft delete auditado com `UpdatePostTx`; `HandleDeleteComment` (242-291): autor remove de vez, não-autor não-moderador recebe 403 (linha 262-264); likes/comentários rodam em `UpdatePostTx` (linhas 156, 220).
- **Scores/ranking/perfil público**: `handlers/scores.go:78-86` (`HandleGetScoreHistory` — `CanAccessStudent`); `HandleGetRanking` (47-65) escopa por papel (aluno vê self, nutricionista os próprios alunos, admin full); `HandleGetPublicProfile` usa `service.GetPublicProfile` (`service/public.go:21-27`) que expõe apenas id/name/photoURL/bio/role + streak/score/rank — sem e-mail, vínculo ou dados administrativos.
- **Nenhum handler de recurso por id sem checagem**: varredura completa dos handlers com `PathValue("id")` — workouts/diets (get/update/delete/duplicate: `canAccessResource`), student (get/update: `CanAccessStudent`), diet-logs (query `studentId`: `CanAccessStudent`), score history (`CanAccessStudent`), posts (autoria/moderação), users/{id} (gates `Allow(RoleAdmin)` no `main.go:151-167`), exercises (catálogo global sem dados de aluno: leitura para aprovados, escrita nutri/admin — `main.go:185-189`). Sem exceções.

## 3. Mass assignment — PASS

- **`PUT /api/me`** (`handlers/nutrition.go:84-122`): allowlist estrita — o handler zera TODO campo não editável antes de gravar: `Role`, `Status`, `PlanID`, `Features`, `NutritionistID`, `StartDate`, `EndDate`, `ApprovedBy`, `ApprovedAt`, `RejectedReason`, `CreatedAt` (linhas 95-105); `AuthProvider` vem do ID token (linha 108); valida tamanhos de name/bio (109-116).
- **Preservação no service**: `service/profile.go:13-43` — `GetOrCreateProfile` preserva do registro existente role/status/planID/features/nutritionistID/aprovação/`createdAt` (linhas 20-28) e também `StartDate`/`EndDate` (linhas 35-36 — correção F13: o aluno não infla o denominador da pontuação). Perfil novo = role vazio + `pending_approval` (linhas 41-42) — sem campos administrativos.
- **`HandleUpdateStudent`** (`nutrition.go:221-266`): merge via `mergeStudentEdits` (linhas 272-282) — parte do perfil existente e aplica somente name/photoURL/bio/status/startDate/endDate; role, vínculo, plano, features e histórico de aprovação SEMPRE do registro.
- **`HandleUpdateUser`** (admin, `nutrition.go:169-204`): `preserveAdminFields` (linhas 209-216) mantém planID/features/authProvider/aprovação do registro; `CreatedAt` preservado (linha 197).
- **`sanitizeFeatures`** (`handlers/approval.go:180-196`): mantém apenas as 4 features conhecidas, sem duplicatas.

## 4. Regras Firestore — PASS

`firestore.rules` (170 linhas, lidas na íntegra):

- **Escrita de negócio só via API Go (Admin SDK)**: `posts` (linha 117: `allow create, update, delete: if false`), `dietLogs` (linha 125: `allow write: if false`), `workouts`/`diets`/`workoutHistory` (linhas 129-137: `allow read, write: if false`), `plans` (linha 144), **`exercises` — coleção nova do baseline F5 — incluída corretamente** (linhas 151-154: leitura para aprovados, `allow write: if false` para TODOS, inclusive admin), `scores` (linha 160), `scores_history` (linha 167). `users` delete = `false` (linha 104).
- **`isPendingSelfProfile`** (linhas 88-93): criação do próprio perfil pendente SEM campos administrativos (`hasAny` nega role/planID/features/nutritionistID/approvedBy/approvedAt/rejectedReason).
- **`allowedSelfProfileUpdate`** (linhas 75-82): `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name','email','photoURL','bio'])` — nega o update inteiro se qualquer outra chave for tocada.
- **`isApprovedUser`** (linhas 48-55): espelha `middleware.IsApproved` (`""`/active/paused + bypass admin).
- **`canViewStudentData`** (linhas 57-65): dono/nutricionista do aluno/admin, aplicado em `dietLogs` (linha 124) e `scores_history` (linha 166).
- **Nenhum `allow write` permissivo novo** — a única escrita por SDK cliente permitida no banco inteiro é o update do próprio perfil dentro da allowlist (linha 103) e a criação do perfil pendente (linha 102). Confirmado por leitura integral do arquivo.

## 5. Hardening de produção — PASS

- **Config fail-fast** (`backend/config.go`): `GO_ENV=production` + `ALLOWED_ORIGIN` ausente = erro de boot (linhas 55-56); `*` rejeitado EM QUALQUER ambiente (linhas 59-60); default de dev `http://localhost:3000` (linha 22, nunca aplicado em produção); `RATE_LIMIT=0` em produção = erro de boot (linhas 79-81); negativo rejeitado (76-77).
- **CORS sem wildcard** (`backend/middleware/http.go:22-53`): mapa de origens exatas (lista separada por vírgula); origem não permitida = 403 sem `Access-Control-Allow-Origin` (linhas 39-42); `Vary: Origin` (linha 38); sem header `Origin` passa (healthcheck/same-origin).
- **Rate limit + Retry-After** (`http.go:121-144`): 429 com `Retry-After` em segundos (linha 137); purga de memória > 4096 entradas (105-111); `clientIP` lê primeiro elemento do `X-Forwarded-For` (147-159 — risco residual conhecido, §7).
- **MaxBody 1 MiB** (`http.go:183-194`): `http.MaxBytesReader` em POST/PUT.
- **Recover** (`http.go:167-177`): panic → 500 + log apenas com valor/método/caminho, sem corpo nem token.
- **Security Headers backend** (`http.go:60-71`): nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva e **`Cache-Control: no-store` em `/api/*`** (linhas 66-68).
- **Ordem da cadeia** (`main.go:71-78`): `SecurityHeaders → CORS → RateLimit → MaxBody → Recover` (Recover mais externo), após `loadConfig` fail-fast (main.go:66-69).
- **CSP frontend** (`frontend/next.config.ts:19-39`): `default-src 'self'`; `script-src` SEM `unsafe-eval` em produção (linha 21); `connect-src` restrito a googleapis/firebaseio/`*.a.run.app` + URL exata da API (linhas 32-34); origens de dev/emuladores só fora de produção (linha 25); `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` (36-38). Headers de hardening aplicados a `/:path*` (linhas 61-74).

## 6. Secrets — PASS

- **Nada versionado**: `git ls-files` (filtro `.env|secret|credential|serviceaccount|.key|.pem|.p12`) retorna SOMENTE `frontend/.env.example`, que contém apenas placeholders explícitos (`your-firebase-api-key`, etc.) e aviso "NENHUMA credencial real deve ser commitada".
- **Dockerfiles**: `backend/Dockerfile` — build estático `CGO_ENABLED=0 -trimpath -ldflags="-s -w"`, runtime `distroless/static-debian12:nonroot`, `USER nonroot`, sem segredo algum; `frontend/Dockerfile` — `NEXT_PUBLIC_*` via build args (públicos por natureza, comentário explícito "NUNCA passe secrets aqui"), `NEXT_PUBLIC_DEMO` deliberadamente fora do build, `NODE_ENV=production`.
- **cloudbuild.yaml**: só substitutions públicas (`_API_URL`, config Firebase Web); nenhuma chave de service account.
- **Backend**: credenciais via ADC (`main.go:27-30` — metadata server no Cloud Run / `GOOGLE_APPLICATION_CREDENTIALS` local, nunca em arquivo versionado).
- **`NEXT_PUBLIC_*` no código**: varredura com `git grep` — apenas config pública do Firebase Web (`lib/firebase.ts:9-14`), URL da API (`lib/api.ts:33`), flag demo (`lib/config.ts:4-6`) e flag do Auth Emulator (`firebase.ts:33` — só liga com `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR=1` explícito, nunca injetada no build de produção).

## 7. Riscos residuais conhecidos — RECONFIRMADOS (não corrigidos, por design desta revisão)

1. **Rate limit por `X-Forwarded-For`** (INFORMATIVO, mantido): `http.go:147-159` confia no primeiro elemento do XFF — spoofável se não houver proxy confiável à frente. O Cloud Run LB sobrescreve o header, mitigando em produção. Comentário no código documenta a procedência (linhas 117-120).
2. **`googleProvider` no frontend** (INFORMATIVO, mantido): `frontend/lib/firebase.ts:41` — login Google da V1 presente para transição V1→V2; decisão de produto V2 é removê-lo ( remoção coordenada frontend + rules + testes).
3. **Test gaps da F15.1** (mantidos, não bloqueantes): XFF forjado, CORS multi-origem, panic real no Recover, purga >4096 do rate limiter, smoke de imagem no Cloud Run (pré-deploy).

---

## Achados novos

| Severidade | Área | Arquivo | Evidência | Impacto | Bloqueante? |
|---|---|---|---|---|---|
| INFORMATIVO | Documentação de deploy | `frontend/.env.example` (bloco BACKEND, comentário) | Diz `ALLOWED_ORIGIN=... (vazio = todas)` | Comentário desatualizado: em produção `ALLOWED_ORIGIN` vazio = **boot falha** (config.go:55-56), nunca "todas" — o fail-fast é a proteção real; o texto pode induzir erro de leitura, não de segurança | **Não** |

- **CRÍTICO: 0 | ALTO: 0 | MÉDIO: 0 | BAIXO: 0 | INFORMATIVO: 1** (novo, não-bloqueante).
- O achado não é regressão: está presente no baseline `248e83e` auditado pela F15.1; foi detectado agora pela leitura fina do artefato. Recomendação: corrigir o comentário quando o `.env.example` for tocado (não justifica commit próprio).

## Confirmação de não-regressão

Nenhum arquivo de produção mudou desde a auditoria F15.1 (`git status --short` confirma: apenas `opencode.json` modificado — config local de automação — e dois arquivos untracked de documentação/config). Todos os controles re-verificados por leitura direta do código no HEAD `248e83e` correspondem ao que a F15.1 auditou:

- 8 gates verdes da F15.1 permanecem válidos (nenhum código alterado desde então — re-executá-los seria redundante; decisão documentada no escopo desta revisão).
- Composição de middlewares, ownership handlers, allowlists, rules, hardening e CSP idênticos ao relatório-base.
- A coleção nova do baseline (`exercises`, commit `248e83e`) está coberta nos dois lados: gates Go (`main.go:185-189`) e rules (`firestore.rules:151-154`, write false até para admin).

**Regressão: nenhuma.**

## Veredito final

### **PASS — APPROVED FOR DEPLOY STEP**

O HEAD `248e83e` mantém todas as garantias de segurança da F15.1. Nenhum bloqueador técnico para a etapa de deploy.

### Recomendações para o deploy (sem executar)

1. **Cloud Run (API Go)**: `GO_ENV=production` + `ALLOWED_ORIGIN=<domínio exato do frontend>` (ausência/`*` derrubam o boot por design — proposital). `RATE_LIMIT` omitido usa default 120/min/IP; nunca `0`.
2. **Cloud Run (frontend)**: fornecer os 7 `NEXT_PUBLIC_*` como build args (públicos); `NEXT_PUBLIC_DEMO` fora; `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR` fora.
3. **Pré-deploy**: smoke da imagem da API (`/health` + CORS com origem de produção) — test gap ALTA prioridade listado na F15.1 §12.
4. **Pós-deploy**: smoke de login real (e-mail/senha) + verificação de `Retry-After` no 429 e `Cache-Control: no-store` em `/api/*`.
5. **Pós-deploy (criar como issues)**: corrigir comentário do `.env.example`; eventualmente o smoke de XFF/Cloud Run e os demais test gaps.
6. Manter a governança atual: sem push automático, produção V1 intocada até a fase de deploy ser decidida.
