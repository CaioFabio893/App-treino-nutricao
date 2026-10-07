# PROJECT_STATE — Treino Louise

Atualizado 07/10/2026 após publicação do visualizador de dieta em documento.
Preferência do dono desde 07/10: um agente por vez, tarefas sequenciais e
registro de mudanças/testes/próximos passos para handoff ao OpenCode.
Não delegar em paralelo sem um novo pedido explícito.
Fonte operacional: docs/reports/production-reset-and-rollout-2026-09-30.md.

## Produção atual

Projeto treino-louise, Firestore (default), região southamerica-east1.
API treino-api-00025-hof e web treino-web-00031-jey, ambas com 100% tráfego.
Documento Plano Alimentar Mulheres (biblioteca, 7 páginas) importado.
Bucket privado treino-louise-private-diets, PAP enforced; original PDF não publicado.
API DIET_DOCUMENT_BUCKET, memória512Mi e concorrência8; páginas sem marcas e leitor com rolagem contínua.
Relatório/instruções: docs/reports/plano-alimentar-mulheres-pdf-2026-10-07.md.
https://treino-web-834622951375.southamerica-east1.run.app
Admin preservado: caiofabio893@gmail.com (UID WBBEE5KzI0bLZmmNPt34NBYY0el2), admin/active.
UID/senha/perfil preservados. Duas contas e nove documentos reais removidos;
Reset anterior concluído. Exemplo A–E: 2 programas e 10 treinos, biblioteca e
programa completo do aluno separados, preservando os 5 treinos já atribuídos.
Inventário atual: 2 contas/perfis reais; zero fixtures. Não repetir reset.
Regras publicadas; três índices necessários READY, antigos mantidos.
Chave Web antiga excluída: teste mesma origem antiga400/expired, nova200.
Substituta restrita a identitytoolkit/securetoken e domínios confirmados.
Google não configurado; conta preservada já possuía password, sem migração.
API aceita somente claim verificada password e verifica revogação/exclusão.

## Autorização atual

Nova área Receitas, associada por aluno, com cadastro/edição/duplicação pelo admin.
Dieta e Receitas: texto com negrito/títulos/listas e prévia, leitura formatada.
Receitas usam diets.kind=recipe; dietas antigas sem kind continuam compatíveis.
Navegação atual: Início/Treino/Dieta/Receitas. Layout suavizado, verde preservado.
Relatório: docs/reports/receitas-formatacao-layout-2026-10-01.md.

Unificação anterior: Início, Treino e Dieta. Treino usa
os programas completos em /treinos e /treinos/{id}; /programas redireciona.
Tela avulsa antiga removida. Painel de execução usa a paleta verde do app.
Dados e chaves de progresso preservados. Ver treino-unificado-paleta-2026-09-30.md.

Pedido posterior: reproduzir as funções do app de exemplo, incluindo execução.
Painel com séries/carga/reps/resultados, cronômetro, PRs, oito semanas e histórico
implementado. Registros pessoais locais por UID/programa; sem sincronização cloud.
Consultar docs/reports/app-execucao-exemplo-2026-09-30.md para uso e rollback.

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
## Programa completo — pedido posterior ao reset

94a132b: interface deixa claro cadastro/associação do programa inteiro.
Exemplo do dono cadastrado na biblioteca, ID louise-ciclo-2, A–E/30 exercícios/
103 séries, cardio e periodização preservados; nenhum aluno específico escolhido.
Programas → Associar programa inteiro → escolher aluno. Duplicar antes se quiser
manter também um modelo. Relatório programa-completo-exemplo-2026-09-30.md.
Template integral frontend/lib/program-example.ts. Vitest124/tsc/lint/E2E31 PASS;
E2E1,6 min agora usa exemplo completo. Produção: associação integral de fixture
validada (5/30/103) e seis checks UI; fixtures completamente removidas.
Web00016-juj 100%, backend intacto. Cloud Build8c3fd8d0 SUCCESS.

## Treino Feminino — implementação local concluída (não publicada)

Pedido 07/10: programa único Academia/Em casa. Preparados 58 exercícios/8 treinos
(4 gym A–D, 4 home 1–4) com `modality`/`circuitSeconds`; exercícios com
`phase`/`durationSeconds`/`timerExcluded` e vídeos (`videoUrl` + `videoUrls`).
48 vídeos únicos conferidos via YouTube oEmbed (48/48 existem; títulos batem;
`Bike Ergométrica` aponta para ajuste da bike — revisar). Sem alongamentos: a
fonte não prescreve (não inventados). AMRAP com contador de voltas/observações e
reset só dos exercícios principais. Editor admin cobre modalidade/fase/duração/
vídeos. Testes: Go 196 PASS + vet limpo; Vitest 131/23 arquivos; tsc/lint/build OK.
Commits locais, sem push/deploy; não consta na biblioteca cloud nem foi importado.
Dados: docs/data/treino-feminino-fonte.md, -preparado.json e -videos.json.
Retomada/prompt: docs/reports/treino-feminino-handoff.md.
