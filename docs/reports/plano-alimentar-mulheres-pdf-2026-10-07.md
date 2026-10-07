# Plano Alimentar Mulheres — documento com acesso controlado

Pedido: criar uma nova dieta com o PDF fornecido e dificultar ao máximo seu download. O PDF original foi preservado no computador do dono; não foi enviado ao aplicativo, ao Git ou ao bucket. Nenhuma dieta anterior foi sobrescrita.

## Implementação

- As sete páginas foram renderizadas a 150 DPI, mantendo o conteúdo e a aparência da fonte, e conferidas visualmente.
- Novo registro de biblioteca `diets/plano-alimentar-mulheres`, nome **Plano Alimentar Mulheres**, sem aluno escolhido automaticamente. Documento referenciado por ID opaco e contagem de páginas.
- Bucket `treino-louise-private-diets`, região `southamerica-east1`, acesso uniforme e prevenção de acesso público `enforced`. Somente as sete imagens PNG foram enviadas.
- API lê páginas com ADC da conta do Cloud Run; exige autenticação, perfil autorizado e posse da dieta ou papel admin em cada pedido. Recursos alheios respondem 404; sessão inválida 401; perfil bloqueado 403.
- A pedido do dono, as marcas d’água foram removidas do servidor e do navegador. A resposta mantém os pixels originais das páginas renderizadas. Sem endpoint do original, links públicos, URLs assinadas ou botões de baixar/copiar/imprimir.
- Respostas `private, no-store`, `nosniff` e `Vary: Authorization`; o service worker já exclui API externa e pedidos autenticados de seu cache. Imagens têm limite de bytes, dimensões e pixels antes da decodificação.
- As sete páginas aparecem em uma única tela com rolagem contínua e zoom até300%, sem controles Anterior/Próxima. Carregamento sequencial limita requisições e memória; os bitmaps são fechados após cada desenho. Canvas e requisição são limpos ao trocar/sair/bloquear a sessão. Impressão oculta o visualizador, inclusive a rota administrativa de impressão rejeita documentos.
- Edição e duplicação preservam o documento. Dietas em texto e Receitas continuam disponíveis.

Isso dificulta obter o arquivo original e restringe o acesso às páginas, mas não impede screenshots, fotografia da tela ou extração dos pixels por um usuário autorizado. Não existe garantia absoluta de impedir cópia de algo que pode ser visualizado.

## Como usar

Em Gestão → Dietas, abra **Plano Alimentar Mulheres**. Use **Duplicar** e escolha um aluno para criar sua cópia associada. Para um único aluno, também é possível **Editar**, escolher Aluno e salvar. A opção Duplicar mantém a biblioteca para outros alunos. O aluno vê o documento em Dieta conforme as datas de vigência.

## Agentes

Codex implementou backend, frontend, importação e revisão independente de autorização/cache/memória. OpenCode executou revisão conceitual somente leitura; suas recomendações sobre bucket privado, marca no servidor e cache foram incorporadas. Gemini foi invocado, mas seu CLI recusou autenticação com `UNSUPPORTED_CLIENT`; não realizou a revisão. Nenhuma atualização de ferramenta/configuração Windows foi feita para contornar o erro.

## Verificação e operação

TypeScript e lint passaram; Vitest 129 testes em 23 arquivos; Go `go test ./...` e `go vet ./...` passaram, incluindo autorização das páginas, limites, preservação dos pixels e metadados de metadados. Acesso anônimo ao objeto privado retornou 403. Builds e verificação de produção registrados após a publicação abaixo.

Scripts e evidências operacionais privados, incluindo renderizações, checks, IDs de builds e importação:
`C:/Users/caiof/AppData/Local/TreinoLouiseOps/2026-10-07/`.
Nunca adicionar esses arquivos ao Git, sobretudo fixtures de autenticação. A verificação usa contas temporárias rastreadas e remove somente essas fixtures no finally.

Configuração de execução: `DIET_DOCUMENT_BUCKET=treino-louise-private-diets`; objetos `diet-documents/{id}/{pagina}.png`. Não há upload genérico de PDF pelo usuário: este arquivo foi importado operacionalmente, sem superfície pública de conversão/upload.

## Recuperação

Pré-publicação: API `treino-api-00019-yac`, web `treino-web-00026-net`, ambas 100%. Em falha, retornar tráfego à revisão web anterior primeiro e depois à API anterior. A dieta de biblioteca e as páginas privadas podem permanecer sem afetar textos existentes; nenhuma etapa de rollback exige apagar dados reais. A revisão antiga não conhece documentos, portanto a nova dieta ficaria sem leitor até restaurar a revisão nova.

Ajustes de capacidade do candidato API: memória 512 MiB, concorrência 8 para limitar decodificação paralela. A revisão anterior mantém sua configuração. Sem reescrita de histórico, force-push ou alterações nas configurações OpenCode preexistentes.

## Publicação e aceite

Build API `723cce87-8864-41d8-af39-7e8521a80fa5`, web `061df396-db68-4c2f-b994-d46208d5b4b1`, ambos SUCCESS. E2E 32 testes passaram (3,1 min).

API `treino-api-00022-nis`, imagem `sha256:57ac9204c7b67b1cce83a2fa19bc667232b765846d2aa869bd90e810f5353849`.
Web `treino-web-00029-wod`, imagem `sha256:c1759df3a749ab7cc316dce2c551555446bceb59aaa864e9495d0a5bd649cd1d`.
Health API e login web candidatos HTTP200 antes de promoção. API promovida antes da web.

Versão inicial: verificação API produção passou (sete páginas, duplicação/edição,401/404,original ausente), UI8checks passou; fixtures removidas. A revisão final de rolagem contínua sem marcas substitui essa interface. Resultado da publicação final será registrado abaixo.

Preferência de trabalho do dono alterada ao final: um agente por vez, tarefa completa e handoff documentado. A delegação desta tarefa ocorreu antes desse pedido; nenhuma nova delegação após ele.

## Revisão solicitada pelo dono

O dono confirmou a leitura, mas preferiu remover marcas e paginação para preservar a legibilidade. Implementada rolagem contínua, sete canvases, zoom100/150/200/300%, impressão oculta e autorização por página mantida. Testes locais finais: Go/vet PASS, tsc/lint PASS, Vitest129/23arquivos PASS. A ausência de marca aumenta a facilidade de compartilhar capturas; o dono escolheu esse equilíbrio.

Publicação final: API treino-api-00025-hof, web treino-web-00031-jey. Builds 4a9234b7-c9c4-41bb-8ea2-e6a42c82542d e 556b856a-5a38-4c2f-b613-7a5bf28f5d68 SUCCESS. Digests: API sha256:aa90c38d9473afdae7e55b70ad3dce40f8478b7170ade56ab502aa80d3c8dfc7, web sha256:f584d8850d9f8ad38de39e1bff1e6943d53c7fe01d1da655eb0d896c190078f2.

Aceite final em produção: API PASS incluindo SHA256 idêntico à imagem fonte em todas as sete páginas (nenhuma marca residual), autenticação401, posse404, limites404,original404,duplicação/edição preservadas. UI8checks PASS: sete canvases carregados, ausência de paginação/download, zoom200%, impressão oculta, cache privado ausente e previewadmin. Fixtures temporárias removidas; dados reais preservados. Tags de teste removidas. Após publicação, reabrir/recarregar abas já abertas para usar o novo leitor.
