# Ajustes de treino, nutrição e check-in — handoff para OpenCode

Implementação solicitada pelo dono em 07/10/2026. O dono pediu expressamente para deixar os testes para OpenCode. Nenhuma suíte de testes, lint, typecheck, build ou teste de navegador foi executada nesta tarefa. Foram feitas leitura/revisão do código e preparação visual dos PDFs, além da importação autorizada dos conteúdos. Nenhum push, commit ou deploy do código foi realizado.

## Entregue no código local

- Visão do aluno: cards, hierarquia de títulos, botões acessíveis, tabela de prescrição com rolagem horizontal no celular, tela de execução com melhor contraste e espaçamento.
- Vídeos: componente ExerciseVideo reconhece URLs HTTPS watch, youtu.be, shorts, live e embed com ID válido; abre iframe youtube-nocookie dentro da tela mediante clique. Funciona na execução e na consulta da prescrição. Vídeos com incorporação bloqueada pelo autor têm alternativa de abertura no YouTube. A CSP existente já permite esse domínio.
- Programas: ação "Associar a vários alunos" em cards e tabela, inclusive para programas já atribuídos. Modal permite buscar nome/e-mail, marcar individualmente, selecionar todos da busca e limpar seleção. Para cada selecionado, usa as rotas existentes duplicate + assign; preserva a fonte e cria prescrição independente. Não altera o contrato de posse nem muda o proprietário do programa original. Operação sequencial informa sucesso parcial e mantém selecionados somente os alunos que falharam. IDs de cópias cuja atribuição falhou são conservados no componente para reutilização na tentativa seguinte; após recarregar a página, eventual cópia incompleta permanece na biblioteca e pode ser gerenciada pelo admin. O lote não é transacional.
- Receitas: listagem da API para aluno junta dietas próprias e receitas globais com deduplicação de IDs. Leitura de metadados/páginas permite kind=recipe para todos os perfis aprovados pelas rotas existentes. Escritas continuam admin-only. Dietas continuam restritas ao aluno. Formulário e gestão explicam a disponibilidade geral e não pedem seleção individual para receitas. Página do aluno mostra botões com os nomes e abre o visualizador protegido ao clicar; monta somente a receita aberta. Receitas são disponíveis sem restrição de datas. Todas as dietas vigentes associadas ao aluno são exibidas, evitando esconder planos adicionais.
- Check-in Diário: faixa visível no topo do conteúdo em todas as páginas do aluno, direcionando para https://forms.gle/7E8rybhNQEbnqpTe8 em nova aba, preservando a página do app.
- Service worker passa de treino-v3 para treino-v4 para sinalizar a atualização após publicação.

## Importação concluída no ambiente existente

10 novos registros criados em diets via operação create-only, com IDs determinísticos por hash. 28 páginas PNG enviadas ao bucket privado treino-louise-private-diets, prefixo diet-documents. Documentos anteriores preservados. Os originais PDF continuam nas pastas do dono; não foram adicionados ao Git, a public/ nem enviados ao bucket. Os planos são modelos sem aluno, disponíveis na Gestão → Dietas para duplicar/associar. Receitas são registros kind=recipe sem aluno; o acesso geral depende de publicar o backend desta tarefa.

| Tipo | Nome | Páginas | ID |
| --- | --- | --- | --- |
| diet | Plano Alimentar de PROJETO (MULHERES UTILIZANDO TIRZEPATIDA) | 6 | `pdf-diet-62045c8b7d3ba2f8a28d223e09e958dd` |
| diet | Plano Alimentar de PROJETO VOLTAR AO EIXO (HOMENS EMAGRECIMENTO) | 8 | `pdf-diet-9dfb43005df7611b09e75976b3084ae2` |
| diet | Plano Alimentar de PROJETO VOLTAR AO EIXO (MULHERES EMAGRECIMENTO) | 7 | `pdf-diet-a50e3290c4b89da19f6aaaf6aeb9938b` |
| recipe | Coxinha de batata da Lou | 1 | `pdf-recipe-54858b1c34cab33a2413b1cbbf131c87` |
| recipe | Crepioca da Lou | 1 | `pdf-recipe-0f8c5125bd6b3b31eaf71574946c71bd` |
| recipe | Frango para o apocalipse zumbi | 1 | `pdf-recipe-c4dac56f7816508a4f65ff6f159fa7a8` |
| recipe | Franguinho da Lou (mostarda e mel) | 1 | `pdf-recipe-bba43abd9f2bc057d80629f1236e80c2` |
| recipe | HAMBÚRGUER DE PATINHO DA Lou | 1 | `pdf-recipe-f4c240e18189fcf9c1bd27f7474aed2c` |
| recipe | Panqueca de banana | 1 | `pdf-recipe-ded3ef311f4dd3600465d1cfa05d1604` |
| recipe | PATÊ DA LOU | 1 | `pdf-recipe-7b1c7d3e745142280fbfa76d987fa837` |

Material operacional privado: C:/Users/caiof/AppData/Local/TreinoLouiseOps/2026-10-07-ajustes/ (manifesto, imagens, preparação e contato visual). Script reutilizável no repositório: scripts/import-private-nutrition.ps1; recebe um manifesto externo, não inclui credenciais. Operação create-only aceita ALREADY_EXISTS em reexecuções e não sobrescreve cadastros.

## Próximo passo do OpenCode

1. Revisar diff sem incluir as alterações preexistentes do dono em opencode.json e .opencode/. Não alterar essas configurações.
2. Atualizar/adicionar testes necessários e executar typecheck, lint, Vitest, Go/vet e E2E conforme a governança do projeto. Não presumir que passaram. Os testes antigos de associação individual e receitas privadas poderão precisar refletir o novo comportamento.
3. Conferir visualmente treino em telas pequenas, vídeos incorporados, botão Check-in Diário, seleção em lote com busca e falha parcial/retry. Conferir os 3 documentos de biblioteca na gestão e 7 botões de receita para aluno aprovado.
4. Cobrir autorização: aluno aprovado e pausado lê receitas globais e páginas; pendente/inativo/anônimo permanece bloqueado; aluno não lê dieta alheia/biblioteca; aluno não escreve; metadados e páginas continuam privados/no-store. Consulta global de receitas usa apenas filtro kind, sem novo índice composto.
5. Validar que clone/assign mantém exercícios, vídeos, modalidades, timers e a fonte do programa para 2+ alunos; progresso permanece isolado por conta/programa. Confirmar erro parcial sem repetir os alunos já concluídos.
6. Depois da validação, tratar publicação pelo fluxo do projeto. Publicar backend antes do frontend para a leitura global das receitas. Até essa publicação, o app online mantém sua interface e regras anteriores, embora os novos PDFs já estejam cadastrados.

Comandos de referência, a executar pelo OpenCode: frontend npm test / npm run lint / npx tsc --noEmit / npm run build / npm run test:e2e; backend go test ./... / go vet ./.... Os testes devem usar emuladores/fixtures, preservar alunos e conteúdos reais e não repetir a importação para validar o app.
