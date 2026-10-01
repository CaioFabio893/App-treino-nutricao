> Atualização 01/10: web treino-web-00026-net, API treino-api-00019-yac.
> Início/Treino/Dieta/Receitas; editor com negrito/títulos/listas e prévia,
> receitas por aluno, layout mais suave. Dados/progresso existentes preservados.
> Uso/rollback: receitas-formatacao-layout-2026-10-01.md.
> Atualização anterior: web treino-web-00022-huh, área do aluno unificada
> em Início/Treino/Dieta, sem tela antiga de treinos. Paleta verde compartilhada.
> /programas redireciona para /treinos; progresso e dados preservados.
> Instruções em treino-unificado-paleta-2026-09-30.md.
> Atualização anterior: web treino-web-00019-xak com execução de séries, cargas,
> repetições, sucesso/falha, cronômetro, PRs, semanas e histórico local por conta.
> Programa do aluno e biblioteca reparados: 2 programas, 10 treinos; existentes
> preservados. Ver app-execucao-exemplo-2026-09-30.md para instruções e rollback.
> As indicações de web e inventário abaixo são históricas.
> Atualização posterior: programa completo do exemplo cadastrado na biblioteca,
> A–E/30 exercícios/103 séries. Programas → Associar programa inteiro → aluno.
> Web atual treino-web-00016-juj. Há 2 contas/perfis reais, zero fixtures.
> Relatório programa-completo-exemplo-2026-09-30.md. Reset abaixo é histórico;
> não apagar novamente os dados acrescentados depois dele.
# Entrega e próximos passos — 30/09/2026

Publicação, rotação e reset de produção concluídos após autorização do dono.
Relatório completo: production-reset-and-rollout-2026-09-30.md nesta pasta.
Estado/revisões/testes em PROJECT_STATE.md e .gates.

App: https://treino-web-834622951375.southamerica-east1.run.app
Entrar com caiofabio893@gmail.com e a senha existente. A conta continua admin;
UID, senha e perfil preservados. Duas outras contas e nove documentos removidos.
Treinos/dietas/programas/exercícios começam vazios. Cadastre conteúdo e novos
alunos pelo painel. Nenhuma conta de teste ficou no projeto.

Feche abas antigas/reabra a PWA para carregar a versão nova: a chave Firebase
antiga foi revogada. Não há outra publicação conhecida pendente.

Falta somente validação do dono/Louise e PWA em dispositivos físicos reais.
Login, renovação, admin/aluno, isolamento e viewport mobile foram testados
automaticamente em produção; isso não substitui o aceite humano.

Backup remoto completo anterior ao reset:
gs://run-sources-treino-louise-southamerica-east1/ops-backups/2026-09-30-before-reset
Snapshots e scripts privados em:
C:/Users/caiof/AppData/Local/TreinoLouiseOps/2026-09-30/
Não publicar backups, não executar reset.ps1 novamente. Recuperação de dados/
Auth depende de import com reconciliação; ler o relatório antes. Não voltar
tráfego a imagem com chave antiga: é preciso reconstruir com a nova chave.

Código e relatórios commitados localmente, sem push/force-push/reescrita.
Configs OpenCode e configuração Windows preservadas. Índices legados e imagens
anteriores mantidos para recuperação; backups não foram apagados.
