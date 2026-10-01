# Receitas, formatação e revisão visual — 01/10/2026

## Pedido e entrega

Adicionar Receitas como área própria, com cadastro de texto e associação por aluno, permitir negrito e sinais em Dieta/Receitas e suavizar o layout existente.

- Navegação do aluno: Início, Treino, Dieta e Receitas. Atalho correspondente na página inicial.
- Administração: Receitas, com criar, editar, associar aluno, duplicar e excluir pelo mesmo fluxo autorizado da dieta. Atalho “+ Receita” no perfil do aluno.
- Receitas e dietas ficam separadas nas listas e na leitura do aluno. A área de Receitas mostra todas as receitas atribuídas dentro da vigência; Dieta conserva a seleção da dieta vigente existente.
- Editor de texto com Negrito, Título, Lista, Visualizar e Ctrl/Cmd+B. Selecionar texto e usar os botões; colar conteúdo textual e organizar. Símbolos e emojis aceitos. O editor armazena marcação textual simples: `**negrito**`, `## título` e `- lista`. A prévia, a tela do aluno e a impressão renderizam essa formatação.
- HTML arbitrário não é executado; é exibido como texto. Não há links executáveis, imagens externas ou scripts no renderizador. Colagem de texto de Word/sites não importa automaticamente os estilos do documento de origem: aplicar os botões do editor ou colar a marcação simples.
- Revisão visual: superfícies e cartões com cantos suaves, espaçamento maior, títulos mais claros, sombras discretas e navegação arredondada. Paleta verde compartilhada preservada. Painel de treino mantém todas as funções e registros existentes.

## Dados e autorização

Receitas reutilizam a coleção e endpoints `diets`, com o campo `kind: "recipe"`. Dietas novas usam `kind: "diet"`; documentos antigos sem `kind` continuam sendo dietas. Não há migração ou alteração dos documentos existentes. A API valida o tipo, grava o campo em criação/edição e preserva o tipo ao duplicar; edição por cliente antigo sem o campo conserva o tipo anterior.

A mesma autorização de dieta protege receitas: aluno lê apenas seu conteúdo; terceiros recebem 404; gravação é exclusiva do administrador. Regras e índices do Firestore permanecem válidos, sem nova coleção ou permissão. Aluno não edita a prescrição nem receitas.

## Uso

Administração → Receitas → Nova receita → selecionar aluno (ou deixar como biblioteca), preencher nome e colar conteúdo. Selecionar trechos e clicar Negrito; usar Título/Lista e conferir em Visualizar; Salvar receita. Em Dietas, os mesmos botões aparecem no formulário. Aluno acessa Dieta ou Receitas pelo menu inferior. O botão Copiar conserva o texto com sua marcação, útil para nova edição.

## Validação e publicação

Vitest: 126 testes aprovados, 22 arquivos; testes novos verificam renderização de negrito/títulos/marcadores, escape de HTML e editor/prévia. Go test e vet aprovados. Integração nova cobre criação de receita na UI, persistência de `kind`, duplicação, formatação para aluno, separação de dieta, terceiro 404 e escrita de aluno 403.

A primeira execução de integração teve 31 aprovações e falha no teste antigo do programa ao clicar durante o redirect `/programas` → `/treinos`. O teste passou a aguardar a URL final explicitamente, sem alterar o fluxo funcional de treino.

Integração final: 32 testes aprovados (2,5 min). TypeScript, ESLint e testes específicos do editor/dieta aprovados novamente após refinamentos de texto e seleção de várias linhas.

Build de API: `372152ce-7f76-4558-895d-ca167f38ef25`; revisão `treino-api-00019-yac`, imagem `sha256:999b3b441e98aed34a2f2c163fe43dab4005c5ac1f87d2f3dcae35fbafcd5c40`, health HTTP 200. Build final de frontend: `0b1dab1b-8a57-4b4d-b3b4-be3acbc2390b`, revisão `treino-web-00026-net`, imagem `sha256:64c645fc66f55fb35879830b6fa47505f3205ef43cfe0e30a50fa6c731892b2f`, login HTTP 200. API promovida antes do frontend; ambas com 100% do tráfego. Builds intermediários `7c5f18d1-1416-4699-b347-d654860df7f1` e `09bcd2b3-1c5d-475e-aad0-b349c88bd592` não são a versão final.

## Rollback e continuidade

Validação final em produção: seis verificações de UI aprovadas (login admin, edição da receita, prévia em negrito, receita formatada exclusiva no aluno, menu com quatro itens, dieta formatada sem mistura). API confirmou gravação/leitura dos dois tipos, rejeição de tipo desconhecido com 400 e edição por aluno com 403. As capturas `recipes-mobile.png` e `recipes-admin.png` foram inspecionadas visualmente: conteúdo organizado, navegação e formulário sem perda da formatação.

As primeiras tentativas de verificar nutrição junto com todo o fluxo de treino atingiram o limite existente de 120 requisições/minuto; logs confirmaram OPTIONS de diets/students com 429. O teste foi separado por área, sem aumentar o limite nem alterar permissões. As duas tentativas anteriores e a final limparam seus próprios recursos no `finally`. Zero contas temporárias e zero conteúdos nutricionais temporários confirmados ao final; administrador do dono preservado. Tags de preview removidas.

Guardar as revisões anteriores `treino-api-00016-gic` e `treino-web-00022-huh`. Rollback visual: voltar apenas o frontend, conservando a API atual e todos os dados; a versão antiga não separa receitas da dieta, portanto pode apresentá-las como dieta. Não usar a API antiga para editar receitas: ela não conhece `kind`. Para rollback completo, interromper novas gravações até restaurar uma versão compatível com o campo, preservando os documentos; não excluir receitas nem modificar conteúdo para contornar compatibilidade.

Não repetir o reset de contas/dados. Configurações de Windows e OpenCode preexistentes não foram alteradas por esta tarefa. Scripts e resultados operacionais privados em `%LOCALAPPDATA%/TreinoLouiseOps/2026-10-01`, com limpeza restrita a recursos temporários criados para validar.
