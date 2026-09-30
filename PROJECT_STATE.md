# PROJECT_STATE — Treino Louise

Memória de retomada atualizada em 30/09/2026. Ler com .gates e git status.

## Autorização e limites

Usuário autorizou Codex a assumir também OpenCode e continuar tarefas locais,
sempre documentando trabalho e instruções. Preservar configurações do Windows.
Sem push, deploy, console, rotação ou deleção de produção nesta continuidade.
D6 não teve seleção concreta de dados: não interpretar defaults como resposta
humana. Configurações preexistentes opencode.json e .opencode/* devem ficar
fora dos commits de implementação.

## Projeto e invariantes

Go + Next 16/React 19 + Firestore/Firebase Auth; Cloud Run southamerica-east1.
Handlers → service → repository. Admin/student (F4 commit 061514b).
Preservar America/Recife, createdAt, allowlist nome/e-mail, aprovação/status,
CORS, rate limit, ownership e cópias de workouts na atribuição de programas.
Admin SDK ignora rules; a API deve validar autorização independentemente.

## Checkpoints concluídos

- K6: caso (a), chave pública Web Firebase somente no histórico; sem chave
  privada detectada nos commits localmente alcançáveis. Plano completo em
  docs/reports/phase-16-key-rotation-plan.md, commit 5ddfb52. Não executado.
- F1: 8e35ec5, gamificação/ciclos/ranking retirados; scores legados negados.
- F2: 440d144, comunidade/posts/publicação automática/foto/bio retirados;
  Avatar por iniciais preservado. Dados reais intactos.
- F3: checkpoint 94e738e, implementação concluída, planos/features/gates/atribuição retirados,
  aprovação sem plano, treinos/dietas acessíveis aos aprovados ativo/pausado.
  Datas do perfil retiradas, datas das dietas preservadas. Plans legados
  negados, rotas retiradas 404. Relatório simplificacao-f3-checkpoint.md.

Gates F3: Go 184 testes top-level + vet; Vitest 99/99 (17 arquivos),
dashboard complementar 5/5; rules 90/90; E2E 28/28 (1,6 min); tsc/lint/build OK.
Primeiro E2E 27/28 por expectativa antiga de 403 em /api/plans; ajustada a 404.
Rules/E2E somente emuladores; não rodar juntos. Nenhuma dependência instalada.
Go cache/Firebase CLI precisaram execução fora do sandbox. CLI existente:
C:/Users/caiof/AppData/Roaming/npm; Java em .jdks/ms-21.0.11.

## F5 concluída e próximo passo

F5 participante somente leitura concluída: retirados endpoints/DTOs/coleções
ativas de conclusão e diário; UI exibe prescrição e vídeos. Gestão preservada.
Go 181 + vet, Vitest 104 (18 arquivos), rules 92, E2E 28 (1,3 min),
tsc/lint/build OK. Relatório docs/reports/simplificacao-f5-checkpoint.md.
Próximo F6: cinco coleções, três índices necessários, K2/reindex; depois
F7: matriz de status/papel/posse, 404 para recurso alheio, E2E dois alunos.
Usuário confirmou continuar sem OK entre fases.

## Pendências de produção e decisões

- D6: seleções de deleção de dados ainda pendentes; K1 depende delas.
- Google removido da UI; backend ainda aceita google.com. Revisar ADR-002 e
  migração de contas antes de bloquear provedor/desligar console.
- Quatro índices nutritionistId órfãos para F6, sem deploy automático.
- GET /api/students/{id} sem RequireApproved: investigar intenção/posse na F7.
- Confirmar revisão realmente publicada antes de qualquer rollout V1/V2.
- K6 contenção/restrição/rotação depende de execução posterior da dona.

## Retomada operacional

Usar git com -c safe.directory=C:/Users/caiof/OneDrive/Desktop/treino-louise-main
se necessário, sem configurar Git globalmente. Conferir diff antes de editar.
Ler frontend/AGENTS.md antes de mudanças Next; consultar guias locais relevantes.
Não incluir opencode.json/.opencode no commit. Reverter commit de fase é rollback
local; não houve efeito remoto a desfazer. Relatórios registram testes/limites.