# Associação em lote de treinos e planos alimentares — 08/10/2026

Implementado no frontend, sem testes/build/lint/deploy nesta etapa, conforme preferência do dono. Planos alimentares agora oferecem Associar a vários alunos, usando duplicateDiet com newStudentId e nome original, preservando refeições e documento privado. Treinos usam o mesmo seletor e preservam cópia independente, retries com clone pendente durante a sessão e o modelo original.

Seletor compartilhado: busca insensível a acentos por nome/e-mail, ordenação por nome, seleção de todos da busca ou da lista completa, limpar, contador, lista em blocos de 100, progresso e tentativa apenas dos pendentes. Dialog nativo prende o foco e bloqueia fechamento durante execução. Conteúdo da lista só é renderizado com dialog aberto. Processamento com até três alunos simultâneos, sem disparar requisições ilimitadas. Não é fila em segundo plano: manter a tela aberta durante a associação. Repetição após perda ambígua de conexão pode gerar cópia extra; API atual não possui chave de idempotência. Não foram criados vínculos em dados reais.

OpenCode: validar planos PDF/refeições/texto e treinos completos, seleção filtrada preservada entre buscas, 100+ alunos/mostrar mais, acentos, progresso, falha parcial/token, retry sem reenviar sucessos, teclado/Escape, mobile e autorização. Atualizar testes antigos do botão Duplicar em dietas. Publicação pendente.

## Fechamento pelo Codex — validado e publicado

O dono autorizou remover o seletor flutuante Aluno/Gestão/Cadastro e realizar os testes. Providers deixou de montar AdminAreaSwitch; rotas/menu administrativo preservados. Tests: TypeScript PASS; ESLint completo e arquivos alterados PASS (0 erros/avisos); Vitest147/27 arquivos PASS, incluindo dois testes novos de planos alimentares (seleção e retry parcial); build webpack PASS. E2E33/33 PASS em 2.4min com emuladores, incluindo associação de plano a dois alunos/modelo preservado/seletor ausente e fluxo completo do programa de treino. Setup jsdom recebe stub do dialog nativo; E2E usa o dialog real. Nenhuma conta real foi usada nos testes.

Cloud Build fce3bdbb-a232-4ab2-8ea6-86633365824c SUCCESS, imagem sha256:5d8ce3273c2564c58394ba7049d3271a4f14d2dafce21fef5ed3b423411c8328. Publicado treino-web-00024-ll9, 100% do tráfego. Backend preservado. A solução usa a API atual com até três associações simultâneas; não foi feito teste de carga com milhares de usuários concorrentes, nem implementada fila de servidor/idempotência. Atualização concluída; limitações operacionais descritas acima seguem válidas.
