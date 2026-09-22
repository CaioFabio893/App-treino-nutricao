# CLAUDE.md — Treino & Nutrição V2

Contexto obrigatório para agentes trabalhando neste repositório.
**LEIA ANTES DE QUALQUER MUDANÇA.**

## O que é este projeto

Reescrita profissional (V2) do app "Treino & Nutrição" da **Louise Lima**
(plataforma de treino + nutrição para alunos). A V1 funciona em produção e
vive **neste mesmo repositório** (branch `main`) — o V2 é um rebuild aprovado
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

**Fase 2 — Testes de frontend (Vitest): CONCLUÍDA (22 set 2026).**
Fase 0 (análise/planejamento) concluída e aprovada; Fase 1 (correções TDD +
security rules + hardening) concluída; Fase 2 (Vitest 28/28) concluída.
**Próximo passo: Fase 3 — Playwright (E2E)** + retaguarda de lint.

Governança desde 20 set 2026: **execução contínua** — commits automáticos em
checkpoints verdes (Conventional Commits), **sem push/deploy**, sem tocar na
V1 em produção. Parar apenas para decisão de produto sem evidência, destruição,
credenciais, stack ou arquitetura fundamental. Detalhes em `docs/progress.md`.

## Stack e comandos

- Backend: Go 1.23+, mod `treino-louise/backend`. Testes: `go test ./...`
  (91 testes na V1 — chain de integração real sem Firebase em `main_test.go`).
- Firestore rules: testes em `firestore-tests/` (`cd firestore-tests; npm test` —
  sobe o emulador, roda 35 testes e derruba; exige Java + `firebase emulators:exec`).
- Frontend: Next.js 16 (standalone), `npm run dev` / `npm run build` /
  `npm run lint` / `npm test` (Vitest — 28 testes, Fase 2). V1 tinha zero
  testes de frontend; V2 mantém Vitest (unit/component) + Playwright (E2E).
- Firestore: regras em `firestore.rules`; índices em `firestore.indexes.json`
  (9 compostos). Emuladores configurados em `firebase.json` (Firestore
  127.0.0.1:8080) — rodar testes de regras contra o emulador, nunca produção.
- Ambiente: Windows + PowerShell (sem `rg` — usar ferramenta de grep do agente).
- `firestore.rules` protege contra acesso direto de cliente; a API Go usa
  Admin SDK (ignora regras) — **toda escrita de dados de negócio passa pela
  API Go** (desde a execução 20 set 2026, `users` update/delete e `plans`
  via SDK cliente são negados até para admin).

## Pontos de atenção herdados da V1 (não repetir na V2)

1. **Criar perfil como `pending_approval`** sem campos administrativos
   (role/planID/features/nutritionistID/approvedBy/approvedAt/rejectedReason)
   — o admin é quem define (já corrigido na V1, regra `isPendingSelfProfile`).
2. **Ownership imutável**: nutricionista nunca transfere treino/dieta para
   outro nutricionista via body (backend força `NutritionistID` do registro).
3. **Timezone oficial `America/Recife`** (`service/timezone.go`, `AppLoc`,
   `Now()`) — nunca `time.Now()` cru para datas de negócio.
4. **createdAt NUNCA é sobrescrito** na atualização (`userProfileData`
   preserva se != zero); `PutDietLog` ainda regrava `createdAt` a cada save —
   item a corrigir na V2 (transações).
5. **Race condition no feed** (`UpdatePost` = read-modify-write sem
   `RunTransaction`) — curtidas/comentários podem perder atualizações. Corrigir
   com transações no V2.
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
    allowlist sem fluxo real que o envie e sem teste de regras.