# F5 — participante somente leitura

30/09/2026. Implementação local, sem produção.

Retirados endpoints de conclusão/histórico de treino e diário alimentar,
DTOs/repositório/serviço de adesão e seed correspondente. POST workouts/complete
mantém somente resposta 404 explícita: sem ela, o mux devolveria 405 pela
rota GET workouts/{id}. Não existe handler de conclusão nem persistência.

StudentWorkoutsPage foi reconstruída para consultar os treinos atribuídos,
selecionar localmente e visualizar exercícios, séries, repetições, carga,
descanso, notas e vídeos HTTPS. Dia padrão usa America/Recife. Removidos
TodayWorkout, RestTimer, DietCheck e useNewCompletions. Dietas mantêm texto,
refeições antigas e cópia do conteúdo; nenhuma marcação alimentar.

Painel e detalhe administrativo perderam estatísticas de adesão/históricos,
sem perder CRUD/atribuição de treinos e dietas, edição de nome/status, programas,
exercícios e impressão. Setup inicial de perfil nome/e-mail foi preservado.

Rules negam coleções históricas por ausência de regra permissiva, incluindo
aluno e admin. Quatro índices locais de workoutHistory/dietLogs removidos;
nenhum índice remoto nem documento foi apagado. Índices nutritionistId ficam
para F6. Não executar limpeza de dados sem seleção D6.

## Verificação

Regressão da rota POST antiga inicialmente retornava 400, comprovando handler
vivo; o fixture antigo para listagem também revelou método de fake ausente.
Após retirada, as quatro rotas retornam 404 sem acessar repositório.
Novos testes frontend verificam prescrição legível, troca sem nova requisição,
filtro de aluno, vídeo, vazio e retry. E2E antigo de conclusão convertido em
leitura e ausência de inputs/botões de registro. Rules acrescentam negações
read/list/create/update/delete das duas coleções legadas para aluno/admin.

Go 181 testes top-level + vet limpo; Vitest 104/104 (18 arquivos); rules 92/92;
tsc/lint/build OK. E2E completo 28/28 em 1,3 minuto, somente emuladores locais.

## Retomada e rollback

Próximo F6: consolidar modelo de cinco coleções, retirar três índices órfãos
restantes nutritionistId e escrever K2 com inventário de queries e rollout.
Depois F7: status/role/ownership positivos e negativos, 404 para alheio,
rotas administrativas 403 para aluno, E2E de dois alunos e paused.
Rollback local: reverter commit desta fase e repetir gates. Produção intacta.