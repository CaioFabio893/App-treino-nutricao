# F6 / K2 — modelo final e plano de reindexação

30/09/2026. Código e configuração locais auditados; plano operacional não
executado. F5 d10402e; nenhum dado/índice/regra remoto alterado.

## Modelo vivo

Cinco coleções raiz: users, workouts, programs, diets, exercises. Não há rota
sessions/prs/state nem consulta às subcoleções do modo original. Não há modo
demo no frontend. Dados antigos podem permanecer inertes no Firestore.

users: id/nome/e-mail, admin|student, status, createdAt, auditoria de provedor,
aprovação/rejeição. Nome/e-mail são os únicos campos de self-update.
Datas startDate/endDate pertencem às dietas, não ao perfil. Workouts contêm
prescrição e snapshots de exercícios; programs referenciam workouts e assign
materializa cópias por aluno. Diets aceitam texto e refeições antigas.
Exercises é catálogo compartilhado. Autenticação/posse são verificadas pela
API Go; Admin SDK ignora regras. SDK cliente não lê dados de treino/programa/
dieta; exercícios aprovados e perfil seguem regras explícitas.

## Inventário que justifica os índices

| Índice composto mantido | Query real em backend/repository/repository.go |
|---|---|
| workouts: studentId ASC, createdAt DESC | ListWorkoutsForStudent, igualdade studentId e OrderBy createdAt DESC |
| programs: studentId ASC, createdAt DESC | ListProgramsForStudent, igualdade studentId e OrderBy createdAt DESC |
| diets: studentId ASC, createdAt DESC | ListDietsForStudent, igualdade studentId e OrderBy createdAt DESC |

Listagens admin ordenam somente createdAt, exercises somente name; users
filtra somente role ou status. Leitura por ID não exige composto. Manter
indexação automática de campo único; fieldOverrides permanece vazio.

F5 retirou dietLogs(studentId,date DESC) e três workoutHistory
(studentId/completedAt DESC, nutritionistId/completedAt DESC e
studentId/completedAt ASC). F6 retirou os três órfãos restantes
nutritionistId/createdAt DESC em workouts/programs/diets. Quatro índices
nutritionistId existiam no inventário inicial, um já retirado na F5.
Resultado local: três compostos, cinco coleções com consumidores vivos.

## Ordem operacional futura

1. Antes de qualquer operação, registrar projeto/database/região, revisão
   realmente publicada, tráfego, configuração de índices e regras vigentes,
   consultas de outros consumidores e revisões disponíveis para rollback.
   Pré-condição: identificar todos os clientes V1/V2, jobs e integrações.
   Verificação: inventário revisado. Rollback: nenhum efeito remoto nesta etapa.
2. Criar/manter os três índices necessários SEM remover os antigos, com
   configuração transitória aditiva. Se faltarem, esperar construção READY.
   Não usar o arquivo final de três índices para esta etapa aditiva caso a
   ferramenta proponha deletar outros. Verificar as três consultas em ambiente
   real isolado com contas próprias. Rollback: manter índices adicionais;
   não retirar os usados pela revisão anterior.
3. Publicar API/frontend novos somente após F7 e revisão do rollout, mantendo
   índices antigos. Verificar login, aluno ativo/pausado, bloqueios, admin,
   listagens, programas/assign e dietas. Observar logs de missing index/5xx.
   Rollback: apontar tráfego à revisão anterior enquanto índices antigos existem.
4. Publicar regras novas após confirmar que todos os clientes deixaram as
   coleções aposentadas. Não apertar rules antes de migrar consumidor direto.
   Verificar cliente direto e aplicação; lembrar Admin SDK ignora rules.
   Rollback: restaurar rules previamente registradas, com revisão de segurança.
5. DECISÃO DA DONA: definir janela de rollback e encerramento dos consumidores
   antigos. Só então remover índices órfãos individualmente após conferir
   queries/logs do projeto. Nenhuma deleção de documentos é parte desta etapa.
   Verificar consultas e erros após cada remoção. Rollback: recriar índice e
   esperar READY antes de retornar a código que dependa dele; recriação não
   é instantânea. Se surgir uso desconhecido, interromper as remoções.
6. Arquivar configuração/revisões/verificações. Limpeza de campos legados é
   opcional e fica fora deste trabalho; deleção de dados exige seleção D6.

## Evidência e limites

JSON local válido; seis índices F5 reduzidos aos três comprovados por queries.
Gates F5 permanecem referência (Go181/Vitest104/rules92/E2E28), pois F6 não
alterou comportamento executável. F7 executará nova validação completa.
Não foi comprovada a configuração de produção nem prontidão remota.

O emulador não comprova a necessidade/prontidão de índices compostos: exige
checagem das queries em Firestore real no rollout. [Limitações do emulador](https://firebase.google.com/docs/emulator-suite/connect_firestore).
Criação e backfill levam tempo; excluir índice usado pode interromper queries.
[Gestão oficial de índices](https://firebase.google.com/docs/firestore/query-data/indexing).

Rollback local F6: reverter seu commit para recuperar configuração anterior.
Esse rollback não recria índices remotos, pois nada foi aplicado remotamente.