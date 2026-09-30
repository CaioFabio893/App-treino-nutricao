# PROJECT_STATE — Treino Louise

Retomada atualizada 30/09/2026. Ler este arquivo, .gates e git status.

## Autorização e limites

Usuário autorizou Codex a assumir OpenCode e implementar/revisar sem OK entre
fases, registrando trabalho e instruções. Configurações Windows preservadas.
Sem push/deploy/console/rotação/deleção de produção nesta continuidade.
D6 default não apagar; nenhuma seleção específica de coleções foi respondida.
Configs preexistentes opencode.json e .opencode/* fora dos commits.

## Estado local concluído

- K6 5ddfb52: caso (a), Web API key pública no histórico, sem service account
  privada detectada localmente. Plano phase-16-key-rotation-plan.md; não executado.
- F4 061514b: dois papéis admin/student.
- F1 8e35ec5: gamificação/ciclos/ranking retirados; scores legados negados.
- F2 440d144: comunidade/posts/foto/bio retirados; Avatar iniciais mantido.
- F3 94e738e + d8dd649: planos/features/gates retirados; aprovação sem plano.
- F5 d10402e: aluno somente leitura; prescrição e vídeos, sem conclusão/diário.
  Gestão adaptada; onboarding nome/e-mail preservado.
- F6 31514ea: cinco coleções vivas, três índices; K2 escrito sem deploy.
- F7 concluída: autorização papel/status/posse, 404 para alheios/inexistentes,
  403 para mutações do aluno. students/{id} exige aprovação; papéis antigos
  negados; criação SDK do perfil tem allowlist estrita; legado sem status válido.
  UI bloqueia inativo/desconhecido, mantém admin e leitura paused.

Gates F7: Go186 top-level + vet limpo; Vitest116/116 (19 arquivos);
rules106/106; E2E31/31 (1,3 min); tsc/lint/build OK. Apenas emuladores.
Primeiro E2E de conta inativa tinha seletor exato incluindo subtítulo;
corrigido após captura comprovar comportamento correto. Novo E2E completo verde.
Relatórios simplificacao-f{1,2,3,5}-checkpoint.md,
simplificacao-f6-reindex-plan.md e simplificacao-f7-acceptance-review.md (K3/K4/K5).

## Invariantes e próximo trabalho

Go handlers → service → repository; Next16/React19; Firestore/Auth, Cloud Run.
Preservar America/Recife, createdAt, self-update nome/e-mail, CORS/rate limit,
aprovação/ownership, programa referenciando treinos e assign materializando
cópias. Admin SDK ignora rules; autorização da API precisa ser independente.
Coleções vivas users/workouts/programs/diets/exercises. Índices necessários
studentId ASC + createdAt DESC em workouts/programs/diets.

Correção adicional em andamento: padronizar data de validade de dieta para
America/Recife no frontend, hoje ainda usa UTC em aluno/admin. Não reabrir F1–F7.

## Pendências operacionais

1. Google fora da UI; backend aceita provedor legado. Migrar contas para senha
   mantendo UID antes de bloquear tokens/desligar console. Não executar sem
   comprovar a migração; ADR-002 deve refletir essa sequência.
2. K6 restrição/rotação pendentes; seguir plano documentado.
3. K2 rollout remoto: confirmar revisão publicada e consumidores V1/V2,
   adicionar/manter índices e esperar prontidão, migrar aplicação/regras,
   verificar queries reais, só depois encerrar janela e retirar índices antigos.
4. D6 não apagar: K1 depende da seleção por coleção, backups e plano revisado.
5. Verificar clientes PWA antigos/abas abertas no rollout. Produção não atualizada.

## Retomada operacional e rollback

Git com -c safe.directory=C:/Users/caiof/OneDrive/Desktop/treino-louise-main
se necessário, sem alterar configuração global. Reverter commit de fase local
é rollback; revisar conflitos/repetir gates. Nenhum efeito remoto a desfazer.
Go cache/Firebase CLI exigiram permissão fora do sandbox; sem instalação.
CLI existente C:/Users/caiof/AppData/Roaming/npm; Java .jdks/ms-21.0.11.
Não executar rules/E2E juntos. Ler frontend/AGENTS.md e guias Next locais.
Não adicionar opencode.json/.opencode ao commit. Usar contagens medidas.