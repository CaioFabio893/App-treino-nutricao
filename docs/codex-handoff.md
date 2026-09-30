# Handoff para o Codex

O Codex entra aqui só no que ele resolve melhor: pareceres, planos e auditorias em modo leitura — segurança, arquitetura, ordem de execução e análise de risco.
Ele **não** deve receber tarefa mecânica (renomear, grep, ajuste pequeno) nem pedidos que exijam ler o repositório inteiro: isso queima cota sem retorno.
Regra: o Codex não implementa o que o OpenCode faz — ele analisa e devolve documento/parecer; a implementação fica com o OpenCode.

## Contexto do projeto

- Aplicação de treino e nutrição: backend Go + frontend Next.js + Firestore + Firebase Auth.
- Só dois papéis hoje: `admin` e `student` (o papel `nutritionist` e o campo `NutritionistID` foram removidos).
- Toda escrita de dado de negócio passa pela API Go; o cliente não escreve no Firestore (as regras negam).
- Timezone oficial `America/Recife` para data de negócio; `createdAt` nunca é sobrescrito em atualização.
- Programa referencia treino (`workoutId` + ordem), não o embute: toda rota que grava programa valida a posse do treino (`Service.ValidateProgramWorkoutOwnership`).
- Estado dos gates medido em 30/09/2026: Go 206 testes passando + `vet` limpo · Vitest 104 · regras Firestore 86 no emulador · E2E 30 · `tsc` sem erro · lint 0/0 · build OK.
- Existe o plano de simplificação F0 a F7 em `docs/simplificacao/`: F4 está feita (ainda sem commit); F1, F2, F3, F5, F6 e F7 não começaram.
- As decisões de produto (D1 a D9) estão em `docs/decisions/product-decisions.md` — P1/P2 já não têm caminho no código, D6 apaga dado real.

---

## K1 — Plano de deleção de dados de produção (P6/D6)

```
Tarefa K1 — Plano de deleção de dados de produção (P6/D6)

CONTEXTO NECESSÁRIO:
docs/simplificacao/03-plano.md, docs/simplificacao/04-perguntas.md,
docs/architecture/firestore-model.md, backend/repository/repository.go,
firestore.indexes.json, firestore.rules, backend/cmd/e2eseed/main.go.

OBJETIVO:
Desenhar a ordem segura para apagar as coleções de produção (decisão D6, que
depende da resposta da Louise): o que exportar antes de cada apagamento, como
provar depois que nada quebrou, e qual é o rollback se algo der errado.
Hoje só scores/ e scores_history/ têm autorização prévia de exclusão.

NÃO ALTERAR:
Nada. É um plano — não executa, não apaga, não muda código, regras nem índices.

VALIDAÇÃO:
Plano entregue com (1) ordem de execução, (2) pré-condições, (3) verificação
pós-execução e (4) rollback.
```

## K2 — Reindex e os 4 índices órfãos

```
Tarefa K2 — Reindex e os 4 índices órfãos

CONTEXTO NECESSÁRIO:
firestore.indexes.json (índices nutritionistId em workouts linhas 20-27,
programs linhas 36-43, diets linhas 52-59, workoutHistory linhas 76-83),
backend/repository/repository.go, docs/architecture/firestore-model.md.

OBJETIVO:
Definir quais índices criar e quais remover (os 4 órfãos de nutritionistId),
a ordem das duas operações e o risco de alguma query ficar indisponível na
transição entre uma versão e outra.

NÃO ALTERAR:
A camada de acesso aos dados e as regras do Firestore.

VALIDAÇÃO:
Plano de rollout com ordem, janela de risco e como voltar se der errado.
```

## K3 — Parecer de segurança da remoção em massa (F1 a F5)

```
Tarefa K3 — Parecer de segurança da remoção em massa (F1 a F5)

CONTEXTO NECESSÁRIO:
docs/simplificacao/03-plano.md e docs/simplificacao/04-perguntas.md (fases F1
gamificação, F2 comunidade, F3 planos/features, F5 escrita do participante).
Peça ao OpenCode os caminhos do código dessas áreas sob demanda — não varra o
repositório inteiro.

OBJETIVO:
Dizer o que a remoção de gamificação, comunidade e planos/features abre:
IDOR, exposição de dado, rota que fica sem guarda, cache ou resto de dado
acessível.

NÃO ALTERAR:
Código. É análise somente leitura.

VALIDAÇÃO:
Relatório com achados priorizados por gravidade.
```

## K4 — Revisão do gate de aceitação (F7)

```
Tarefa K4 — Revisão do gate de aceitação (F7)

CONTEXTO NECESSÁRIO:
docs/simplificacao/03-plano.md (seção F7) e o estado atual dos gates. O resto
do contexto vem do OpenCode sob demanda — não leia o repo inteiro.

OBJETIVO:
Conferir se a combinação teste Go + emulador de regras + E2E prova mesmo a
regra de acesso pretendida (admin acessa tudo, student só o próprio recurso) e
apontar qual caso negativo ainda falta cobrir.

NÃO ALTERAR:
Código. É análise somente leitura.

VALIDAÇÃO:
Parecer dizendo se o gate prova a regra, o que prova e o que falta.
```

## K5 — Auditoria final de segurança pós-simplificação

```
Tarefa K5 — Auditoria final de segurança pós-simplificação

CONTEXTO NECESSÁRIO:
Os arquivos forem passados pelo OpenCode sob demanda (auth em
backend/middleware/auth.go, regras em firestore.rules). Não leia o
repositório inteiro.

OBJETIVO:
Auditoria de autenticação, ownership/IDOR, mass assignment, validação de
payloads, timezone/createdAt e firestore.rules depois que a simplificação
terminar.

NÃO ALTERAR:
Código. É análise somente leitura.

VALIDAÇÃO:
Relatório gravado em docs/reports/ com achados priorizados.
```

## K6 — Plano de rotação da chave exposta (F16)

```
Tarefa K6 — Plano de rotação da chave exposta (F16)

CONTEXTO NECESSÁRIO:
Relatório da F16 em docs/reports/ e os commits 5f82005 até 3d59a6c (chave de
API do Firebase no histórico git).

OBJETIVO:
Passo a passo de rotação da chave + limpeza do histórico, com ordem das
operações e rollback. NÃO EXECUTAR — devolver só o plano.

NÃO ALTERAR:
Nada em produção. Nada é executado por este pedido.

VALIDAÇÃO:
Plano com ordem, pré-condições, verificação e rollback; a execução fica com o
OpenCode.
```

---

## O que NÃO mandar para o Codex

- F1 (gamificação), F2 (comunidade), F3 (planos/features), F5 (escrita do participante): implementação — fica no OpenCode.
- A implementação de F7 (provar a regra de acesso): a análise vai para K4, o código fica no OpenCode.
- Execução mecânica do ADR-002 (remover o login Google).
- Documentação, testes, rodagem de gates e notas de contexto (`CONTEXTO.md` e `contexto/*.md`).

## Ordem sugerida

1. **K6 e K1 primeiro** — não dependem das outras fases; K1 só começa depois da resposta D6 da Louise.
2. **Depois K2** — reindex e os 4 índices órfãos.
3. **Depois K3 e K4** — depois que as fases de remoção rodarem.
4. **K5 no fim** — auditoria final, quando a simplificação estiver concluída.
