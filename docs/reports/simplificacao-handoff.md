# Continuação operacional após a simplificação local

30/09/2026. Plano de retomada; nenhum comando contra produção executado.

## O que já está pronto

F1–F7 implementadas e revisadas. Checkpoints locais no git log. Aplicação
simplificada com dois papéis, aluno em leitura, cinco coleções e três índices.
K2 em simplificacao-f6-reindex-plan.md; K3/K4/K5 em
simplificacao-f7-acceptance-review.md; K6 em phase-16-key-rotation-plan.md.
Correções adicionais em simplificacao-post-f7-corrections.md. Estado em
PROJECT_STATE.md; contagens reais em .gates. Configs OpenCode preservadas.

## Sequência para uma execução futura

1. Confirmar projeto, database, serviços, revisão publicada e todos os
   consumidores V1/V2. Registrar configuração de rules/índices/envs sem valores
   secretos. Preparar ambiente isolado e rollback de tráfego antes de publicar.
2. Executar contenção/restrição/rotação K6 na ordem do plano. A chave antiga é
   pública Web e recuperável no histórico; redação não prova revogação.
   Não misturar rotação e limpeza de dados. Validar auth/build com chave nova.
3. Seguir K2: índices necessários aditivos e READY, validar queries reais,
   rollout da aplicação e regras, observar erros e PWA, manter índices antigos
   durante a janela de rollback. Só removê-los após cessar consumidores antigos.
4. Migração Google: inventariar contas sem senha, mantendo UID e vínculos dos
   dados. Confirmar método de vinculação/reset de senha na documentação Firebase
   vigente e testar em ambiente isolado antes de aplicar. Não criar outra conta
   com mesmo e-mail como atalho. Verificar login por senha e recuperação de cada
   conta migrada. Só então retirar aceitação google.com no backend e desligar
   o provedor; UI já não oferece Google. A política futura deve usar o provedor
   da claim do ID token verificado, não o campo de auditoria AuthProvider do
   perfil (que pode continuar google.com depois de a conta ganhar senha). Sem essa evidência, preservar backend
   compatível como está. Não enviar mensagens a usuários sem instrução explícita.
5. D6 permanece NÃO APAGAR. K1 depende de seleção por coleção; mesmo após escolha,
   export/backup e teste de restauração precedem qualquer deleção. Retirar código
   não exige apagar dados. Nenhuma coleção foi apagada nesta continuidade.
6. Validação humana: Louise/admin cria/atribui treino/dieta/programa; dois alunos
   consultam seus próprios dados e não acessam alheios; paused lê, inactive não.
   Validar vídeos, impressão, atualização PWA e dispositivos reais. Registrar
   resultado e revisão do rollout, sem afirmar produção pronta só pelos emuladores.

## Como retomar localmente sem refazer trabalho

Ler PROJECT_STATE.md e git status/log. Não reimplementar fases concluídas.
Executar somente verificações justificadas por nova mudança/falha. Não rodar
rules e E2E juntos; não editar fontes enquanto E2E usa Next dev (HMR pode
remontar formulários). Nenhuma dependência nova foi instalada; retirada de
recharts alterou somente manifesto/lockfile offline. Instalação limpa futura
normal acompanha package-lock; não é requisito para retomar documentação.

Rollback local: reverter checkpoint pertinente; preservar configurações
preexistentes. Rollback remoto depende das revisões/configs registradas na etapa
1 e dos índices antigos mantidos. A configuração final local não autoriza um
force-push, reescrita de histórico ou publicação automática.