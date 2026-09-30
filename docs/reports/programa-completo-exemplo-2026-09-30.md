# Programa completo do exemplo — 30/09/2026

Pedido do dono: cadastrar a programação inteira do diretório `C:/Users/caiof/OneDrive/Desktop/exemplo`, preservando a prescrição, e associar todos os treinos a um aluno numa única ação.

## Entrega

Programa `Louise Lima (Ciclo 2)` cadastrado na biblioteca de produção, ID `louise-ciclo-2`. Tem cinco treinos A–E, 30 exercícios e 103 séries. Cardio B/D com as três opções, observações dos exercícios, estrutura semanal, PRs e periodização de oito semanas preservados. Sem aluno associado: nenhum destinatário específico foi indicado. As contas existentes foram preservadas.

Abrir: https://treino-web-834622951375.southamerica-east1.run.app/admin/programs?id=louise-ciclo-2

Na listagem Programas, clicar **Associar programa inteiro** e escolher o aluno. A API existente já materializa os cinco treinos em uma só associação; o aluno recebe o programa com todas as referências e prescrição. Não é preciso associar treino por treino. Para manter também um modelo disponível para outras pessoas, duplicar o programa antes de associar; a associação atual vincula o programa escolhido ao aluno.

## Fonte e fidelidade

- Fonte canônica de conteúdo: `exemplo/treino.md`; SHA256 `3C6E7A39599F6629F5B5257302B01F3D31F791958AFAA78B45D89E2A54F92B5D`.
- Comparação automática com o array DAYS de `exemplo/index.html`: os 30 nomes/séries/repetições/observações e todos os itens de cardio coincidem. Nenhuma carga, descanso ou vídeo foi inventado.
- Parser existente programmd.Parse + service.ConvertProgram usado para gerar os mesmos modelos da importação normal. Rótulos A–E e ordem mantidos. O parser mapeia Dia 1–5 para segunda–sexta conforme convenção já existente; a estrutura numérica original continua nas notas.
- Escrita administrativa OAuth de seis documentos em um commit atômico Firestore, com precondição exists=false para não sobrescrever dados. Leitura posterior comparou os campos/prescrição completos. IDs dos treinos: louise-ciclo-2-A até louise-ciclo-2-E.
- A entrega preserva o conteúdo da prescrição no aplicativo atual; não substitui a aplicação pelo HTML antigo nem reintroduz registros de execução/timers.

## Interface

- Programas: botão **+ Novo programa completo**.
- Cadastro: **Usar programa exemplo completo (A–E)** preenche o documento integral, antes o exemplo só tinha dois exercícios do treino A.
- Seletor do aluno deixa explícito que associa todos os treinos.
- Treinos: atalho **Cadastrar programa completo**, evitando começar a programação por treinos avulsos.
- Modal de associação explica a operação e quando duplicar para conservar um modelo; removida a afirmação incorreta de que o programa original sempre permanecia na biblioteca.
- Descrição do treino do aluno preserva quebras de linha do cardio.

## Validação e publicação

- Vitest124/124, tsc e lint PASS.
- E2E31/31 (1,6 min). Teste programas.spec.ts atualizado de exemplo reduzido para A–E integral: importação 5/30/103, duplicação, associação única e leitura pelo aluno.
- Nenhuma mudança de backend/regras/índices; gates Go188/vet/rules106 anteriores continuam aplicáveis.
- Cloud Build `8c3fd8d0-ec7e-4a8f-9f6f-e6c265c7d1bd` SUCCESS.
- Frontend digest `sha256:76f90ee747ee6fe861915c5a0f2bc014cf63094ece4a92d849c8aaf4e169f320`.
- Revisão frontend `treino-web-00016-juj`, 100% tráfego. Backend continua `treino-api-00016-gic`.
- Código commit `94a132b`. Sem push/reescrita Git; configurações OpenCode/Windows preservadas.
- Produção: duplicado o programa para uma fixture, associado a um aluno temporário em uma chamada e comparados os cinco treinos com a fonte: todos os 30 exercícios/103 séries, cardio e notas iguais. Seis checks de navegador PASS: login admin, novo cadastro, modal de associação, detalhe 5/30 e seleção do programa exemplo/aluno.
- Cleanup: programa temporário, dez treinos temporários e duas contas/perfis de teste removidos. Original continua sem aluno. Inventário final: 1 programa e 5 treinos; zero contas/perfis de fixture. Há 2 contas/perfis reais, preservados, incluindo o administrador do dono. Não foi repetido o reset anterior.
- Tags temporárias removidas; captura completa do programa inspecionada.

## Recuperação e continuidade

Rollback só de interface: retornar tráfego à revisão `treino-web-00013-ven` (usa a mesma chave nova). O programa e os treinos ficam gravados e continuam compatíveis. Se necessário desfazer apenas a importação, revisar vínculos e remover exclusivamente os seis IDs acima; não executar reset geral nem apagar dados de alunos. Programa associado exige revisão da posse/vínculos antes de qualquer remoção.

Artefatos operacionais privados em `C:/Users/caiof/AppData/Local/TreinoLouiseOps/2026-09-30-program/`: preview, script de importação, evidência de fidelidade/readback e testes. Não publicar fixtures-private.json (credenciais temporárias já excluídas).

Próximo passo do dono: entrar em Programas, abrir o modelo e associá-lo ao aluno escolhido. Reabrir aba/PWA se ainda mostrar rótulos antigos. O exemplo integral também fica em frontend/lib/program-example.ts para reutilizar pelo cadastro.
