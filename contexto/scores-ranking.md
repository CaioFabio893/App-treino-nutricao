# Area: SCORES, RANKING e ADESAO

> 30/09/2026 — F1 removeu esta funcionalidade do código local. O conteúdo
> abaixo é referência histórica, não um mapa de arquivos existentes.
> Rotas antigas retornam 404; scores legados são negados pelas rules inclusive
> para admin via SDK. Nenhum dado de produção foi apagado. Retomada: PROJECT_STATE.md.

## Onde esta o codigo

**API (Go)**
- `backend/service/score.go` — calculo de nota/pontuacao
- `backend/service/ranking.go` — montagem do ranking
- `backend/handlers/scores.go` — rotas de score
- `backend/handlers/social.go` — parte publica/social do score

**App (aluno)**
- `frontend/app/(aluno)/ranking/page.tsx`
- `frontend/components/AdherenceChart.tsx`

**App (admin / profissional)**
- `frontend/app/admin/ranking/page.tsx` — visao de ranking do admin

**Testes**
- `backend/service/service_test.go` — `TestScoreFromPointsAndRaw` e
  `TestCycleScoreFromData` (score), `TestBuildRanking` (ranking)
- `backend/main_test.go` — `GET /api/ranking` nunca vira publica (401 sem token)
- `frontend/__tests__/Ranking.test.tsx` — pagina de ranking do aluno
- `frontend/e2e/ranking.spec.ts` — pontuacao calculada pelo backend no emulador
- `firestore-tests/rules.test.js` — `scores_history` so para o dono ou admin

## Conceitos

- **Adesao:** o aluno fez o que o programa pedia? Mede adherence.
- **Score:** numero derivado de execucao e adesao.
- O ranking compara alunos do mesmo programa/grupo.

## Pendencias

<!-- escreva aqui -->
- [ ] `backend/service/score.go` e `backend/service/ranking.go` nao tem arquivo de
      teste proprio: a cobertura esta em `backend/service/service_test.go`
- [ ] o gate de feature de ranking nao tem caso na cadeia (`backend/main_test.go`);
      hoje ele so aparece no E2E `frontend/e2e/aluno.spec.ts` e
      `frontend/e2e/autorizacao.spec.ts`
- [ ] `frontend/components/AdherenceChart.tsx` nao tem teste de tela

## Cuidado

- Score e calculado a partir de TREINOS (ver `treinos.md`). Mudar regra de
  execucao muda o ranking de todo mundo retroativamente.
- Decisao de negocio: se a nota vale para o historico ou so para o futuro.
  Deixar isso escrito aqui antes de mexer na formula.
