# CLAUDE.md — Treino & Nutrição V2

Contexto obrigatório para agentes trabalhando neste repositório.
**LEIA ANTES DE QUALQUER MUDANÇA.**

## O que é este projeto

Reescrita profissional (V2) do app "Treino & Nutrição" da **Louise Lima**
(plataforma de treino + nutrição para alunos). A V1 funciona em produção e
vive **nestee mesmo repositório** (branch `main`) — o V2 é um rebuild aprovado
da V1, e não uma adição à V1.

- **V1 (atual, funcional)**: Next.js 16.3.5 (React 19.2.8 + TypeScript) no
  `frontend/` + API Go 1.23 no `backend/` + Firestore + Firebase Auth
  (e-mail/senha **e** Google). Deploy: Cloud Run (`southamerica-east1`).
- **V2 (projeto)**: revisão completa — arquitetura, modelo de dados, regras
  de segurança, design system, API profissional e testes (TDD). A stack
  principal **permanece**: Go + Next.js + Firestore (ver
  `docs/architecture/technology-decision.md` e ADRs em `docs/decisions/`).

## Onde encontrar as decisões e planos

| Documento | Conteúdo |
|---|---|
| `docs/progress.md` | **Fonte da verdade de status** — fase atual, decisões tomadas, próximos passos |
| `docs/architecture/technology-decision.md` | Por que Go + Next.js + Firestore (decisão + critérios da seção 4) |
| `docs/architecture/system-architecture.md` | Camadas, middleware, fluxo de dados, deploy |
| `docs/architecture/firestore-model.md` | Coleções, documentos, índices compostos, regras |
| `docs/security/plans.md` | Planos (features), papéis, status e matriz de permissões |
| `docs/api/api.md` | Proposta da API profissional (contrato, erros, paginação) |
| `docs/design/design-system.md` | Tokens de design e especificação visual |
| `docs/reports/phase-00-analysis.md` | Auditoria da V1 (verificação da seção 3 + achados) |
| `docs/sdd/backlog.md`, `docs/sdd/status.md` | Vida V1 (histórico SDD) |
| `docs/decisions/ADR-*.md` | Decisões de arquitetura registradas |

## Fase atual (IMPORTANTE)

**F19 — Programa de Treino CONCLUÍDA (26 set 2026).**
Fase 0 (análise/planejamento) concluída e aprovada; Fase 1 (correções TDD +
security rules + hardening) concluída; Fase 2 (Vitest) concluída;
Fase 3 (Playwright E2E) concluída; F14 (PWA), F15.2 (migration), F15.3
(fechamento pós-migração), F16 (auditoria "Nova dieta"), F17 (login sem
Google) e F19 (Programa de Treino) concluídas. Backend `go vet`/`go test`
**206/206** · Firestore rules **86/86** · Vitest **104/104** ·
Playwright E2E **30/30** · `tsc --noEmit` ✅ · `next build` ✅ ·
**Lint frontend 0/0** ✅ (medidos em 30 set 2026).
**Próximo passo:** decisão de produto sobre F8 e ações manuais de segurança da
F16 — e, em paralelo, as perguntas P1–P8 da simplificação (ver seção abaixo).

## Refatoração em andamento — "simplificação"

Plano em `docs/simplificacao/` (`00-comandos.md`, `01-baseline.md`,
`02-inventario.md`, `03-plano.md`, `04-perguntas.md`), fases F0–F7.
**Já executado:** F4 — remoção do papel `nutritionist` (código **ainda sem
commit**); hoje o backend define só `admin` e `student`
(`backend/models/types.go`) e não existe mais o campo `NutritionistID`.
**Planejado, não executado:** F1 gamificação, F2 comunidade, F3 planos/features,
F5 escrita do participante, F6 modelo final + reindex, F7 provar a regra de
acesso — gamificação, comunidade e planos/features **ainda existem** no código.
As 8 decisões de produto P1–P8 (`docs/simplificacao/04-perguntas.md`) estão
todas em aberto; P1 ("modo original") e P2 ("modo demo") são bloqueantes.

Governança desde 20 set 2026: **execução contínua** — commits automáticos em
checkpoints verdes (Conventional Commits), **sem push/deploy**, sem tocar na
V1 em produção. Parar apenas para decisão de produto sem evidência, destruição,
credenciais, stack ou arquitetura fundamental. Detalhes em `docs/progress.md`.

## Stack e comandos

- Backend: Go 1.23+, mod `treino-louise/backend`. Testes: `go test ./...`
  (206 testes na V2 incluindo chain de integração, service, parser,
  repository e demais).
- Firestore rules: testes em `firestore-tests/` (`cd firestore-tests; npm test` —
  sobe o emulador, roda 86 testes e derruba; exige Java + `firebase emulators:exec`).
- Frontend: Next.js 16 (standalone), `npm run dev` / `npm run build` /
  `npm run lint` / `npm test` (Vitest — 104 testes) / `npm run test:e2e`
  (Playwright — 30 testes; sobe emuladores + backend + seed).
- Firestore: regras em `firestore.rules`; índices em `firestore.indexes.json`
  (11 compostos). Emuladores configurados em `firebase.json` (Firestore
  127.0.0.1:8080) — rodar testes de regras contra o emulador, nunca produção.
- Ambiente: Windows + PowerShell (sem `rg` — usar ferramenta de grep do agente).
- `firestore.rules` protege contra acesso direto de cliente; a API Go usa
  Admin SDK (ignora regras) — **toda escrita de dados de negócio passa pela
  API Go** (desde a execução 20 set 2026, `users` update/delete e `plans`
  via SDK cliente são negados até para admin; `programs` é totalmente negada ao
  cliente — todo acesso passa pela API Go).

## Pontos de atenção herdados da V1 (não repetir na V2)

1. **Criar perfil como `pending_approval`** sem campos administrativos
   (role/planID/features/approvedBy/approvedAt/rejectedReason)
   — o admin é quem define (já corrigido na V1, regra `isPendingSelfProfile`;
   a V1 também tinha `nutritionistID`, campo que **não existe mais** — a V2
   tem só os papéis `admin` e `student`).
2. **Ownership imutável (obsoleto — ver `docs/simplificacao/03-plano.md`)**:
   a regra da V1 ("nutricionista nunca transfere treino/dieta para outro
   nutricionista via body") dependia de `NutritionistID`, que **não existe
   mais** no código. Hoje o acesso é admin-vs-aluno:
   `service.CanAccessResource(uid, role, studentID)` (`backend/service/access.go`)
   — admin acessa tudo; `student` só o recurso do próprio `studentID`.
3. **Timezone oficial `America/Recife`** (`service/timezone.go`, `AppLoc`,
   `Now()`) — nunca `time.Now()` cru para datas de negócio.
4. **createdAt NUNCA é sobrescrito** na atualização (`userProfileData` e
   `dietLogData` preservam o valor se != zero; só criação usa
   `ServerTimestamp`). `UpdateWorkout`/`UpdateDiet` usam `Set(..., MergeAll)`
   sem `createdAt`, logo também não o sobrescrevem.
5. **Race condition no feed**: corrigida na Fase 1 — leitura-modificação-
   escrita de posts roda em `RunTransaction` (`UpdatePostTx`); o padrão antigo
   `GetPost → modifica → UpdatePost` foi **removido da interface** (impossível
   voltar a usar sem transação).
6. **V2 é e-mail/senha apenas** — login Google da V1 sai (decisão de produto).
7. Prioridades: **Correção > Segurança > Testabilidade > Manutenibilidade >
   Simplicidade > Performance > Velocidade**.
8. Sempre TDD (Red → Green → Refactor) na implementação, e regras do
   `firestore.rules` testadas com Emulator.
9. **Hardening de produção (20 set 2026)**: com `GO_ENV=production`,
   `ALLOWED_ORIGIN` é **obrigatório** (ausente ou `*` = boot falha); `RATE_LIMIT=0`
   rejeitado. Fora de produção os defaults são `http://localhost:3000` e
   600 req/min/IP — **nunca escreva fallback com `*`**. Deploy no Cloud Run
   precisa de `GO_ENV=production` + `ALLOWED_ORIGIN=<domínio exato do front>`.
10. **Allowlist de `users` update** (`allowedSelfProfileUpdate`): via SDK de
      cliente o dono só altera `name`/`email`/`photoURL`/`bio`
      (`affectedKeys().hasOnly`); `createdAt`/`authProvider`/campos
      administrativos mudam somente pela API Go. Não adicionar campo novo à
      allowlist sem fluxo real que o envie e sem teste de regras. A regra vale
      **também para o `PUT /api/me` (F13)**: o handler zera toda campo não
      editável (`role`/`status`/`planID`/`features`/
      `startDate`/`endDate`/aprovação/`createdAt`) e `AuthProvider` vem sempre
      do ID token — nunca do body. `GetOrCreateProfile` preserva do registro
      existente os dois campos que o body podia gravar antes da F13
       (`StartDate`/`EndDate` — ambos alimentam cálculo de pontuação).
11. **Programa referencia treino, não o embute (F19)**: `programs/{id}` guarda
    só `workoutId`+ordem, então **toda** rota que grava ou materializa programa
    (`POST /api/programs`, `PUT`, `assign`, `duplicate`) tem de conferir a posse
    de cada treino referenciado — `Service.ValidateProgramWorkoutOwnership`
    compara `w.StudentID != p.StudentID` (`backend/service/program.go`): o treino
    tem de pertencer ao **mesmo aluno** do programa. As rotas de programa são
    admin-only (`Allow(RoleAdmin)` em `main.go`). Sem essa checagem o `assign`
    materializa cópia de conteúdo de outro aluno (exfiltração). Reatribuir
    aluno só por `POST /assign`, que cria as cópias e recusa (409,
    `ErrProgramAlreadyAssigned`) trocar de aluno já atribuído.
