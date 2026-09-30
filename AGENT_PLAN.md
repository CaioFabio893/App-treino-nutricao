> Atualização de continuidade: F1–F7 concluídas localmente, com gates verdes.
> Codex autorizado a implementar e revisar sem OK entre fases. Divisão e
> contagens antigas abaixo são histórico. Usar PROJECT_STATE.md e .gates.

# Estratégia OpenCode + Codex

## Continuidade autorizada em 30/09/2026

O dono informou que os créditos OpenCode acabaram e autorizou o Codex a assumir
também implementação, testes, documentação e gates, dentro dos seus limites.
A divisão por agente abaixo é histórica e não bloqueia essa continuidade.
Sempre registrar trabalho e próximo passo em PROJECT_STATE.md.
F4 já está commitada em `061514b`; não repetir o checkpoint antigo da seção 13.
F1 foi encontrada em andamento e está sendo fechada pelo Codex; consultar o
estado e `.gates` antes de avançar. Usar os defaults explícitos da folha D1–D9
para escolhas locais sem atribuí-los à dona. D6 continua sem autorização de
deleção: nenhum dado de produção deve ser apagado. Sem push ou deploy.

Contrato de divisão de trabalho para a refatoração **"simplificação"** (`docs/simplificacao/`, fases F0–F7). Substitui o plano antigo (F8 Alimentos, RSC/SWR, performance de ranking), que não reflete mais a realidade do repositório.

## 1. Estratégia
**Objetivo**: reduzir a V2 a 2 papéis (`admin`, `student`) e ao fluxo `Login → Minha área → Treinos | Dieta`, removendo eixos herdados da V1 (gamificação, comunidade, planos/features, escrita do participante).

**Regra de ouro**: TDD (Red → Green → Refactor) em toda mudança; **um checkpoint verde por fase** — commit Conventional Commits com a suíte verde — e **sem push, sem deploy, sem tocar na V1 em produção** em nenhuma fase.

**Divisão**: OpenCode faz o grosso (implementação, testes, docs, gates, `.gates`, notas `contexto/*.md`, revisão de diff). Codex recebe só os 5 momentos K1–K5 (§12), onde o raciocínio extra paga o custo pago.

**Estado (30/09/2026)**: F4 (remoção do papel `nutritionist`) executada e **sem commit** (109 arquivos na árvore) — commitar F4 é o passo 1. F1, F2, F3, F5, F6 e F7 não começaram.

**Gates medidos (referência)**: gate atual: 206 go (vet limpo) / 104 vitest (18 arquivos) / 86 rules / 30 e2e · tsc OK · lint 0/0 · build OK. **Esse conjunto cai a cada fase** (a fase apaga código e o teste junto). Após cada fase, medir de novo e registrar em `.gates`; número futuro é `TBD`, nunca chute.

## 2. Fase 0 — Fechar decisões do dono (bloqueia F1–F3)
**OpenCode**: monta a folha de decisões a partir de `docs/simplificacao/04-perguntas.md` (P1–P8, todas em aberto) e leva ao dono, com os fatos já confirmados:
- **P1** `/api/sessions|prs|state`: fora de `registerRoutes` → default **REMOVER**.
- **P2** `DEMO_MODE`/`demoAs`/`NEXT_PUBLIC_DEMO`: fora do código do frontend; só sobram menções em `frontend/README.md` e README raiz → default **REMOVER** (limpar as menções).
- **P5** `paused`: recomendação = continua vendo treino/dieta, com teste (cai na F5).
- **P6** destruição de dados: só `scores/`/`scores_history/` têm autorização prévia; `workoutHistory/`, `dietLogs/`, `posts/`, `plans/` exigem decisão explícita → vira K1. Código sai sempre; **dados exportados antes** de apagar.
- P3, P4, P7, P8: fechar contra `02-inventario.md`/`03-plano.md`.

**Codex**: nada nesta fase — decisões de produto são do dono.

## 3. Fase 1 — F1 gamificação
### OpenCode
Remover `backend/service/score.go`, `cycle.go`, `ranking.go`, `public.go`, `frontend/app/(aluno)/ranking/`, coleções `scores`/`scores_history` e os testes correspondentes (Go, Vitest, rules, E2E), conforme `docs/simplificacao/03-plano.md` F1. Ajustar `firestore.rules` e `firestore.indexes.json`; atualizar notas `contexto/*.md` e `docs/progress.md`. Remoção com TDD: primeiro os testes do comportamento que sai, depois o código, depois verde.
### Codex
Nada. Remoção pura com o teste existente como contrato — não paga o modelo pago.
### Validação
Checkpoint verde (commit, sem push). **Gates esperados**: gate atual de referência 206 go / 104 vitest / 86 rules / 30 e2e — **cai nesta fase**; medir e registrar o novo valor em `.gates`. tsc/lint/build continuam OK.

## 4. Fase 2 — F2 comunidade
### OpenCode
Remover `backend/service/social.go`, `frontend/app/(aluno)/comunidade/`, `frontend/app/profile/[id]/`, rotas de posts/likes/comentários (entrada em `backend/main.go`), `bio`/`photoURL` do modelo (`backend/models/types.go`) e dos DTOs. A allowlist de `users` update em `firestore.rules` perde `bio`/`photoURL` (mantém `name`/`email`); testes de `posts/` saem junto.
### Codex
Nada — mas a remoção entra no escopo do parecer K3 (§9).
### Validação
Checkpoint verde. **Gates esperados**: gate atual de referência 206 go / 104 vitest / 86 rules / 30 e2e — cai nesta fase; medir e registrar em `.gates`. tsc/lint/build OK.

## 5. Fase 3 — F3 planos/features
### OpenCode
Remover `plans/`, `planID`, `features`, `RequireFeature`, `PlansManager`, a rota de atribuir plano e os índices compostos de `firestore.indexes.json` que só filtravam por feature; testes Go/Vitest/rules/E2E correspondentes. Preservar `RequireApproved` e `role`.
### Codex
Nada.
### Validação
Checkpoint verde. **Gates esperados**: gate atual de referência 206 go / 104 vitest / 86 rules / 30 e2e — cai; medir e registrar em `.gates`. tsc/lint/build OK. Sobras de índice anotadas para F6/K2.

## 6. Fase 4 — F5 participante read-only
### OpenCode
Remover a escrita em `workoutHistory`/`dietLogs` e o "marcar treino feito" (`POST /api/workouts/complete`), mantendo a leitura do próprio treino/dieta. Comportamento de `paused` conforme P5 (Fase 0): continua vendo, **com teste** positivo e negativo. `firestore.rules`: escrita do participante negada; allowlist de update ajustada.
### Codex
Nada.
### Validação
Checkpoint verde. **Gates esperados**: gate atual de referência 206 go / 104 vitest / 86 rules / 30 e2e — cai; medir e registrar em `.gates`. O E2E de leitura do aluno permanece verde.

## 7. Fase 5 — F6 modelo final + reindex
### OpenCode
Consolida o schema final (2 papéis, coleções remanescentes) conforme `docs/simplificacao/03-plano.md` F6; remove da árvore os **4 índices órfãos** por `nutritionistId` em `firestore.indexes.json`; escreve o plano de reindex com base em K2. **Não apaga dados de produção** — isso é K1 + dono.
### Codex — K1: Plano de deleção segura de dados de produção (P6)
**CONTEXTO NECESSÁRIO** — `docs/simplificacao/04-perguntas.md` (P6; pré-autorizado só `scores/`/`scores_history/`), `docs/simplificacao/03-plano.md` (F6), `docs/architecture/firestore-model.md`, `firestore.rules`, `firestore.indexes.json`.
**OBJETIVO** — ordem segura para apagar `workoutHistory/`, `dietLogs/`, `posts/`, `plans/`, `scores/`, `scores_history/`; o que exportar antes (backup/Firestore export); como provar que nada quebrou (consultas + gates); rollback. Documento apenas — **não executa**; depende de autorização do dono (P6).
**NÃO ALTERAR** — nenhum arquivo do repo; nenhum comando contra produção; nenhuma deleção.
**VALIDAÇÃO** — entrega em Markdown no card. OpenCode confere que toda consulta viva apontada por F1–F5 cobra as coleções listadas e que a ordem respeita "exportar → apagar → revalidar gates".
### Codex — K2: Reindex e índices órfãos (decisão da F6)
**CONTEXTO NECESSÁRIO** — `firestore.indexes.json` (11 compostos, 4 órfãos por `nutritionistId`), `docs/architecture/firestore-model.md`, `docs/simplificacao/03-plano.md` (F6), `backend/repository/` (queries reais).
**OBJETIVO** — dizer quais índices criar/remover, em que ordem operá-los e o risco de indisponibilidade de query durante a transição; plano de reindex passo a passo.
**NÃO ALTERAR** — `firestore.indexes.json` (quem aplica é OpenCode); nada executado em produção.
**VALIDAÇÃO** — cada índice justificado por uma query real; ordem + janela de risco + rollback; entrega em Markdown no card.
### Validação (Fase 5)
Checkpoint verde com **gates medidos** (gate atual de referência 206 go / 104 vitest / 86 rules / 30 e2e — cai; medir e registrar em `.gates`) **e** plano de reindex escrito (K2); K1 na fila do dono.

## 8. Fase 6 — F7 gate de aceitação
### OpenCode
Implementa o gate com TDD: cenário Go — aluno A acessa recurso de B → 403/404 (`backend/service/access.go`), caso no emulador de regras (`firestore-tests/`) e E2E (`npm run test:e2e`), com **caso positivo e negativo**. Um checkpoint verde.
### Codex — K4: Revisão do gate de aceitação (F7)
**CONTEXTO NECESSÁRIO** — `docs/simplificacao/03-plano.md` (F7), `backend/service/access.go`, `backend/main.go` (rotas + `Allow(RoleAdmin)`), testes Go de acesso, `firestore-tests/`, suíte Playwright (`npm run test:e2e`).
**OBJETIVO** — responder se o cenário prova mesmo a regra e caçar caso negativo faltando (aluno lê recurso de outro aluno, rota sem checagem de ownership, aluno escreve onde só deveria ler).
**NÃO ALTERAR** — read-only: não editar código nem testes.
**VALIDAÇÃO** — lista de casos cobertos × casos faltantes; se faltar algum, OpenCode escreve o teste antes de fechar F7.
### Validação (Fase 6)
Checkpoint verde com os 3 níveis do gate. **Gates esperados**: gate atual de referência 206 go / 104 vitest / 86 rules / 30 e2e — go/vitest/rules podem cair, **e2e pode subir** pelos novos casos; medir e registrar em `.gates`.

## 9. Fase 7 — Hardening e auditoria final
### Codex — K3: Parecer de segurança da remoção em massa (F1–F5)
**CONTEXTO NECESSÁRIO** — `docs/simplificacao/03-plano.md`, `firestore.rules`, `backend/main.go`, `backend/middleware/`, `frontend/lib/api.ts`, diff dos commits de checkpoint F1–F5.
**OBJETIVO** — dizer o que a exclusão de gamificação/comunidade/planos abre: IDOR, dado antes público, cache/serviço que ainda chama rota removida, rota sem proteção, regra de rules órfã.
**NÃO ALTERAR** — read-only.
**VALIDAÇÃO** — achados com severidade + recomendação; OpenCode aplica com TDD.
### Codex — K5: Auditoria final de segurança (pós F1–F7)
**CONTEXTO NECESSÁRIO** — diff consolidado F1–F7, `firestore.rules`, `backend/middleware/`, `backend/service/access.go`, `backend/main.go`, `docs/security/plans.md`, `docs/architecture/firestore-model.md`.
**OBJETIVO** — varredura de auth, ownership/IDOR, mass assignment, validação de payloads, timezone `America/Recife` e `createdAt` nunca sobrescrito, regras no emulador.
**NÃO ALTERAR** — read-only.
**VALIDAÇÃO** — achados priorizados; OpenCode corrige com TDD e registra decisão para o que não for corrigido.
### OpenCode
Aplica as correções apontadas por K3/K5 e faz a manutenção contínua: docs, notas `contexto/*.md`, `.gates`, build/lint, E2E, revisão de diff.
### Validação (Fase 7)
Gates finais medidos e escritos em `.gates` (referência antes desta fase: 206 go / 104 vitest / 86 rules / 30 e2e — medir o valor real pós-correções); nenhum achado de K5 aberto sem decisão registrada.

## 10. Tarefas fora da simplificação (independentes)
- **ADR-002 — remover login Google** (decidido, não executado; o backend ainda aceita `password|google.com`): OpenCode executa com TDD; **Codex revisa o diff de autenticação** (revisão pontual, não é um K).
- **Chave Firebase no histórico git** (`5f82005`→`3d59a6c`): plano de rotação é do **Codex**; execução é do **dono** (ação manual, fora do alcance de agente).
- **`GET /api/students/{id}` sem `RequireApproved`**: OpenCode investiga e propõe; se confirmado o risco, vira achado de K5.
- Limpeza das menções de `DEMO_MODE` em `frontend/README.md` e README raiz acompanha P2 (Fase 0).

## 11. Cartão de tarefa (prompt para o Codex)
Modelo de 6 blocos de `docs/guides/ia-organizacao-tarefas.md`, sempre com **CONTEXTO NECESSÁRIO / OBJETIVO / NÃO ALTERAR / VALIDAÇÃO**: (1) ID + título (K1…K5, com a fase); (2) CONTEXTO NECESSÁRIO — só os arquivos abaixo, proibido "leia o repo inteiro"; (3) OBJETIVO — uma entrega concreta; (4) NÃO ALTERAR; (5) VALIDAÇÃO — como OpenCode aceita ou devolve; (6) Entrega — Markdown no card, sem commit.

Escopo de leitura por K:

| K | Arquivos |
|---|---|
| K1 | `docs/simplificacao/04-perguntas.md` · `docs/simplificacao/03-plano.md` · `docs/architecture/firestore-model.md` · `firestore.rules` |
| K2 | `firestore.indexes.json` · `docs/architecture/firestore-model.md` · `docs/simplificacao/03-plano.md` · `backend/repository/` |
| K3 | `docs/simplificacao/03-plano.md` · `firestore.rules` · `backend/main.go` · `backend/middleware/` · `frontend/lib/api.ts` · diff F1–F5 |
| K4 | `docs/simplificacao/03-plano.md` · `backend/service/access.go` · `backend/main.go` · `firestore-tests/` · Playwright |
| K5 | diff F1–F7 · `firestore.rules` · `backend/middleware/` · `backend/service/access.go` · `docs/security/plans.md` |

## 12. Economia de Codex
Pergunta aplicada a cada item: **"o OpenCode não conseguiria com segurança?"**

Tirado do Codex de propósito (resposta: conseguiria — remoção guiada por teste existente, texto ou verificação mecânica; errar custa menos que a cota): **F1, F2, F3, F5, a implementação de F7, docs, testes, gates, `.gates`, notas de `contexto/*.md` e revisão de rotina de diff.**

Ficam os 5 K, onde a resposta honesta é "não com a mesma segurança":

| K | Título | Por que paga |
|---|---|---|
| K1 | Plano de deleção segura de dados de produção (P6) | destrutivo e irreversível; não tem teste de rollback |
| K2 | Reindex e índices órfãos (decisão da F6) | janela de indisponibilidade de query exige planejamento fino |
| K3 | Parecer de segurança da remoção em massa (F1–F5) | apagar código abre superfície nova que quem apaga não vê |
| K4 | Revisão do gate de aceitação (F7) | quem escreve o teste prova o que já sabe; falta caso negativo |
| K5 | Auditoria final de segurança (pós F1–F7) | varredura ampla de auth/IDOR/mass assignment pós-mudança grande |

## 13. Ordem de execução
1. Commit de F4 (sem push) — está na árvore, sem commit.
2. **Fase 0 — decisões do dono** (P1–P8; P1/P2 default REMOVER; P6 → K1). **Bloqueia F1–F3.**
3. F1 → F2 → F3 → F5, um checkpoint verde por fase, gates medidos a cada uma.
4. F6 (consolidação + 4 índices órfãos) com K2 do Codex; **K1 executa só com autorização do dono** — deleção de dados é etapa separada dos commits, após exportação.
5. F7 (gate implementado por OpenCode) + K4 do Codex.
6. Fase 7: K3 e K5, correções aplicadas, gates finais em `.gates`.
7. Em paralelo e independente: ADR-002 (OpenCode), rotação da chave (**dono**, plano do Codex), `GET /api/students/{id}` (OpenCode investiga).
