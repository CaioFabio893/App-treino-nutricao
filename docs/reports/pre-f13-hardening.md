# Hardening pré-F13 — Segurança e consistência

**Data:** 22 set 2026
**Status:** CONCLUÍDO — todos os checkpoints verdes; commit
`security: harden app before final review` (local, sem push/deploy).

---

## Objetivo

Antes de abrir a F13 (revisão), fechar os achados de segurança/consistência
levantados na auditoria do working tree — sem implementar nenhuma feature das
fases futuras (F5/F8/F13/F14/F15/F16). Nada de push, deploy ou mudança de
stack/arquitetura.

## Achados e correções

### 1. Corrida de deep-link de papel (guard com role default "student")

**Problema:** `DashboardLayout` decidia o redirect de papel com `role`
defaulting para `"student"` enquanto o `GET /api/me` ainda não tinha
respondido. Admin/nutritionist acessando `/admin` ou `/nutritionist/*` por URL
direta (deep-link, full reload) era rebatido para `/` como se fosse aluno.

**Correção (frontend):**
- `lib/auth.tsx`: novo estado `profileLoaded` no `AuthCtx` — só fica `true`
  depois que o perfil foi carregado (ou falhou) para o usuário atual
  (`finally` do `refreshProfile`; inicia `true` em demo/desconfigurado).
- `components/DashboardLayout.tsx`: o guard de rotas só roda com
  `initializing === false && profileLoaded === true`; antes disso renderiza o
  `LoadingScreen`. Nenhum redirect acontece com role não carregado.

A autorização de verdade continua no backend (`Require`/`Allow`/
`RequireApproved`/`RequireFeature`) — o guard é só UX de roteamento.

**Testes:** +2 E2E em `frontend/e2e/auth.spec.ts` (admin → `/admin` e
nutritionist → `/nutritionist/workouts` por URL direta após full reload).

### 2. `time.Now()` cru em dado de negócio (updatedAt do post)

**Problema:** `repository.postData` gravava `updatedAt: time.Now()` — relógio
cru no repositório, fora do fuso de negócio (`America/Recife`, `service.Now()`).

**Correção (backend):**
- `repository.go` → `postData` usa `p.UpdatedAt` (definido pelo chamador).
- `handlers/social.go` e `service/social.go`: posts passam a ganhar
  `UpdatedAt` na criação (manual, tweet automático de treino e de dieta) e em
  toda mutação transacional — like, comentário, remoção de comentário e
  soft-delete por moderação.
- `handlers/diet.go`: despublicação do post automático de dieta também grava
  `UpdatedAt`.

**Regressão:** `repository_test.go` —
`TestPostDataPreservesLikesCommentsAndModeration` agora verifica que
`updatedAt` vem do struct, não do relógio.

**Auditoria completa de `time.Now()` no backend:** restaram apenas
`middleware/http.go` (rate limit — relógio técnico, sem fuso de negócio;
documentado) e `service/timezone.go` (`Now()`, a abstração oficial). Todos os
pontos de negócio usam `service.Now()`.

### 3. Limite de tamanho de entrada por campo (400)

**Problema:** textos controlados pelo cliente iam direto para o Firestore e
para a UI/feed sem limite por campo (só o teto global de 1 MiB do `MaxBody`).

**Correção (backend):**
- `service/constants.go`: constantes `MaxPostText`, `MaxCommentText`,
  `MaxNameLength`, `MaxBioLength`, `MaxDescriptionLength`, `MaxNoteLength`,
  `MaxDietContentLength`, `MaxRejectReason` — medidas em **runas** (Unicode),
  não bytes (limite justo para acentos/emoji).
- `handlers/handlers.go`: helper `tooLong(s, max)` centralizado.
- Validações → 400 aplicadas em: post (`text`), comentário, `PUT /api/me`
  (nome/bio), criação/edição de treino (nome/descrição/objetivo), criação/edição
  de dieta (nome/descrição/content), plano (nome/descrição), log de dieta
  (nota/legenda), conclusão de treino (legenda), motivo de recusa.
- **Fechado neste checkpoint:** duplicação de treino/dieta (`newName` —
  acontecia bypass do limite de nome) e edição de aluno pelo nutricionista
  (nome/bio — mesma regra do `PUT /api/me`).

**Testes:** unitário `TestTooLong` (runas/emoji) + cadeia real:
`TestChainAddCommentTooLongRejected`, `TestChainCreatePostTooLongRejected`,
`TestChainDuplicateWorkoutTooLongRejected`, `TestChainDuplicateDietTooLongRejected`,
`TestChainUpdateStudentTooLongRejected`.

### 4. Perfil público sem vazamento de dados sensíveis

**Problema (verificação):** `GET /api/public/profile/{id}` devolve
`models.PublicProfile` (DTO), mas não havia teste garantindo que campos
sensíveis nunca vazam na serialização.

**Correção (backend, teste novo):** `service/public_test.go` —
`TestGetPublicProfileDoesNotExposeSensitiveFields` monta um perfil COMPLETO
(email, status, plano, features, vínculo, histórico de aprovação, datas) e
verifica que a serialização pública não contém nenhum desses campos. `Streak`/
`Score`/`CycleID`/`Rank` continuam públicos como previsto no contrato.

### 5. Auditoria de payloads JSON (rotas de escrita)

Revisão rota a rota de `backend/handlers/` + `main.go`:
- Decode malformado → **400** em todas as rotas de escrita (`json.Decoder`).
- Campos obrigatórios checados: `id` (create user), `role` (approve),
  `name` (treino/dieta/plano), `workoutId` (complete), `planID` (assign-plan),
  `date` (diet-log, com formato validado), post com texto OU referência.
- Sem furos de missing-field/wrong-type encontrados além do tamanho (item 3).

**Risco residual documentado:** counters numéricos sem range-check
(duracao/exercicios de `CompleteWorkoutRequest`) e campos aninhados de
exercícios/refeições não ganharam limite por campo (cobertos pelo `MaxBody`
de 1 MiB e por serem escritos por nutricionista/admin). Não houve mudança no
decode (campos desconhecidos continuam ignorados — compatibilidade retroativa
com clientes V1).

### 6. Documentação sincronizada

- `CLAUDE.md`:
  - Ponto 4 (createdAt): `dietLogData` também preserva o valor (não só
    `userProfileData`); cláusula "corrigir no V2" removida.
  - Ponto 5 (race do feed): marcado como corrigido na Fase 1
    (`UpdatePostTx`; `UpdatePost` removido da interface) — estava desatualizado.
- `docs/architecture/firestore-model.md`:
  - Seção "Convenções" (timestamps) e `DietDailyLog`: createdAt preservado.
  - Seção "Regras de segurança": reescrita para refletir as regras endurecidas
    (escrita de negócio só via API Go; allowlist de `users` update; leitura
    por `isApprovedUser`/`canViewStudentData`).
- `docs/progress.md`: seção "Hardening pré-F13", contagens atualizadas
  (backend 119, E2E 19), checklist do deep-link marcado como feito, histórico.

## Auditorias confirmadas (sem mudança de código)

- **createdAt imutável**: `userProfileData`, `dietLogData` e
  `UpdateWorkout`/`UpdateDiet` (MergeAll sem createdAt) — confirmado por
  testes existentes.
- **Timezone**: todas as datas de negócio passam por `service.Now()` /
  `AppLoc` (`America/Recife`) — confirmado (item 2).
- **Ownership**: nutricionista não transfere treino/dieta via body
  (`HandleUpdateWorkout`/`HandleUpdateDiet`/`HandleDuplicate*`) — coberto por
  testes de cadeia existentes; `CanAccessStudent` valida o vínculo do aluno.
- **Matriz de autorização**: todas as rotas de `main.go` passam por
  `Require` + `RequireApproved`/`Allow`/`RequireFeature` na ordem correta —
  confirmado pelos testes de cadeia da Fase 1 e E2E.
- **Firestore rules**: nenhuma mudança necessária — 53/53 verdes no Emulator.

## Gates

| Gate | Antes | Depois |
|---|---|---|
| Backend `go vet ./...` | limpo | limpo |
| Backend `go test ./...` | 112 | **119** ✅ |
| Firestore rules (Emulator) | 53 | **53/53** ✅ |
| Vitest | 28 | **28/28** ✅ |
| Playwright E2E | 17 | **19/19** ✅ |
| `tsc --noEmit` | ✅ | ✅ |
| `next build` | ✅ | ✅ |
| Lint frontend | 0/0 | **0/0** ✅ |

## Pendências (fora do escopo deste hardening)

- Status `blocked` vs `paused`/`inactive` (pergunta de produto em aberto —
  as regras continuam negando status fora da whitelist).
- Range-check de contadores numéricos em `CompleteWorkoutRequest` (risco
  residual aceito; ver item 5).
- Limites por campo em itens aninhados de treino/dieta (exercícios, refeições)
  — candidato a regra única quando a F5/F8 estruturar bibliotecas.
- Reativar `react-hooks/set-state-in-effect` na migração RSC/SWR (dívida já
  registrada na Fase 3).