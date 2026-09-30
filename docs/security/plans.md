# Papéis, aprovação e permissões — modelo simplificado

Estado local em 30/09/2026. Código em main.go, middleware/auth.go,
service/access.go e firestore.rules. A política anterior de planos/features
foi aposentada; está preservada no histórico Git.

## Acesso pela API Go

| Identidade | Perfil próprio /api/me | Treino/dieta/programa próprios | Alheios ou inexistentes | Escrita de negócio |
|---|---|---|---|---|
| Sem token válido | 401 | 401 | 401 | 401 |
| student active | leitura e nome/e-mail | 200 | 404 | 403 |
| student paused | leitura e nome/e-mail | 200 | 404 | 403 |
| student legado status vazio/ausente | leitura e nome/e-mail | 200 | 404 | 403 |
| student pending/rejected/inactive/status desconhecido | leitura e nome/e-mail | 403 | 403 | 403 |
| papel desconhecido/aposentado | perfil próprio | 403 | 403 | 403 |
| admin autenticado | permitido | qualquer recurso existente | inexistente 404 | permitido pelos endpoints admin |

Admin mantém bypass de status para administrar a plataforma. Criar/alterar
papel administrativo continua tarefa admin; aprovar cadastro aceita somente
student. Perfil ausente fica pendente, sem acesso de negócio. GET/PUT /api/me
preservam onboarding e autorizações: cliente não define role/status/createdAt/
auditoria. GET /api/students/{id} agora exige aprovação como os outros recursos.

404 para dados alheios é default D7; resposta usa a mesma mensagem do recurso
inexistente. Listas do aluno consultam somente studentId do UID autenticado.
Coleções de biblioteca sem aluno não ficam visíveis ao aluno.

Nenhum fluxo de aluno conclui treino ou registra refeição. Administrador segue
com CRUD de exercícios, treinos, programas, dietas e usuários. Atribuição de
programa materializa cópias dos treinos; valida referências e preserva snapshots.

## SDK direto / Firestore Rules

Admin SDK ignora rules: a proteção da API é independente.
Cliente direto lê o próprio perfil; admin pode ler perfis. Self-update permite
somente name/email, inclusive com cadastro bloqueado. Self-create aceita
somente name/email/status pending_approval, sem role ou campos extras.
Delete de perfil pelo cliente é negado. Nome/e-mail continuam onboarding.

Catálogo exercises: leitura para admin ou student aprovado/pausado/legado sem
status; escrita cliente negada para todos. Workouts/programs/diets são negados
para leitura e escrita direta, pois passam pela API.
Scores/scores_history/posts/plans/workoutHistory/dietLogs e subcoleções antigas
não têm regras permissivas. Nenhum dado real foi apagado por estas mudanças.

## Interface e evidência

Guards usam allowlist de papel/status, espelhando o contrato; inativo/desconhecido
vê acesso suspenso, pendente vê análise e recusado vê recusa. API revalida sempre.

F7 tem matriz HTTP do mux real, testes de rules e E2E com Auth/Firestore locais,
incluindo dois alunos ativos e um pausado. Gates finais em .gates e relatório
simplificacao-f7-acceptance-review.md. Não houve validação nem deploy remoto.

Google já saiu da UI; backend ainda aceita tokens Firebase desse provedor.
Desligamento depende de migração das contas para senha antes do rollout.
Credencial Web histórica tem plano K6; restrição/rotação não executadas.