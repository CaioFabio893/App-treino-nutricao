# Projeto

Plataforma de treino + nutrição da personal **Louise Lima** — reescrita profissional V2 sobre Go + Next.js + Firestore + Firebase Auth.
Produção no Cloud Run (`southamerica-east1`); a V2 é a implementação ativa deste repositório (a V1 legada vive no histórico/mesmo repo).
Este arquivo é a **memória compartilhada entre OpenCode e Codex** — se divergir do código, vale o código; se divergir dos gates, vale o `.gates`.
Alvo da simplificação: fluxo `Login → Minha área → Treinos | Dieta` com **2 papéis**.

# Stack

- Backend: Go 1.23, API REST (`backend/`, módulo `treino-louise/backend`).
- Frontend: Next.js 16 + React 19 + TypeScript, `output: standalone` (`frontend/`), PWA com `sw.js`.
- Dados: Firestore; regras `firestore.rules`; índices compostos `firestore.indexes.json` (**11**).
- Auth: Firebase Auth e-mail/senha (Google é legado — ADR-002 decidido, execução pendente).
- Testes: Go (206), Vitest (104 em 18 arquivos), Playwright E2E (30), rules no emulador (86).
- Deploy: Cloud Run via Cloud Build; `firebase deploy --only firestore` para rules.

# Arquitetura

- Camadas: handler → middleware → service → repository → Firestore.
- **Escrita de dados de negócio só pela API Go** (Admin SDK); `firestore.rules` nega o cliente direto, inclusive admin via SDK de cliente — rules são a 2ª linha de defesa.
- **Modelo de 2 papéis**: `RoleAdmin = "admin"` e `RoleStudent = "student"` (`backend/models/types.go:12-15`). `RoleNutritionist` e `NutritionistID` **não existem**; `CanAccessStudent` foi deletada.
- Acesso = `CanAccessResource(uid, role, studentID)` (`backend/service/access.go:10`): admin vê tudo; aluno só o recurso com `studentID == uid`.
- Aprovação (`service.ApproveUser`, `backend/service/approval.go:16-19`) **rejeita** papel ≠ `student` (`ErrInvalidRole` → 400, anti-escalada): aprovar define plano/features, nunca papel; `admin` só vem de `POST/PUT /api/users`.
- Frontend: área de gestão = `frontend/app/admin/` (13 rotas mapeadas 1:1 da antiga área de nutricionista + `admin/usuarios/`); `frontend/app/nutritionist/` **deletada**; `DemoRoleSwitch.tsx` deletado → `frontend/components/AdminAreaSwitch.tsx`.
- Modelo: `users`, `workouts`, `diets`, `programs` (referenciam treino por `workoutId`, não embutem), `exercises`, `plans`, `posts`, `workoutHistory`, `dietLogs`, `scores`.
- Invariantes: timezone `America/Recife` (`service.Now`/`AppLoc`, nunca `time.Now()` cru); `createdAt` imutável; allowlist de update em `users` (`name`/`email`/`photoURL`/`bio`) e `PUT /api/me` zerando campos não editáveis; `ALLOWED_ORIGIN` obrigatório em produção; rate limit por ambiente; feed com transação `UpdatePostTx`.
- Prioridades: Correção > Segurança > Testabilidade > Manutenibilidade > Simplicidade > Performance > Velocidade. TDD obrigatório.

# Estado atual

**Gates medidos em 30/09/2026:**

| Gate | Resultado |
|---|---|
| `go vet` + `go test ./...` | vet limpo · **206 PASS / 0 FAIL** |
| Vitest | **104 PASS / 104** (18 arquivos, 3 execuções seguidas sem flakiness) |
| Firestore rules (emulador) | **86 passing** |
| Playwright E2E | **30 passed / 30** (2.3 min, 1 tentativa) |
| `tsc --noEmit` | OK |
| `npm run lint` | **0 problemas** |
| `next build` | OK |

- **Commitado:** todas as fases anteriores (Fase 0–3, biblioteca de exercícios, F13–F19); última fase concluída F19 — Programa de Treino (26 set 2026).
- **Na árvore SEM commit: 109 arquivos** = execução da **F4 da simplificação** (remoção do papel `nutritionist`). É o único trabalho não commitado; os gates acima foram medidos com essa árvore.

# Refatoração em andamento (simplificação F0–F7)

Objetivo (`docs/simplificacao/`): reduzir a V2 a 2 papéis e ao fluxo `Login → Minha área → Treinos | Dieta`, removendo 5 eixos da V1.

| Fase | Escopo | Status |
|---|---|---|
| F0 | Baseline, inventário e plano (`01-baseline.md`, `02-inventario.md`, `03-plano.md`, `04-perguntas.md`) | feito |
| F1 | Gamificação: score, ranking, streak, perfil público, check-in | não iniciado |
| F2 | Comunidade: posts, likes, comentários, feed | não iniciado |
| F3 | Planos/features: `plans/`, `planID`, `features`, `RequireFeature`, `PlansManager` | não iniciado |
| F4 | Papel `nutritionist` (2 papéis + `CanAccessResource`) | **feito — sem commit** |
| F5 | Escrita do participante (`workoutHistory`, `dietLogs`, marcar-treino-feito) → read-only | não iniciado |
| F6 | Modelo final + reindex (limpar índices órfãos e coleções mortas) | não iniciado |
| F7 | Provar a regra de acesso (caso positivo e negativo em Go + rules + E2E) | não iniciado |

- **F4 foi executada fora da ordem do plano** — o plano previa F4 por último (após F1–F3); o repo fez F4 primeiro.
- Por isso os **gates projetados do plano estão obsoletos**: o que valem são os medidos hoje (Go 206 · Vitest 104 · E2E 30).

# Decisões importantes

Não rediscutir sem necessidade:

- **2 papéis** (`admin`, `student`); F4 já executada — **não voltar atrás**, não reintroduzir `nutritionist`.
- Escrita de negócio **só via API Go**; rules negam cliente (inclusive admin via SDK).
- Timezone `America/Recife` (`service.Now`/`AppLoc`) e `createdAt` imutável (nunca sobrescrito em update).
- Programas **referenciam** treino por `workoutId` e validam posse (`service/program.go:106` compara `w.StudentID != p.StudentID`); `assign` materializa cópias (F19).
- **ADR-002: só e-mail/senha** — decisão fechada, execução pendente; não reabrir a decisão, executar.
- Allowlist de `users` update (`name`/`email`/`photoURL`/`bio`) + `PUT /api/me` zerando campos não editáveis.
- `ALLOWED_ORIGIN` obrigatório em produção (ausente ou `*` = boot falha); rate limit com defaults por ambiente.
- Aprovar define plano/features, nunca papel.

# Decisões pendentes do dono (P1–P8)

Fonte: `docs/simplificacao/04-perguntas.md`. **P1 e P2 eram bloqueantes — na prática o código já não tem esses caminhos** (confirmar e fechar).

| # | Pergunta | Default do plano | Status real (30/09/2026) |
|---|---|---|---|
| P1 | "Modo original" (`/api/sessions\|prs\|state`) sai? | REMOVER | **código já não tem — confirmar e fechar** (rotas fora de `registerRoutes`) |
| P2 | "Modo demo" (`DEMO_MODE`/`demoAs`/`NEXT_PUBLIC_DEMO`) sai? | REMOVER | **código já não tem — confirmar e fechar** (só menções em `frontend/README.md` e README raiz) |
| P3 | `photoURL`/`bio` saem; `<Avatar>` fica? | campo sai, componente fica | em aberto |
| P4 | `startDate`/`endDate` saem? | saem na F3 | em aberto |
| P5 | Participante `paused` vê treino/dieta? | vê, com teste | em aberto |
| P6 | Apagar `workoutHistory`/`dietLogs`/`posts`/`plans` de produção? | código sai; dados exportados e só então apagados | em aberto — **precisa de autorização** |
| P7 | 403 → 404 para recurso alheio? | 404 nos dois casos | em aberto |
| P8 | Manter materialização do `assign`? | manter | em aberto |

P1, P2 e P6 mudam escopo; as outras 5 têm default razoável e estão isoladas em uma fase cada.

# Trabalho concluído

- **Simplificação:** F0 (baseline/inventário/plano/perguntas) · **F4 — remoção do papel `nutritionist`, 109 arquivos, ainda sem commit**.
- Fases anteriores (commitadas): Fase 0 (auditoria V1 + docs + ADRs) · Fase 1 (correções TDD, rules 53→86, hardening de produção) · Fase 2 (Vitest, 104 testes) · Fase 3 (Playwright, 30 E2E).
- F5 (antiga): biblioteca de exercícios global com snapshot.
- F13: hardening de `PUT /api/me` (mass assignment corrigido) + allowlists.
- F14: PWA (auditoria + testes de service worker).
- F15.1–F15.3: auditoria pré-deploy, migração V1→V2 executada em produção, fechamento pós-migração.
- F16: auditoria "Nova dieta" (a11y) + secret scanning.
- F17: login sem Google, cadastro com confirmação, recuperação de senha.
- F19: Programa de Treino (import markdown, assign, duplicate) — 26 set 2026.

# Trabalho pendente

1. **F1** — gamificação (score, ranking, streak, perfil público, check-in).
2. **F2** — comunidade (posts, likes, comentários, feed).
3. **F3** — planos/features (`plans/`, `planID`, `features`, `RequireFeature`, `PlansManager`).
4. **F5** — escrita do participante vira read-only (`workoutHistory`, `dietLogs`, marcar-treino-feito).
5. **F6** — modelo final + reindex: inclui os **4 índices órfãos** de `nutritionistId+createdAt` em `firestore.indexes.json`.
6. **F7** — provar a regra de acesso (Go + rules + E2E, caso positivo e negativo).
7. **P6** — deleção de dados de produção (`workoutHistory`/`dietLogs`/`posts`/`plans`): **precisa de autorização** do dono (exportar antes de apagar).
8. **Rotação da chave** Firebase exposta no histórico git (commits `5f82005`→`3d59a6c`): restringir referrer + rotacionar (manual, dono).
9. **ADR-002 execução** — remover `password|google.com` de `backend/middleware/auth.go` e o fluxo Google do frontend.
10. **`GET /api/students/{id}`** (`backend/main.go:163`) sem `RequireApproved` — decidir se é intencional.
11. **`frontend/README.md`** com números velhos (61/23) e `NEXT_PUBLIC_DEMO` obsoleto (idem README raiz).
12. **Commit da F4** (109 arquivos na árvore) — checkpoint verde da governança.

# OpenCode

Orquestrador e volume: exploração (`explore`), docs, notas `contexto/*.md`, `.gates`, CRUD/DTOs/formulários, testes e integração, renomeações, build/lint/tsc, correções localizadas, re-rodar E2E e execução mecânica das fases da simplificação (F1–F5) e da execução do ADR-002.
Roteamento e cadeia de fallback em `.opencode/agent-routing.md`: gratuito no volume; pago só em implementação pesada (`code`) e auditoria (`review`).

# Codex

Só o que justifica raciocínio extra — nunca tarefa mecânica (regra de `AGENT_PLAN.md`):

1. Plano de rotação/limpeza da chave do histórico git (segurança, manual).
2. Revisão de segurança da mudança de auth na execução do ADR-002 (read-only).
3. Refatoração estrutural RSC/SWR + reativação da lint rule `set-state-in-effect`.
4. Otimização de performance do ranking (leituras Firestore).
5. Auditoria final de segurança pós-simplificação (ownership/IDOR, mass assignment, dados públicos).

# Dependências

1. Fechar P1/P2 (confirmar no código) → fixa o escopo de F5/F6.
2. P6 autorizado (e dados exportados) antes de qualquer deleção de coleção na F5/F6.
3. F1 → F2 → F3 → F5 na ordem do plano; F6 (modelo final + reindex) só depois delas; F7 por último.
4. Rotação da chave e ADR-002 são independentes da simplificação; ADR-002: OpenCode executa, Codex revisa.
5. Auditoria final de segurança (Codex) somente após as mudanças estruturais.

# Arquivos importantes

- Estado/governança: `PROJECT_STATE.md`, `AGENT_PLAN.md`, `CLAUDE.md`, `docs/progress.md`, `.gates`, `CONTEXTO.md` + `contexto/*.md`, `.opencode/agent-routing.md`.
- Simplificação: `docs/simplificacao/00-comandos.md`, `01-baseline.md`, `02-inventario.md`, `03-plano.md`, `04-perguntas.md`.
- Decisões/docs: `docs/decisions/ADR-*.md`, `docs/security/plans.md`, `docs/api/api.md`, `docs/architecture/firestore-model.md`, `docs/design/design-system.md`, `docs/reports/`.
- Backend: `backend/main.go`, `backend/models/types.go`, `backend/middleware/auth.go`, `backend/service/` (access, approval, program, timezone), `backend/repository/repository.go`, `backend/handlers/`, `backend/cmd/e2eseed/` (nunca em produção).
- Dados: `firestore.rules`, `firestore.indexes.json`, `firestore-tests/`.
- Frontend: `frontend/app/admin/`, `frontend/app/(aluno)/`, `frontend/components/AdminAreaSwitch.tsx`, `frontend/lib/api.ts`, `frontend/lib/auth.tsx`, `frontend/lib/firebase.ts`.

# Testes

```bash
cd backend       && go vet ./... && go test ./... -count=1   # vet limpo · 206 PASS / 0 FAIL
cd frontend      && npm test                                  # Vitest 104/104 (18 arquivos)
cd frontend      && npm run test:e2e                          # Playwright 30/30 (2.3 min, pesado)
cd frontend      && npx tsc --noEmit && npm run lint          # tsc OK · lint 0 problemas
cd firestore-tests && npm test                                # rules 86 passing (emulador, exige Java)
cd frontend      && npm run build                             # next build OK
```

Rodar os gates completos antes de mudança estrutural; E2E isolado (não junto com outras suites).

# Problemas conhecidos

1. **4 índices órfãos** em `firestore.indexes.json` por `nutritionistId+createdAt` (workouts L20-27, programs L36-43, diets L52-59, workoutHistory L76-83): as queries `ListWorkoutsForNutritionist`, `ListDietsForNutritionist`, `ListProgramsForNutritionist`, `ListHistoryForNutritionist` não existem mais em `repository.go`. Resolver na **F6**.
2. `GET /api/students/{id}` (`backend/main.go:163`) sem `RequireApproved` — usuário pendente/inativo lê o próprio documento via ownership. Decidir se é intencional.
3. API key Firebase no histórico git (commits `5f82005`→`3d59a6c`) — ação manual pendente (restringir referrer + rotacionar).
4. ADR-002 não executado: backend aceita `password|google.com` (`backend/middleware/auth.go`) e o fluxo Google segue no frontend.
5. F7 não feita — autorização já verde em 6 spec files E2E, mas sem prova com caso positivo e negativo em Go + rules + E2E.
6. `frontend/README.md` com números velhos (61/23) e `NEXT_PUBLIC_DEMO` obsoleto.
7. Observação: a flakiness de worker do Vitest **não reproduziu** em 3 execuções seguidas (104/104) — registrar como observação, não como bug aberto.

# Última atualização

**30/09/2026** — reescrita completa de `PROJECT_STATE.md` para o estado real pós-F4: E2E estava **24/30** por causa da F4 e foi corrigido → **30/30**; documentação sincronizada com o modelo de 2 papéis; comentários obsoletos corrigidos; gates refechados (Go 206/0 · Vitest 104 · rules 86 · E2E 30 · tsc OK · lint 0 · build OK). F4 segue na árvore **sem commit** (109 arquivos); F1–F3 e F5–F7 não começaram.
