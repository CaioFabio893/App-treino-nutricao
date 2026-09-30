# PROJECT_STATE — Treino Louise

Memória compartilhada. Leia antes de trabalhar; expanda somente arquivos da próxima fase.

## Autorização atual (30/09/2026)

O dono autorizou Codex a assumir também a função OpenCode (créditos esgotados),
continuar trabalho local dentro dos seus limites e sempre registrar resultados e
instruções. A divisão antiga por agente em AGENT_PLAN.md não limita essa autorização.
Sem push, deploy, console, rotação ou deleção de produção nesta continuidade.
Usar defaults explícitos de docs/decisions/product-decisions.md para escolhas
locais; não registrá-los como respostas humanas. D6 segue sem autorização.

## Projeto e invariantes

Go + Next.js 16/React 19 + Firestore + Firebase Auth; Cloud Run em
southamerica-east1. Dois papéis: admin/student (F4, commit 061514b).
Handlers → service → repository. Escrita de negócio só via API Go/Admin SDK;
rules protegem cliente direto, com allowlist de perfil. Admin SDK ignora rules.
Preservar America/Recife, createdAt, allowlist de /api/me e users, CORS estrito,
rate limit, aprovação, ownership e snapshot dos treinos em programas.
Programas referenciam workoutId; assign materializa cópias e valida posse.

## Trabalho desta continuidade

F2 concluída: comunidade/posts/curtidas/comentários, publicação automática,
foto e bio removidos do código local; Avatar preservado com iniciais.
API antiga 404 e posts legados negados, aluno/admin. Índice posts removido
do arquivo local, sem deploy; dados reais preservados. Relatório:
docs/reports/simplificacao-f2-checkpoint.md.

F1 (gamificação) foi encontrada parcialmente implementada na árvore; Codex
revisou e completou o checkpoint. Removidos score/ciclo/ranking/perfil público,
rotas correspondentes, repositório/models e UI de ranking/timeline/adesão.
A conclusão e o E2E final constam em .gates e no relatório da fase.

Complementos Codex:
- Removeu constantes mortas de pontuação em backend/service/constants.go.
- Adicionou TestRemovedGamificationRoutesReturnNotFound: URLs antigas retornam 404.
- Adicionou rules negativas para scores/scores_history legados, aluno e admin.
- Dashboard testado com snapshot legado contendo ranking: card não reaparece.
- Corrigiu espaços em EOF de types.go/repository.go.
- F2 removeu social.go e dates.go: startOfDay ficou sem consumidor.
- Atualizou AGENT_PLAN.md para autorização de substituição do OpenCode.

Principais arquivos F1: backend/{main.go,main_test.go,models/types.go,
repository/repository.go,service/constants.go,service/dates.go,handlers/diet.go,
handlers/nutrition.go,cmd/e2eseed/main.go}; frontend/lib/{api.ts,types.ts},
layouts/navegação/dashboard, StudentDetail/PostCard e specs relacionados;
firestore.rules e firestore-tests/rules.test.js. Arquivos removidos estão no diff.

## Validação realizada (30/09/2026)

- Go vet limpo; go test ./... -count=1: 185 testes de nível superior PASS
  (subtestes não contam como testes de nível superior).
- Vitest completo: 99/99 em 17 arquivos; dashboard após regressão: 5/5.
- Rules em emulador: 88/88, incluindo posts legados e campos foto/bio negados.
- tsc --noEmit, lint e next build: OK.
- Playwright: 28/28 em 1,7 minutos; emuladores desligados ao final.

Go e Firebase CLI precisaram de execução fora do sandbox para cache/instalação
existente. Nenhuma dependência instalada. Firebase CLI fica em
C:/Users/caiof/AppData/Roaming/npm; Go cache exige permissão do usuário real.
Rules/E2E foram executados somente em emuladores locais. Executar E2E isolado.

## Estado e próxima tarefa

F4 já commitada; não repetir a indicação antiga de 109 arquivos sem commit.
F1 commitada em 8e35ec5; F2 concluída com gates verdes. F3/F5/F6/F7 pendentes.
Próximo: F3 planos/features, conforme docs/simplificacao/03-plano.md e AGENT_PLAN.md.
Ler somente social handlers/service/repository, Post/Comment models, rotas de
posts, Feed/PostCard, páginas comunidade/feed/activities, seed e testes afetados.
Remover planos/features e datas do perfil; adaptar aprovação/navegação; preservar auth,
treino, dieta, exercícios e programas. Um checkpoint verde por fase.
Depois F3 planos/features → F5 participante read-only → F6 modelo/índices → F7.
Não antecipar deleção de dados; não alterar produção. Não fazer K1 sem D6.

## Pendências relevantes

- Constante/tipo FeatureRanking e snapshots legados ainda compatíveis enquanto
  planos/features existem; sua remoção final pertence à F3. Sem endpoint/card de ranking.
- 4 índices órfãos nutritionistId: tratar na F6, sem deploy automático.
- GET /api/students/{id} sem RequireApproved: investigar intenção antes de mudar.
- D6 (workoutHistory/dietLogs/posts/plans): sem resposta; nenhum dado apagado.
- Auth: UI já removeu Google (E2E existente verifica isso); backend legado ainda
  aceita google.com. ADR-002 precisa revisão/migração das contas, etapa isolada.
- K6 concluído em docs/reports/phase-16-key-rotation-plan.md (commit 5ddfb52):
  caso (a), chave pública Web no histórico. Restrição/rotação não executadas.
- Produção V1/V2 divergente em docs: confirmar revisão real antes de qualquer deploy.
- Configs opencode.json e .opencode/* preexistentes: preservar; não incluir em
  commit de feature. Não supor que foram escritas nesta continuidade.

## Retomada

1. Leia este arquivo e .gates; confira git status/log para checkpoint real.
2. Confira decisões D1–D9 e use os defaults locais; D6 exige resposta explícita.
3. Faça F3 com mudanças focadas e testes do contrato preservado; rode gates
   necessários ao checkpoint estrutural, registrando contagens reais.
4. Atualize este estado e docs/progress.md; commit local conforme governança,
   sem push/deploy. Informe arquivos, testes, limitações e próxima fase.
