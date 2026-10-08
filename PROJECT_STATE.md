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

## Treino Feminino — IMPLANTADO EM PRODUÇÃO (07/10/2026)

Pedido 07/10: programa único Academia/Em casa. Preparados 58 exercícios/8 treinos
(4 gym A–D, 4 home 1–4) com `modality`/`circuitSeconds`; exercícios com
`phase`/`durationSeconds`/`timerExcluded` e vídeos (`videoUrl` + `videoUrls`).
48 vídeos únicos conferidos via YouTube oEmbed (48/48 existem; títulos batem;
`Bike Ergométrica` aponta para ajuste da bike — revisar). Sem alongamentos: a
fonte não prescreve (não inventados). AMRAP com contador de voltas/observações e
reset só dos exercícios principais. Editor admin cobre modalidade/fase/duração/
vídeos. Testes: Go 196 PASS + vet limpo; Vitest 131/23 arquivos; tsc/lint/build OK.
Deploy 07/10: API `treino-api-00020-x2k` (digest `09ede5aa…`, 100% tráfego) e web
`treino-web-00021-nzt` (digest `d614a4a3…`, 100% tráfego); import Firestore
create-only (`exists:false`) de 8 workouts + program `treino-feminino` (studentId
vazio = biblioteca). Smoke: web 200, `/health` 200, CORS 204, chunk servido
contém modalidade/AMRAP. Push para `origin/main` (`ab1799e`). Falta apenas a
associação ao aluno pela UI e os vídeos/alongamentos revisados manualmente.
Dados: docs/data/treino-feminino-fonte.md, -preparado.json e -videos.json.
Retomada/prompt: docs/reports/treino-feminino-handoff.md.

## Ajustes aluno/nutrição/check-in — PUBLICADO (08/10/2026)

Trabalho iniciado pelo Codex (UI + import) e fechado pelo OpenCode (testes,
gates, publicação). Receitas passam a ser globais (`kind=recipe`, leitura para
todo perfil aprovado via `canReadDiet`; escrita continua admin-only); associação
de programa em lote preserva a fonte e cria cópia por aluno; faixa de Check-in
Diário no layout do aluno; vídeos embutidos (`ExerciseVideo`, youtube-nocookie);
service worker `treino-v4`. Import já feito pelo Codex: 10 registros (3 dietas +
7 receitas) e 28 páginas PNG no bucket privado.

Gates: Go 201 PASS + vet limpo · Vitest 145/26 · tsc/lint/build OK · E2E 32 PASS.
Publicado: API `treino-api-00021-bqv` (digest `d04dd5bf…`) e web
`treino-web-00022-fw8` (digest `dda9a789…`), 100% tráfego; smoke web 200,
`/health` 200, CORS 204, bundle com apiKey válida e features novas. Relatório:
docs/reports/ajustes-aluno-nutricao-checkin-2026-10-07.md.

## Revisão visual dos treinos — VALIDADA, aguardando publicação (07/10/2026)

Trabalho iniciado por Claude/Codex (direção visual) e validado pelo OpenCode.
Alterações exclusivamente frontend: `WorkoutPlayer` + módulo CSS reescritos
(superfícies distintas, prescrição separada, séries com resultado em
texto/cor, observações recolhíveis, cronômetros em grade, histórico em
chips), `ProgramDetail`/`StudentProgramsPage` com apresentação própria do
aluno (`TrainingPresentation.module.css` + novo `WorkoutPrescription`),
`StudentLayout`/`student.css` com Check-in Diário em âmbar e chamada
"Responder agora", `ExerciseVideo` com rótulo "Assistir execução".
Lógica, persistência, `storageKey`, props, estado, handlers e APIs sem
mudança; ramo administrativo preservado; service worker mantido em `treino-v4`
(fora do escopo visual).

Validação OpenCode (sem publicar): tsc OK · lint 0/0 · Vitest 145/145 (26
arquivos) · `next build` OK · E2E 32/32 (2.6 min). Testes de cópia/aria
ajustados ao novo contrato (WorkoutPlayer.test, ExerciseVideo, specs de
aluno/isolamento/programas). `aria-label` do vídeo passou a refletir o estado
aberto/fechado. Backend intacto. Relatório:
docs/reports/revisao-visual-treinos-claude-2026-10-07.md.

Próximo passo: publicar (deploy api/web) e conferir smoke + 360/390/430px.

## Revisão visual publicada — 08/10/2026
Codex finalizou a pedido do dono: build Linux corrigido com webpack no Dockerfile; Cloud Build 0c4a8d6f SUCCESS, treino-web-00023-mvw com 100% do tráfego. /treinos HTTP200, CSS/check-in novos confirmados nos assets. Backend preservado. Gates do OpenCode aproveitados; nenhuma suíte repetida. Detalhes no relatório da revisão visual.

## Associação em lote e remoção do seletor — PUBLICADO 08/10/2026
Treinos e planos alimentares compartilham seletor com busca, selecionar todos, lista em blocos de100, contador/progresso e retry parcial. Cópias individuais/modelo preservado; AdminAreaSwitch removido do Providers. tsc/lint/build PASS, Vitest147/27 PASS, E2E33/33 PASS (2.4min). CloudBuild fce3bdbb SUCCESS, web00024-ll9 100% tráfego. Backend sem mudança. Relatório docs/reports/associacao-em-lote-2026-10-08.md.

## Treino compacto baseado no exemplo — PUBLICADO 08/10/2026
Estrutura do Desktop/exemplo adaptada: abas finas, nomes14px, cards compactos e séries5colunas, vídeos embutidos e paleta do projeto mantidos. Vitest147/27, E2E33/33 (360/390/430 sem overflow, registros preservados), tsc/lint player/build PASS. CloudBuild a995f7f3 SUCCESS; web00025-xc4 100%. Relatório docs/reports/treino-compacto-exemplo-2026-10-08.md.
