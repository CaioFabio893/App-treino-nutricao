# F7 / K3 / K4 / K5 — aceitação e revisão final local

30/09/2026. Codex assumiu implementação e revisão, autorizado a continuar sem
OK entre fases. Sem push, deploy, alteração de Windows ou dados de produção.

## Correções comprovadas em Red e Green

- GET students/{id} não exigia aprovação: pending/rejected/inactive/status
  desconhecido conseguiam ler o próprio recurso. Agora RequireApproved protege.
- RequireApproved não exigia papel student; papéis antigos/desconhecidos
  listavam recursos. Agora somente admin ou student aprovado passam.
- Recursos alheios e inexistentes retornam 404, com a mesma mensagem (D7 padrão).
  Listas do aluno consultam somente studentId do UID autenticado.
- Escrita CRUD/import/assign/duplicate, gestão de usuários e exercícios é
  negada a student active/paused com 403 antes de chegar ao repositório.
  GET/PUT me preservam onboarding e nome/e-mail; sem token válido é 401.
- Rules liberavam catálogo para papéis aposentados active/paused: quatro testes
  Red comprovaram. Gate de papel corrigido, incluindo negativos e positivos.
- Self-create pendente aceitava sete campos extras/retirados. Sete testes Red
  comprovaram; criação agora admite somente name/email/status pending_approval.
- Aluno legado sem status era bloqueado pelo SDK. Teste Red comprovou;
  get(status, vazio) acompanha o contrato Go. Pausado continua lendo.
- Guard da UI bloqueava apenas pending/rejected. Quatro testes Red mostraram
  inactive/status desconhecido/papel antigo/vazio liberando a área do aluno.
  Agora usa allowlist; conta inativa mostra acesso suspenso, inclusive deep-link.
  Admin mantém bypass de status para administrar a plataforma.

## Evidência de aceitação e K4

backend/acceptance_test.go usa mux real, dois alunos com dados distintos,
status ativo/pausado/legado/bloqueado, papel aposentado, anonimato, listagens,
recursos próprios/alheios/inexistentes e rotas de mutação. Métodos de escrita
sem implementação no fake causariam panic se fossem alcançados: o gate nega
antes da persistência. Testes existentes preservam os fluxos administrativos,
createdAt, aprovação e programas com materialização de cópias.

Rules cobrem perfil, catálogo e negação read/list/create/update/delete das
coleções aposentadas. Workouts/programs/diets próprios também são negados
pelo SDK; a prova positiva está na API e E2E, pois Admin SDK ignora rules.

E2E isolamento.spec.ts usa Auth, Go e Firestore locais reais: dois ativos e um
pausado, três conjuntos de treino/dieta/programa criados por admin, isolamento
das listas, próprios 200, alheios/inexistentes 404 e mutações 403. UI pausado
lê treino/dieta sem controles de registro; conta inativa fica suspensa.
Cada caso UI cria seus dados; não depende do caso anterior nem altera os
usuários compartilhados dos outros testes.

Go 186 top-level + vet; Vitest 116/116 em 19 arquivos; rules 106/106;
tsc/lint/build OK. E2E inicial F7 passou 30/30 em 1,4 min. Após acrescentar
conta inativa, a captura mostrou suspensão correta mas o seletor exato
incluía um subtítulo; seletor corrigido. Execução final 31/31 em 1,3 min; também registrado em .gates.

## Revisão K3 — dependências e remoção

Código vivo usa users/workouts/programs/diets/exercises e três índices.
Gamificação/comunidade/planos/features/conclusão/diário não têm consumidores.
POST workouts/complete tem apenas tombstone 404, sem handler ou persistência.
Aluno conserva leitura de prescrição, séries, carga, descanso, notas e vídeos;
dietas conservam texto/refeições antigas. Cadastro nome/e-mail, gestão,
programas/exercícios/impressão, createdAt e America/Recife preservados.
As datas de validade continuam pertencendo às dietas.

## Revisão K5 — limites e retomada

Nenhuma falha bloqueante conhecida na aceitação local depois das correções.
Isso não comprova o estado dos serviços remotos ou o sucesso de um rollout.

- K6: chave Web pública no histórico, caso (a); restrição/rotação pendentes.
  Consultar phase-16-key-rotation-plan.md. Não executar como parte desta revisão.
- Google já saiu da UI; backend continua aceitando tokens desse provedor.
  Contas existentes precisam vincular senha mantendo UID antes do bloqueio.
  Migração e desligamento não foram executados nem comprovados.
- D6: nenhum dado apagado; padrão não apagar. K1 depende de seleção por coleção.
- K2: não retirar índices remotos usados pela V1/revisões antigas. Transição
  aditiva, prontidão de índices, checagem de consumidores e janela de rollback
  precedem retirada. Emuladores não comprovam prontidão de índices compostos.
- No rollout, verificar atualização de PWA/service worker e abas com scripts
  antigos; servidor novo já nega endpoints aposentados. PWA segue na suíte E2E.
- opencode.json e .opencode/* preexistentes ficaram fora dos commits.

Rollback local: reverter commits de fase em ordem inversa, revisar conflitos
e repetir gates. Nenhum efeito remoto a desfazer. Próximo trabalho operacional
é preparar rollout com revisão realmente publicada e ambiente isolado;
não afirmar produção atualizada por este checkpoint.
