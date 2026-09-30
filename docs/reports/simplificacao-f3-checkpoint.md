# F3 — planos e gates de features removidos

30/09/2026. Checkpoint local, sem push ou deploy.

## Resultado

Removidos Plan/Feature, CRUD e atribuição de planos, snapshots de features,
RequireFeature e controles de planos no frontend. A aprovação exige papel
student e registra status, autor e data; não concede admin. Alunos aprovados
ativos ou pausados acessam treinos e dietas sem plano. Pendentes/recusados
continuam bloqueados e as regras de posse continuam necessárias.

Perfil não grava planID/features/startDate/endDate; foto/bio já removidos na
F2. Datas de validade das dietas foram preservadas. createdAt continua
imutável. Seed dos emuladores acompanha o contrato simplificado.

Rotas antigas de planos retornam 404. Firestore nega leitura e escrita de
plans legados para aluno e admin. As allowlists continuam recusando campos
retirados do perfil. Nenhum documento real ou índice remoto foi alterado.

## Verificação

A regressão de acesso a dieta sem plano começou em Red (403) e passou com
200. Novos testes cobrem aprovação sem plano, papel inválido sem escrita,
perfil sem campos aposentados e URLs removidas. O primeiro E2E terminou
27/28: uma expectativa antiga de 403 em /api/plans foi corrigida para 404.
A execução completa seguinte passou 28/28 em 1,6 minuto.

Gates: Go vet limpo e 184 testes top-level; Vitest 99/99 em 17 arquivos,
mais 5/5 do dashboard após ajuste das regressões; rules 90/90;
tsc --noEmit, lint 0/0 e Next standalone build OK. Rules e E2E somente em
emuladores. Não instaladas dependências nem executada rotação de chaves.

## Retomada e rollback

Próxima fase F5: retirar conclusão/histórico de treino e diário alimentar,
transformar aluno em leitura, adaptar StudentDetail e seed/testes, negar
coleções legadas nas rules. Preservar perfil inicial nome/e-mail, autenticação,
aprovação, ownership, administração, exercícios e programas com cópias.
Depois F6 modelo/índices locais e F7 matriz de autorização. D6 continua sem
seleção de dados de produção; não apagar dados nem publicar índices.

Rollback: reverter o commit local desta fase, revisar contratos e repetir
os gates. Não há alteração de produção a desfazer. Antes de qualquer deploy,
confirmar revisão atual, dados legados e plano de rollout.