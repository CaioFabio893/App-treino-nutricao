# Treino Feminino — checkpoint e continuação OpenCode

Pedido do dono: um programa único com Academia e Em casa; uma associação libera ambas. Vídeos e cronômetros inclusive aquecimento/alongamento; esteira academia dispensada. Trabalho sequencial por um agente. Dono pediu deixar os testes para OpenCode.

## Feito localmente em 07/10/2026

- Fonte preservada em `docs/data/treino-feminino-fonte.md`.
- Preparador determinístico `python scripts/prepare-treino-feminino.py`, sem acesso cloud, gera `docs/data/treino-feminino-preparado.json`: um programa Treino Feminino, quatro treinos gym A–D e quatro home1–4, total58exercícios, inclusive aquecimentos e quatro cardios academia. IDs previsíveis para importação idempotente.
- Modelos WorkoutDefine: modality gym/home opcional, circuitSeconds; exercícios: phase, durationSeconds, timerExcluded. Repository persiste os campos; update preserva modalidade/circuito se editor antigo omitir. Exercícios atuais são preservados pelo spread do WorkoutForm. Validação de modalidade, fase e durações incluída no create/update.
- ProgramDetail deriva modalidades dos treinos, mostra escolha Academia/Em casa e filtra execução/prescrição; programas antigos sem modalidade continuam no fluxo direto. Associação/duplicação existentes copiam todos os oito treinos e suas estruturas (DuplicateWorkoutForStudent copia struct); confirmar com testes.
- Progresso local separado por `${programId}:gym` e `${programId}:home` dentro da chave existente por UID. Progresso antigo não migrado/apagado.
- Cronômetro livre em exercícios por repetição; contagem prescrita quando há duração, incluindo aquecimento. Descanso apenas quando >0. AMRAP15/20min iniciado manualmente após aquecimento. Mantidos controles de séries/resultados/cargas.

## Retomada por OpenCode — 07/10/2026

CONCLUÍDO: 53 exercícios mapeados para 48 vídeos únicos em
`docs/data/treino-feminino-videos.json`; os 48 IDs foram conferidos via YouTube
oEmbed (48/48 existem) e os títulos correspondem ao exercício. Único ponto a
revisar: `Bike Ergométrica` usa vídeo de *ajuste* da bike, não de execução.
`Esteira Inclinada` segue sem vídeo (dispensada, `timerExcluded`).

CONCLUÍDO: AMRAP com contador de voltas, observações e "corrigir última volta";
"concluir volta" reinicia apenas os exercícios principais (aquecimento não conta).
Componente `WorkoutPlayer` + teste dedicado.

CONCLUÍDO: editor admin (`WorkoutForm`) com modalidade, circuito AMRAP, etapa,
duração, dispensar cronômetro e vídeos complementares.

CONCLUÍDO: testes e gates locais — Go 196 PASS + `vet` limpo; Vitest 131/23
arquivos; `tsc`/`lint`/`build` OK. Commits locais; sem push/deploy.

## Pendências após a retomada

Vídeos: revisar se o vídeo de `Bike Ergométrica` deve ser de execução.

Fonte não prescreve alongamentos: não foram inventados. Registrar essa ausência para o dono; incluir apenas se houver prescrição adicional aprovada. Há elíptico/bike na academia, além de esteira. Estes não foram dispensados de vídeo/cronômetro; somente Esteira Inclinada está marcada timerExcluded. “Esteira ou Bike” continua com recursos por incluir bike.

AMRAP: revisão de voltas implementada e testada; não convertido em treino fixo de uma volta.

Edição de metadata no admin implementada (modalidade/fase/duração/vídeos). Descanso legado mantém fallback 180s; novos treinos com modalidade respeitam zero segundos — coberto pelos testes de create/update.

Nenhuma importação real, deploy ou alteração de dados feita nesta tarefa. JSON preparado não significa cadastro publicado. Produção continua com o leitor PDF aprovado (API00025-hof/web00031-jey).

## Checks e próxima ordem

Checks finais executados em 07/10/2026: Go 196 PASS + `vet` limpo, Vitest 131/23, `tsc`/`lint`/`build` OK (ver `.gates`). Não confundir com gates anteriores do PDF.

1. Leia source, JSON e diff; confira58exercícios/8treinos, volumes, descansos, orientações e fases. Duração em faixa usa início da faixa; a faixa original fica nas repetições/notas. Pausa no topo não vira duração total. Dados por lado preservados como texto.
2. CONCLUÍDO em 07/10: vídeos, AMRAP e edição de metadata. Alongamentos mantidos ausentes (fonte não prescreve).
3. CONCLUÍDO localmente em 07/10: Go/Vitest/tsc/lint/build verdes; testes de campos novos e duplicação. E2E de ponta a ponta (modalidade/progresso separado/ownership) fica para a etapa de publicação.
4. Só então publique API antes do frontend, com digest e candidato sem tráfego; confira saúde. Configs/cloudbuild/URLs e práticas operacionais estão em PROJECT_STATE e relatórios anteriores.
5. Importe atomicamente nove documentos com precondição exists:false:8workouts + programs/treino-feminino, studentId vazio. Se IDs existirem, verificar conteúdo e não sobrescrever. OAuth privado via gcloud; nunca imprimir token. Não cadastrar aluno automaticamente.
6. Confira readback de todos os campos e teste associação em fixture rastreada. Remova somente fixture criada por você. Preserve contas/dados reais e docs previamente cadastrados.
7. Atualize este relatório/PROJECT_STATE/.gates com resultados/revisões e instruções: Gestão→Treino→Treino Feminino→Associar programa inteiro→aluno.

Pendente: itens 4–7 (publicação/importação) — exigem credenciais `gcloud` e ordem do dono; nada foi publicado.

## Prompt original (histórico — parte local concluída)

Continue a tarefa Treino Feminino neste mesmo repositório. Leia docs/reports/treino-feminino-handoff.md e PROJECT_STATE.md; implemente as pendências descritas, selecione vídeos reais e adequados, complete AMRAP e edição de metadata e execute os testes. Preserve o programa único com as modalidades Academia/Em casa e a associação única liberando ambas. Aquecimento/alongamento precisam de vídeos e cronômetros, mas a fonte não prescreve alongamentos: não invente. Cardio esteira é dispensado; bike/elíptico não. Cadastre o programa preparado após validação, publique e confira em produção. Trabalhe sozinho; não altere opencode.json/.opencode preexistentes, Windows ou dados reais. Documente resultados e qualquer pendência com honestidade. Não faça push/reescrita de histórico.

Rollback local: revert do commit deste checkpoint antes de publicar; não há dados cloud desta tarefa a apagar. Rollback futuro: preservar revisões anteriores e remover tráfego do candidato se checks falharem; não apagar outros programas ou usuários.
