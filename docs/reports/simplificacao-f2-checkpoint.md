# F2 — comunidade removida

30/09/2026. Removidos handlers/service/repository/models de posts, comentários,
curtidas, publicação automática no treino/dieta e páginas de comunidade,
feed, atividades e perfil social. Foto/bio saíram do perfil e da allowlist;
Avatar preservado com iniciais. Campos e SDKs de planos ficam para F3.

Regressão de remoção de rotas foi executada primeiro em Red (6 URLs sociais
ainda respondiam 403) e depois passou com 404. Rules negam posts antigos para
aluno e admin, incluindo leitura/escrita/delete; update photoURL/bio é negado.
Treino concluído e diário alimentar continuam salvando sem efeito de feed.
Nenhum dado real removido. Índice local de posts retirado sem publicação.

Gates: Go vet limpo + **185** testes; Vitest **99/99**; rules **88/88**;
E2E **28/28** (1,7 min); tsc/lint/build OK. Tipos Next gerados obsoletos foram
regenerados após remoção das páginas. Somente emuladores para rules/E2E.

Principais áreas: backend social/main/nutrition/diet/repository/models,
frontend feed/navegação/dashboards/perfis, firestore.rules/indexes e testes.
Próximo: F3 remove planos/features e datas do perfil (não datas das dietas).
Manter aprovação/ownership/admin e paused com leitura. Sem push/deploy.
Deleção de produção D6 continua separada; configurações OpenCode preservadas.
