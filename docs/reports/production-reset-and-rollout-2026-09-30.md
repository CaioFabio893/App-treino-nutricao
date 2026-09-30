# Publicação, rotação e reinicialização de produção — 30/09/2026

## Resultado

Execução autorizada nesta conversa pelo dono: "foce consegue fazer isso tudo? se sim pode fazer" e, depois, "pode excluir dados e contas, so me deixe como adm, caiofabio893@gmail.com, os demias eu adicono depois". Essa instrução substitui o antigo limite de só planejamento/sem deploy e o default D6 não apagar. Não autoriza apagar configuração do Windows; nenhuma foi alterada.

Produção publicada e validada automaticamente. Só permanece a conta Auth de `caiofabio893@gmail.com`, UID `WBBEE5KzI0bLZmmNPt34NBYY0el2`, e seu documento `users/{uid}` com `admin/active`. UID, hash da senha e perfil foram preservados. Dois usuários e nove documentos reais foram removidos. Contas/recursos temporários de teste também foram removidos e a contagem final foi reconfirmada: 1 conta, 1 perfil, zero documentos de negócio.

URL: https://treino-web-834622951375.southamerica-east1.run.app

| Componente | Estado final |
|---|---|
| Projeto/database/região | treino-louise / (default) / southamerica-east1 |
| Backend | treino-api-00016-gic, 100% tráfego |
| Frontend | treino-web-00013-ven, 100% tráfego |
| Código das correções finais | c05e1e8 |
| Backend digest | sha256:32d30a0434bdf6ef142460a713d8ded30eb82b944a0a130340058acf78f7fb1f |
| Frontend digest | sha256:3a8fb5de7f6fa90c8a8b3d13503b51c41dbb3bd5dcdc178c384ba315c94567ad |
| Cloud Build backend | 5ea85845-b74b-4ff9-a5f1-8326166aed54 — SUCCESS |
| Cloud Build frontend | 19155933-e163-41f6-86c0-3f3cd9648213 — SUCCESS |
| Regras | firestore.rules local compilada e publicada |
| Índices necessários | workouts/diets/programs: studentId ASC + createdAt DESC, READY |

Tags de revisão temporárias removidas ao terminar. Revisões/imagens anteriores e índices legados mantidos para recuperação; nenhum force-push, reescrita do Git ou push feito. Alterações preexistentes OpenCode preservadas fora dos commits.

## Ordem executada e pré-condições

1. Confirmados CLI autenticado, projeto, único database, duas aplicações Cloud Run e revisões anteriores: API 00013-867 e web 00010-nhv. Configurações e digests anteriores salvos privadamente. Não se presumiu que HEAD já estivesse publicado.
2. Inventariadas três contas Auth e sete coleções raiz. Confirmados e-mail/UID únicos do dono, login password, conta habilitada e perfil admin/active. Não havia migração Google a fazer para a conta preservada. Configuração Google retorna CONFIGURATION_NOT_FOUND e a lista de provedores configurados não apresentou Google. Sites Hosting sem releases publicados, ambos retornando 404; consumidores publicados identificados são Cloud Run. Não foram enviadas mensagens/e-mails a ninguém.
3. Export completo gerenciado do Firestore concluído com done=true e sem erro. Backup Auth inclui hashes/salts e configuração de hash; snapshot de regras/índices/serviços. Bucket de backup sem principal público allUsers/allAuthenticatedUsers. Backups fora do Git.
4. Criada chave Web substituta no mesmo projeto, restrita a Identity Toolkit/Token Service e aos domínios do app. Confirmados leitura de config 200 na origem permitida e 403 na origem proibida. Build frontend recebeu a chave em build-time, não apenas no runtime.
5. Criado índice programs e aguardado READY. Builds iniciais/candidatas, health 200, acesso anônimo 401, páginas/manifest/SW 200; depois tráfego e regras publicados. Índices antigos não removidos.
6. Desabilitadas duas contas não preservadas e revogadas sessões. Inventário recursivo de documentos/subcoleções, snapshot completo local, ensaio de restauração de um documento em fixture isolada e comparação estrutural dos campos: PASS; fixture apagada. Só então excluídos nove documentos e duas contas, com exceção explícita do UID do dono. Não foi feita restauração integral do export gerenciado em outro database.
7. Testes de produção descobriram corrida no redirecionamento: role default student podia encaminhar administrador ao dashboard antes do perfil chegar. Corrigido Home para aguardar profileLoaded; troca de sessão limpa perfil e reinicia seu carregamento. Testes de regressão e nova validação de produção passaram.
8. Adicionado FirebaseVerifier que usa VerifyIDTokenAndCheckRevoked e exige claim verificada sign_in_provider=password. Conta excluída/desabilitada/sessão revogada não pode usar token antigo para recriar perfil via API. Campo authProvider salvo no perfil não decide essa política. Go/vet, frontend e E2E passaram; builds finais e novas candidatas, health e token de fixture já excluída 401 antes da troca final de tráfego.
9. Repetida validação completa na versão final, com três contas e seis recursos temporários. 61 checks HTTP e oito de navegador passaram; cleanup zero erros. Nenhuma fixture ficou em produção.
10. Revogada a chave anterior somente após validar a substituta e os consumidores. Google Cloud inicialmente recusou por detectar uso nos últimos sete dias. Com consumidores migrados/testes verdes e corte autorizado, foi usada a opção documentada --no-check-existing-usage. Não foi um bloqueio de aprovação do Codex. Às 17:25:14 UTC: antiga HTTP 400, mensagem "API key expired. Please renew the API key."; nova HTTP 200 no mesmo endpoint de leitura/referer permitido. Não houve reescrita de histórico.
11. Após a revogação, quatro controles adicionais passaram: signup, login por senha, API me e refresh HTTP 200; conta temporária removida. Export Auth final comparado ao inicial comprovou UID/hash/salt do dono iguais; updateTime do perfil também igual. O endpoint lookup não inclui hash, por isso a comparação de senha utilizou batchGet nos dois lados. Tags temporárias removidas, tráfego final mantido em 100%.

## K6: credencial e evidência

O diagnóstico continua caso (a), chave pública Web; nenhuma chave privada de service account detectada na auditoria histórica. Chave anterior ID `b6382f1c-2dec-4298-b15c-a033af5e9cc0` excluída. Substituta ID `e4501343-f06e-432e-9056-ff27a4087944`, duas APIs e referrers restritos. Valores não devem ser copiados para documentação/Git. A chave Web nova será visível no bundle por desenho.

Testados cadastro/login com fixtures, renovação securetoken e leitura de recursos autenticados. Não foram revogadas sessões do dono nem alterada sua senha. Não é possível concluir ausência histórica de abuso: a consulta Cloud Run de 5xx nas últimas 24 horas retornou zero eventos, mas não substitui análise de faturamento/quota/atividade passada. Inventário inicial tinha três contas; não foram classificadas como fraudulentas.

frontend/.env.local não tinha chave real AIza e não foi modificado. Testes seguem usando emuladores/chave fictícia. Caso desenvolvimento passe a usar Firebase real, provisionar chave de desenvolvimento restrita a localhost; a chave de produção não permite localhost.

## K1 / D6: dados excluídos

Inventário inicial de documentos: diets 1, plans 2, posts 1, scores 1, users 3, workoutHistory 1, workouts 1. Total 10, um preservado. Walk recursivo também verificou subcoleções/documentos ausentes com filhos; não foram encontrados dados adicionais.

Final: users 1; diets/plans/posts/scores/scores_history/workoutHistory/dietLogs/workouts/programs/exercises 0. Firebase Auth 1, dono habilitado/password. O reset removeu dados atuais além das coleções aposentadas, conforme autorização de apagar dados e recomeçar só com o administrador. Não removidos projeto, database, serviços, regras, índices, bucket, imagens ou configurações Windows.

## Verificações

- Go: 188 testes top-level PASS e go vet PASS.
- Vitest: 124/124, 21 arquivos; tsc e lint PASS.
- E2E: 31/31, 1,8 min, Auth/Firestore emuladores com o novo verificador ligado no main.
- Firestore rules: 106 testes já verdes, sem alteração de rules desde esse gate; compilação/publicação remota PASS.
- Builds finais Cloud Build: SUCCESS, Next standalone e Go container.
- Produção API: 61 checks PASS. Cadastro fixture, admin me/usuários, CRUD de criação treino/dieta/programa; leituras próprias 200, alheias/ausentes 404 iguais, listas por UID usando índices reais, escrita aluno 403, paused 200 e pending/rejected/inactive 403, rotas aposentadas 404, refresh 200, tokens de desabilitado/excluído 401.
- Produção browser: oito checks PASS, login aluno e admin no destino correto, treino/dieta sem controles de registro, gestão alunos, manifest e SW. Viewport mobile 390x844 simulada e capturas inspecionadas; não equivale a teste de dispositivo físico.
- Tentativas preliminares de navegador descartadas: interação antes de estabilizar cliente resetava formulário; harness passou a aguardar rede estável. A tentativa seguinte confirmou a corrida real de role default, corrigida no código. Somente a rodada final completa é gate verde.
- Limpeza de cada rodada: três contas temporárias/seis recursos removidos, zero erros. Contagens finais e identidade/senha do dono reconfirmadas.

## Backup, recuperação e rollback por etapa

Backups privados locais em `C:/Users/caiof/AppData/Local/TreinoLouiseOps/2026-09-30/`. Contêm dados pessoais/hashes/config; não adicionar ao Git nem à pasta OneDrive. Scripts de operação também estão ali. **Não executar reset.ps1 novamente por conveniência:** é um script destrutivo, preserva só o UID do dono e pode sobrescrever snapshots locais. O export gerenciado original permanece independente.

Export remoto: `gs://run-sources-treino-louise-southamerica-east1/ops-backups/2026-09-30-before-reset`, com overall_export_metadata confirmado. auth-backup.json, auth-config.json, full-document-backup.json, owner-profile.json, regras/índices e serviços anteriores são evidências locais. Guardar backups até decisão de retenção; nenhum backup apagado automaticamente.

| Etapa | Recuperação |
|---|---|
| Restrição da nova chave | Ajustar apenas domínio/API comprovadamente necessário; não tornar irrestrita |
| Nova publicação | Preferir correção para frente ou reconstruir versão anterior com chave nova e repetir smoke. Imagens antigas com a chave revogada não são rollback funcional de Auth |
| Regras | rules-before.json contém source anterior; comparar com consumidores antes de publicar. Não liberar escrita de negócio para resolver login |
| Índices | Os antigos foram mantidos, logo não há índice apagado a recriar. Novo programs pode permanecer durante rollback |
| Remoção de documentos | Restaurar primeiro em database isolado quando for necessária recuperação ampla; export gerenciado pode ser importado via gcloud firestore import. Import não é rollback de Auth e pode sobrescrever dados posteriores; não executar sem plano de reconciliação |
| Remoção de contas | Reimportar UIDs/hashes/salts/provedores do auth-backup com configuração de hash em auth-config. Comparar conflitos de UID/e-mail antes. Usuários excluídos devem relogar; tokens/sessões antigas não são restaurados |
| Google/password e revogação | Única conta preservada já tinha password. Manter checagem de revogação. Reabrir Google exigiria mudança explícita da decisão e validação, não é necessário neste reset |
| Chave anterior excluída | Preferir reparar build/config com substituta. Não restaurar chave antiga como resposta automática; reabre exposição. Revisões antigas têm de receber a chave nova |

Snapshots/ensaio de documento tornam recuperação possível, mas não se afirma que foi testado um restore integral de Auth+Firestore. Não recriar automaticamente os usuários que o dono mandou excluir.

## Próximo uso

1. Dono abre a URL e faz login com a senha existente. Fechar abas antigas/reabrir a PWA para carregar o bundle novo; a chave antiga foi revogada.
2. Cadastrar/aprovar os novos alunos e criar conteúdo pelo painel. Banco de negócio começa vazio por decisão do dono.
3. Validação do dono/Louise e PWA em Android/iPhone físicos, impressão e conteúdo/vídeos reais continuam verificações humanas. Não foram simuladas como concluídas.
4. Não falta outro deploy conhecido. Monitoramento não foi agendado; registrar eventual falha com revisão/horário, sem tokens/senhas.

Fontes operacionais: [Firebase sessões e revogação](https://firebase.google.com/docs/auth/admin/manage-sessions), [Firebase gestão de usuários](https://firebase.google.com/docs/auth/admin/manage-users), [Firestore export/import](https://firebase.google.com/docs/firestore/manage-data/export-import), [Google Cloud exclusão de chave e check de uso](https://docs.cloud.google.com/sdk/gcloud/reference/services/api-keys/delete).
