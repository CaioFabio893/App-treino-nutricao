# Treino unificado e paleta do app

Pedido: remover a tela antiga de treinos avulsos, usar o programa completo como única área de Treino e aplicar a paleta do restante do aplicativo.

## Alterações

- Navegação do aluno: somente **Início, Treino e Dieta**.
- `/treinos` agora apresenta os programas completos atribuídos; “Abrir treino” abre `/treinos/{id}`, com a execução A–E existente.
- `/programas` e `/programas/{id}` redirecionam para as respectivas novas URLs. Favoritos antigos continuam funcionando.
- Removido o componente antigo de treinos avulsos e seus testes específicos, pois a tela foi aposentada. Atualizados os testes de navegação e programas para o novo fluxo.
- Mensagem sem conteúdo orienta pedir a associação de um treino completo; não oferece link para a tela antiga.
- Painel de execução usa as variáveis compartilhadas `--d-*`: verde principal `#0B6B52`, fundo `#F1F5F3`, superfícies, bordas, texto, fontes e cores de sucesso/falha do app. Removidas as cores creme/terracota/oliva fixadas no componente.
- APIs, prescrição, associação de alunos, IDs dos programas e chaves do localStorage não foram alterados. Progresso existente continua acessível após a mudança da URL.
- O painel administrativo mantém suas ferramentas de gestão; esta unificação é da experiência do aluno.

## Validação e operação

TypeScript e ESLint aprovados. Vitest: 124 testes, 21 arquivos, incluindo os testes de execução do programa. A redução de cinco testes corresponde exclusivamente à tela antiga removida.

Playwright: 31 testes aprovados (1,6 min), incluindo a navegação com três abas, lista única, execução e persistência após reload. TypeScript e lint aprovados.

Build `6ec1fa7c-e9df-4d4b-972c-3f833cfb4f8e` concluído com sucesso. Imagem `sha256:013228a658614a5c602556b5c628aeb0c3352c1a78b4d05836794f6a6b179fa1`. Web `treino-web-00022-huh` publicado inicialmente sem tráfego, smoke `/login` HTTP 200, depois promovido a 100%. Backend e regras mantidos.

Produção: 17 verificações de navegador aprovadas. Confirmadas três abas com os nomes exatos, cores computadas correspondentes à paleta global, redirects da lista e do detalhe antigos, preenchimento de séries, reload, sucesso/falha, PRs, semanas, histórico, cronômetro e cardio. Associação integral validada com 5 treinos, 30 exercícios e 103 séries. Captura de 390 px inspecionada visualmente: painel, campos e cronômetro verdes, fontes consistentes e navegação com três itens. Contas e recursos criados para o teste foram removidos no `finally`; zero contas temporárias confirmadas ao final. Tag de preview removida.

Uso: abrir o aplicativo → **Treino → Abrir treino**. Se a PWA estiver aberta na versão anterior, fechar e reabrir ou recarregar.

Rollback: restaurar 100% do tráfego de `treino-web` para `treino-web-00019-xak`. Não apagar ou migrar dados locais nem documentos do Firestore. O backend não precisa de rollback. Os registros de progresso usam o mesmo UID/ID de programa e permanecem compatíveis nas duas versões.
