# K6 — Plano de contenção e rotação da chave Firebase Web

Data: 30 set 2026 (America/Sao_Paulo). **Só planejamento: nenhuma ação no console, deploy, teste de produção, rotação ou reescrita executada.** A única escrita autorizada nesta tarefa é este documento; PROJECT_STATE.md não foi alterado devido à restrição explícita da tarefa.

## 1. Diagnóstico e limites da evidência

**Caso (a): uma chave de API pública do Firebase Client Web SDK**, identificada como `NEXT_PUBLIC_FIREBASE_API_KEY`. Não foi encontrado material do caso (b) nos arquivos de texto dos 51 commits alcançáveis pelas referências locais. Chave Web padrão identifica o projeto; não concede privilégios de Admin SDK. Sua publicidade não prova invasão. Riscos: abuso de Auth/cota e de outras APIs permitidas à chave; acesso a dados depende das regras e da autorização da API.

| Evidência local | Resultado |
|---|---|
| `5f82005a61bb1617aacb885a852abbad998f067b`, 23/09/2026 22:02:48 −03:00 | Uma chave distinta, em duas linhas: `docs/progress.md:54` e `docs/reports/phase-15-2-deploy.md:21` |
| `3d59a6c`, 23/09/2026 22:29:10 −03:00 | Redige as duas ocorrências; snapshot sem chave real |
| `fadbb32`, 24/09/2026 17:22:38 −03:00 | Documenta a auditoria F16; snapshot sem chave real. Não é uma segunda exposição nem uma segunda chave |
| HEAD | Nenhuma ocorrência do padrão completo `AIza` + 35 caracteres |
| Histórico alcançável | Busca por chave completa, PEM privado, campos JSON `private_key`/`private_key_id` e `type: service_account`: somente as duas localizações da chave Web |
| `git log -S private_key` | Referências textuais no relatório F16; não material privado |
| `git log -S 'PRIVATE KEY'` | Sem resultado |
| Histórico de `.env*` e `firebase-adminsdk*` | Alterações de `.env.example`; nenhum arquivo adminsdk encontrado pela busca de caminhos informada |

Início comprovado da exposição **no Git local**: horário do commit acima. Data de push/publicação não determinada. O relatório informa que a config veio do bundle público de produção; a chave já era acessível a usuários do site antes do commit, sem data inicial comprovada. Redigir o HEAD não elimina objetos anteriores.

Limites: clone não shallow, mas referências remotas não foram atualizadas; não foram auditados forks, objetos inalcançáveis, anexos, artefatos/binários ou console. Não se pode afirmar ausência universal de service account vazada, ausência de abuso ou que a chave continua ativa. Nenhum valor real aparece neste plano.

Confirmação pelo operador: repetir os comandos read-only do prompt; examinar resultados de `git log --all -S` como candidatos, distinguindo palavras na documentação de credenciais reais. Em terminal privado, comparar o valor histórico com a Browser key em Google Cloud → APIs e serviços → Credenciais, projeto esperado `treino-louise`. Registrar apenas ID da chave, projeto e restrições. Confirmar que é chave padrão **sem vínculo com service account**; o prefixo sozinho não basta. Não copiar valores para tickets, shell history, relatórios ou gravações. Se encontrar PEM/JSON real ou chave vinculada a service account, interromper o caminho (a) e aplicar a seção 8.

## 2. Pré-condições e decisões

Antes de qualquer mutação futura, um operador autorizado deve:

1. Confirmar projeto/número, titularidade da chave e consumidores. Conferir Cloud Run `treino-web`/`treino-api`, região `southamerica-east1`: revisões, imagens por digest, tráfego, domínios e identidade do serviço. Inventariar outros sites/apps/scripts que usam a mesma chave.
2. Resolver a divergência documental: o prompt diz V1 em produção; PROJECT_STATE e relatório F15.2 dizem V2. O código atual está sendo simplificado. **Não implantar HEAD por conveniência.** Usar a fonte exata da revisão servida e mudar somente a config da chave.
3. Guardar, fora do Git e com acesso restrito: config/restrições antigas, quotas, regras efetivamente publicadas, provedores Auth/domínios autorizados, digests e distribuição de tráfego. Essa evidência é a base de rollback, não uma cópia pública da chave.
4. Ter conta controlada de teste, acesso aos e-mails de recuperação, operador IAM autorizado e janela com acompanhamento de logs. Não alterar usuários reais, dados ou credenciais de alunos.

**DECISÃO DA DONA:** autorizar a execução no console/deploy e a janela; confirmar domínios/consumidores suportados; definir tratamento de cadastros suspeitos e eventual suspensão temporária de cadastro; decidir orçamento/quotas e recursos pagos; escolher entre manter histórico com rotação ou limpeza coordenada. Nenhuma dessas decisões foi tomada aqui. D6/deleção de dados não faz parte de K6 e não foi respondida.

## 3. Contenção nas próximas horas

Pré-condição: inventário mínimo e snapshot da seção 2. Se houver abuso ativo, escalar como incidente à dona antes de esperar a migração completa.

**Ação:** Google Cloud → APIs e serviços → Credenciais → chave identificada → restrições de API. Pelo código atual em `frontend/lib/firebase.ts` e `auth.tsx`, só são necessárias **Identity Toolkit API (`identitytoolkit.googleapis.com`) e Token Service API (`securetoken.googleapis.com`)** para cadastro, login, recuperação e renovação. Não há import de SDK cliente Firestore/Storage/FCM nessa camada; nomes de bucket/senderId na config não demonstram uso. Conferir também consumidores e bundle da revisão realmente servida antes de retirar APIs da chave antiga. Retirar da allowlist desta chave APIs não usadas, especialmente APIs pagas como Maps/Gemini. **Não desativar serviços no projeto**: Firestore/Admin SDK pode precisar deles sem usar essa chave.

Adicionar restrição de aplicação Websites/HTTP referrers com os domínios exatos confirmados. Os relatórios registram `https://treino-web-834622951375.southamerica-east1.run.app/*` e `https://treino-web-jn4epizxfq-rj.a.run.app/*`; validar se ainda são utilizados, além do domínio personalizado. Evitar curingas amplos. Dev localhost deve ter chave de desenvolvimento separada; se a chave compartilhada atende dev, planejar a separação antes de retirar essa origem. Conferir política de Referer e comportamento real do navegador: referrer é mitigação, pode ser falsificado por clientes HTTP e não substitui autorização. Domínios autorizados do Firebase Auth são configuração distinta e não bloqueiam todo cadastro REST.

**Verificação:** após propagação, testar login e renovação no domínio real permitido, recuperação com conta controlada e rejeição da mesma chamada em origem não permitida; conferir erro estruturado, não somente HTTP 403. Falha por API bloqueada exige corrigir allowlist com base no consumidor comprovado.

**Rollback:** restaurar somente o domínio/API removido indevidamente com base no snapshot; revalidar. Não voltar automaticamente à chave irrestrita. Se indisponibilidade exigir isso, decisão explícita da dona com monitoramento e prazo.

**Checagens paralelas read-only:** no Firebase Console conferir regras efetivamente publicadas versus política da revisão servida, provedores Auth necessários e domínios autorizados. Regras locais negam escrita direta de negócio, mas permitem criação/edição limitada do próprio perfil e algumas leituras autorizadas; não são um deny-all. Admin SDK Go usa ADC e ignora rules: verificar autorização do backend e IAM separadamente. Não publicar regras locais sobre produção sem comparar versões. Alterações corretivas de rules/provedores são outra ação com snapshot, validação e rollback próprios; não remover Google se consumidores legados ainda dependem dele.

Em Google Cloud, examinar métricas de chamadas/erros/quota das APIs e, quando disponível, dimensão por credencial; revisar faturamento/alertas e leituras/escritas Firestore. No Firebase Auth revisar crescimento de usuários, datas de criação, provedores e sinais de cadastro inesperado desde pelo menos 23/09, comparando com baseline anterior. Conferir logs Cloud Run por picos/401/403/429 e logs de auditoria disponíveis; eles não garantem registrar todos os logins ou toda chamada por chave. Ausência de logs não prova ausência de abuso. Ajustar quota Identity Toolkit apenas após medir demanda legítima; quota baixa pode bloquear login/cadastro/recuperação. Rate limit da API Go não cobre chamadas diretas ao Firebase Auth. App Check/Auth requer avaliar compatibilidade/plano e não deve ser imposto sem testes prévios.

## 4. Rotação em ordem, sem interrupção planejada

| Etapa | Pré-condição e ação | Verificação / impacto | Rollback |
|---|---|---|---|
| R1 — nova chave | Contenção/inventário concluídos; criar chave Web padrão no **mesmo projeto**, sem service account, com APIs e referrers necessários. Manter antiga restrita ativa durante transição | Confirmar projeto/restrições e chamada Auth controlada com nova chave. Usuários e banco não migram | Excluir a nova chave ainda não utilizada; antiga permanece restrita |
| R2 — fontes de configuração | R1 validada; atualizar no ambiente de build `_API_KEY` e `NEXT_PUBLIC_FIREBASE_API_KEY` dos consumidores inventariados; manter projectId/authDomain/appId/API URL. Registrar onde foi trocado | `frontend/cloudbuild.yaml` passa `_API_KEY` ao Docker; `frontend/Dockerfile` embute `NEXT_PUBLIC_*` em `npm run build`. Mudar env de runtime Cloud Run **não altera bundle pronto** | Restaurar fontes anteriores enquanto antiga ainda ativa; preservar a nova chave para investigar |
| R3 — build e revisão sem tráfego | Fonte exata da revisão em produção identificada; construir imagem com nova chave e guardar digest; publicar revisão candidata sem tráfego público, com acesso de teste controlado e origem permitida | Verificar bundle, login, refresh, recuperação e leitura via API. Não incluir simplificação/alterações locais pendentes. Backend ADC não exige rotação pela troca Web | Abandonar candidata; manter revisão e tráfego anteriores |
| R4 — tráfego e caches | R3 aprovada; mover tráfego de forma controlada, acompanhar erros e testar aluno/admin | Novo login e `getIdToken(true)` funcionam; API recebe tokens do mesmo projeto. PWA/cache e abas antigas podem manter bundle antigo. Recarregar app, conferir arquivo JS realmente carregado e migração de usuários. Atualizar SW/cache só se necessário e com revisão própria | Antes da revogação: retornar tráfego à revisão anterior por digest/revisão; antiga continua restrita |
| R5 — retirar dependências antigas | R4 estável; atualizar CI, outros apps e dev; confirmar sessões/bundles ativos e acordar prazo máximo para abas/PWAs antigas | Emuladores usam chave fake (`e2e-fake-api-key`) e hosts locais: preservar isso, não inserir chave real nos testes. Dev que usa Firebase real precisa nova chave/origem e rebuild/restart | Corrigir consumidor restante; adiar revogação apenas dentro da janela acordada |
| R6 — revogar antiga | Todas as dependências migradas; autorização da dona para corte final | Excluir a chave antiga pelo ID no console. Login/cadastro/refresh com bundle antigo podem falhar; ID tokens já emitidos não são automaticamente revogados e a API pode aceitá-los até expirar. Não revogar sessões em massa só por exposição de chave Web | Preferir reparar/reconstruir com nova chave. Restaurar tráfego à imagem com chave antiga **não funciona** após revogação. Restauração da chave excluída pode estar disponível até 30 dias, mas reabre exposição e exige decisão explícita; não é rollback padrão |

**Gate para R6:** preencher revisão/digest anterior e candidato, consumidores migrados, responsável, prazo e evidência de testes antes da exclusão. Se abuso ativo justificar corte antecipado, **DECISÃO DA DONA** sobre indisponibilidade aceitável. Guardar imagem anterior não basta para rollback depois do corte: prever rebuild da fonte anterior com a nova chave.

## 5. Verificação após a execução futura

1. Confirmar no console antiga excluída e nova restrita. Depois da propagação, comparar uma chamada Auth **sem efeito de escrita**, com antiga e nova, usando mesmo endpoint/projeto e Referer permitido. Exemplo de endpoint de leitura: `GET https://identitytoolkit.googleapis.com/v1/projects?key=<CHAVE>` (config pública do projeto). Capturar só status/código de erro, nunca chave/token. A nova deve obter resposta válida; a antiga deve retornar erro de chave inválida/excluída. Um erro de referrer, senha ou API bloqueada não prova revogação. Se o endpoint não for suportado pelo projeto/SDK, escolher a chamada de leitura usada pelo SDK e validar primeiro com nova chave; não usar signUp/reset para sondagem.
2. Repetir controle de revogação até convergir, sem assumir efeito imediato; registrar horário. Testar separadamente restrições da nova em origem não permitida. Não afirmar que a antiga foi invalidada com base apenas no estado do console.
3. Em sessão nova e PWA, login de aluno e admin; forçar renovação do token; logout/login; recuperar senha de conta controlada. Cadastro somente com autorização para conta temporária e cleanup específico — não deletar dados reais. Verificar aluno sem aprovação continua bloqueado e acesso de outro aluno negado.
4. Confirmar `/health`, `/api/me` autenticado, tela de treino/dieta e CORS do domínio aprovado. Verificar bundle novo no navegador e tráfego na revisão correta; observar métricas Auth/Cloud Run e cota durante janela acordada. Se ainda houver bundle antigo, orientar atualização sem apagar dados do aluno.
5. Para checagem de rules em produção, preferir inspeção e leituras negativas de documentos inexistentes. Teste de escrita só em emulador ou fixture isolada autorizada: uma regra defeituosa poderia efetivar a escrita.

Se falhar antes de R6, rollback R4; depois de R6, manter a nova chave e corrigir imagem/config/restrições, ou reconstruir fonte anterior com nova chave. Não alterar regras permissivamente para fazer login funcionar.

## 6. Histórico: escolha posterior à contenção e rotação

**DECISÃO DA DONA**, sem escolha automática:

| Opção | Benefício e custo |
|---|---|
| Rotacionar/restringir e manter histórico | Menor risco operacional, mantém SHAs e colaboração. A antiga continua nos clones, mas deixa de ser utilizável após revogação comprovada. Documentar alerta resolvido por revogação; para chave Web, frequentemente suficiente |
| `git filter-repo --replace-text` em clone separado | Substitui valor exato em blobs mantendo documentação; requer selecionar refs, revalidar tags/mensagens/outros objetos e coordenar force-push. Todos os commits descendentes afetados mudam de SHA; assinaturas/links/PRs podem perder validade |
| BFG em clone mirror separado | Alternativa de substituição em volume; defaults de proteção de blobs/HEAD precisam ser compreendidos. Exige a mesma coordenação e verificação, não remove cópias externas |
| Reescrita manual/rebase | Viável para histórico muito curto; mais propensa a deixar refs, tags ou mensagens com valor e causar conflitos. Force-push é a publicação da reescrita, não um método de limpeza por si só |

Ordem caso aprovada: revogação comprovada → janela de congelamento de pushes → inventário de branches/tags/PR refs e backup protegido do Git → clone isolado atualizado → arquivo de substituição exata fora do repo → ferramenta escolhida → comparar árvores finais e varrer todos os objetos/refs relevantes → revisar efeitos em CI/tags/assinaturas → push forçado **somente das refs aprovadas**, respeitando proteção de branch → confirmar remoto com clone novo → colaboradores reclonam/rebaseiam sem mesclar histórico antigo. Não executar `push --mirror` indiscriminado nem reescrever este checkout com alterações OpenCode pendentes.

Verificação: valor ausente das refs publicadas/clone novo e HEAD equivalente fora da redação. GitHub PR refs, caches, releases, logs de CI e alertas podem exigir tratamento adicional/suporte da hospedagem; não prometer eliminação global.

Rollback antes do push: descartar clone de trabalho, original intacto. Depois do push: restaurar refs mapeadas do backup apenas com coordenação/autorização; isso republica exposição histórica e não reativa chave revogada. Backups retêm o valor e precisam de acesso restrito. Forks/clones de terceiros permanecem: solicitar atualização, mas não é possível revogar cópias. Esconder histórico nunca substitui desativar credencial utilizável; a nova chave Web também será visível no bundle por desenho.

## 7. Resultado da tarefa e próxima execução

Investigação read-only concluída; documento criado. Nenhuma suíte, chamada às APIs do projeto, console, deploy, branch, commit, push ou alteração em PROJECT_STATE executada. Alterações OpenCode preexistentes foram preservadas. Próximo passo operacional: dona autoriza e operador faz inventário/contensão da seção 3, seguindo gates da seção 4. OpenCode pode atualizar documentação após evidência real; não registrar rotação como concluída antes de R6 e seção 5.

## 8. Contingência se surgir caso (b)

Não identificado nesta auditoria. Se surgir private key de service account: preservar evidência sem publicar valor; identificar conta/ID da chave, permissões e consumidores; tratar como comprometimento urgente. Com operador autorizado, desabilitar a chave comprometida imediatamente (aceitando impacto coordenado), investigar IAM/logs/acessos e conter alterações indevidas. Migrar consumidores para identidade Cloud Run/ADC sem chave quando possível; se necessário provisionar substituta com privilégios mínimos e armazená-la fora do Git/`NEXT_PUBLIC_*`, validar e excluir a antiga. A conta inteira não deve ser apagada sem inventário. Rollback é reparar consumidor com nova identidade; reativar chave comprometida não é opção segura padrão. Rotação de service account não invalida automaticamente todos os tokens já emitidos: avaliar sessões/tokens e persistência do invasor como incidente separado. Limpeza de histórico vem depois da contenção.

## Fontes oficiais consultadas

- [Firebase — API keys](https://firebase.google.com/docs/projects/api-keys): natureza da chave Web e APIs requeridas para Auth (Identity Toolkit/Token Service).
- [Firebase — Security checklist](https://firebase.google.com/support/guides/security-checklist): quotas de Auth e proteção baseada em autorização/regras.
- [Google Cloud — Manage API keys](https://docs.cloud.google.com/docs/authentication/api-keys): restrições, chaves padrão versus vinculadas a service account e restauração após exclusão.
- [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth): chamadas de autenticação com chave Web.

Fontes locais: CLAUDE.md, PROJECT_STATE.md, relatório F16, três commits indicados e histórico alcançável; `frontend/lib/{firebase.ts,auth.tsx}`, `frontend/{cloudbuild.yaml,Dockerfile,public/sw.js}`, `firestore.rules`, `backend/{main.go,middleware/auth.go}`. Console/produção continuam não verificados.
