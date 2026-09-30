# PROJECT_STATE — Treino Louise

Atualizado 30/09/2026 após publicação, rotação e reset autorizados pelo dono.
Fonte operacional: docs/reports/production-reset-and-rollout-2026-09-30.md.

## Produção atual

Projeto treino-louise, Firestore (default), região southamerica-east1.
API treino-api-00016-gic e web treino-web-00013-ven, ambas com 100% tráfego.
https://treino-web-834622951375.southamerica-east1.run.app
Somente caiofabio893@gmail.com (UID WBBEE5KzI0bLZmmNPt34NBYY0el2), admin/active.
UID/senha/perfil preservados. Duas contas e nove documentos reais removidos;
zero documentos de negócio. Fixtures temporárias totalmente removidas.
Regras publicadas; três índices necessários READY, antigos mantidos.
Chave Web antiga excluída: teste mesma origem antiga400/expired, nova200.
Substituta restrita a identitytoolkit/securetoken e domínios confirmados.
Google não configurado; conta preservada já possuía password, sem migração.
API aceita somente claim verificada password e verifica revogação/exclusão.

## Autorização atual

Dono autorizou executar todas as pendências e depois excluir dados/contas,
preservando só seu administrador. Isso substitui o antigo plano-only K6,
default D6 NÃO APAGAR e governança sem deploy. Não reexecutar reset!
Nenhuma configuração Windows alterada. Nenhum push, reescrita ou force-push.
Configs preexistentes opencode.json e .opencode/* continuam fora dos commits.

## Trabalho concluído

F4 061514b; K6 plano 5ddfb52; F1 8e35ec5; F2 440d144;
F3 94e738e+d8dd649; F5 d10402e; F6 31514ea; F7 e50eae1;
calendário Recife/dependência b8bca6b; correções auth/redirect c05e1e8.
Não reabrir a simplificação. Coleções vivas users/workouts/programs/diets/exercises;
aluno em leitura, admin gerencia; aprovação/status/posse e createdAt preservados.

Gates atuais: Go188 + vet; Vitest124/124 (21 arquivos); rules106 já verdes,
sem mudança posterior; E2E31/31 (1,8 min); tsc/lint e builds Cloud Build PASS.
Produção: 61 checks API + oito browser PASS, nova chave e isolamento reais.
Testes descobriram corrida de admin para dashboard; Home espera profileLoaded.
Troca de sessão limpa perfil; FirebaseVerifier verifica conta/token revogado.

## Backup e recuperação

Export completo concluído antes de apagar:
gs://run-sources-treino-louise-southamerica-east1/ops-backups/2026-09-30-before-reset
Snapshots Auth/hash-config/documentos/regras/índices/revisões e scripts privados:
C:/Users/caiof/AppData/Local/TreinoLouiseOps/2026-09-30/
Não adicionar backups ao Git/OneDrive nem executar scripts destrutivos novamente.
Restore roundtrip de documento PASS; restore integral não executado.
Rollback depois da rotação requer imagem com chave nova; revisões antigas com
chave revogada não recuperam login. Detalhes e fontes no relatório operacional.
Tags temporárias removidas. Índices antigos e imagens mantidos para recuperação.

## Próximos passos

Dono entra com senha existente, reabre abas/PWA e cadastra novos alunos/conteúdo.
Validação Louise/dono e Android/iPhone físicos ainda humanas; viewport mobile
simulada foi validada. Nenhum e-mail de recuperação enviado automaticamente.
Não há outro deploy conhecido pendente. Monitoramento não foi agendado.

## Retomada técnica

Git -c safe.directory=C:/Users/caiof/OneDrive/Desktop/treino-louise-main.
Preservar configs OpenCode. Ler frontend/AGENTS.md/guias Next antes de editar.
Não rodar rules/E2E juntos; não editar fontes enquanto E2E roda.
Verificar .gates, git status e relatório antes de qualquer nova operação.
