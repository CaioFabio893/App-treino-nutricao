# Decisões de produto pendentes

A refatoração "simplificação" (plano em `docs/simplificacao/`, fases F0 a F7) está parada esperando estas respostas. O app continua funcionando e os testes continuam verdes, mas nenhuma fase seguinte avança sem a sua escolha: são decisões de produto, não de programação, e só você pode tomá-las.

## Como responder

- Marque a opção (A ou B) de cada decisão e escreva, em uma frase, o que motivou sua escolha.
- Preencha a tabela "Respostas" no fim deste documento — ela é o registro oficial do que foi decidido.
- Se alguma decisão não fizer sentido para você, deixe em branco: vale automaticamente o padrão indicado naquela seção.

---

## D1 — o "modo original" sai?

**Pergunta:** O "modo original" deve sair do projeto?

**Opções:**
- **A — Remover:** apagar o que sobrou dele e encerrar a decisão como resolvida.
- **B — Manter:** deixar no código a possibilidade de trazê-lo de volta no futuro.

**Realidade hoje:** as rotas que o sustentavam (`/api/sessions`, `/api/prs`, `/api/state`) já não existem no registro de rotas do backend — hoje ele não muda nada no funcionamento do app.

**Recomendação:** remover — ele já está morto no código; manter só gera dúvida.

**Se não responder, o padrão é:** remover (fechar a decisão).

**O que trava:** F6 (modelo final + reindex) — o modelo não fecha com uma decisão em aberto.

---

## D2 — o modo demo sai?

**Pergunta:** O modo demo (demonstração) deve sair do projeto?

**Opções:**
- **A — Remover:** apagar as menções que sobraram e encerrar a decisão.
- **B — Manter:** recriar o modo demo no futuro, se um dia for útil para mostrar o app.

**Realidade hoje:** as variáveis `DEMO_MODE`, `demoAs` e `NEXT_PUBLIC_DEMO` já não existem no código do frontend; só restaram menções no `frontend/README.md` e no README raiz.

**Recomendação:** remover — o que sobrou é só texto desatualizado.

**Se não responder, o padrão é:** remover (fechar a decisão).

**O que trava:** F4 e F5.

---

## D3 — foto e bio saem do cadastro?

**Pergunta:** `photoURL` (foto) e `bio` (texto sobre você) saem do cadastro do participante? O componente `<Avatar>` (usado em 51 lugares do código) fica?

**Opções:**
- **A — Campos saem, componente fica:** o cadastro fica mais simples; o `<Avatar>` continua existindo, só não lê mais esses dois campos.
- **B — Campos ficam:** mantém foto e bio no cadastro, como hoje.

**Recomendação:** campos saem, componente fica (é o que o plano prevê).

**Se não responder, o padrão é:** campo sai, componente fica.

**O que trava:** F6 — o modelo final só se fecha com a lista de campos decidida.

---

## D4 — data de início e fim saem?

**Pergunta:** `startDate` e `endDate` (data de início e fim do participante) saem do cadastro?

**Opções:**
- **A — Saem na F3:** remove dois campos que hoje só alimentam o cálculo de pontuação, e a pontuação sai na F1.
- **B — Ficam:** mantém os dois campos por volta futura.

**Recomendação:** remover na F3.

**Se não responder, o padrão é:** saem na F3.

**Ressalva:** se um dia você quiser mostrar "aluno há N meses", é só recriar o campo na época — sem prejuízo do que já foi feito.

**O que trava:** F3.

---

## D5 — participante pausado continua vendo o dele?

**Pergunta:** Participante com status "pausado" continua vendo o próprio treino e a própria dieta?

**Opções:**
- **A — Sim:** ele enxerga os dados dele normalmente (a mudança é só na escrita).
- **B — Não:** tudo fica bloqueado para ele, inclusive leitura.

**Recomendação:** sim, e com teste automatizado cobrindo esse caso.

**Se não responder, o padrão é:** sim, com teste.

**O que trava:** F7 (provar a regra de acesso).

---

## D6 — apagar os dados de produção? (ATENÇÃO: APAGA DADO REAL)

**Esta é a única decisão que apaga dado de verdade. Não existe "desfazer" depois de confirmado. A execução NÃO acontece agora: ela será feita depois, com um plano revisado, e nada é apagado sem a sua resposta aqui.**

**Pergunta 1 (a):** Apagar o histórico de treino (`workoutHistory/`) e o diário alimentar (`dietLogs/`) dos participantes?
**Pergunta 2 (b):** Apagar a comunidade, ou seja, os posts (`posts/`)? (depende da D-seção "comunidade" — fase F2)
**Pergunta 3 (c):** Apagar os planos (`plans/`)? (depende da fase F3)

**Opções (para cada uma):**
- **A — Apagar:** o dado sai do sistema de produção.
- **B — Não apagar:** o dado continua onde está.

**Regra que vale para todas:** o código sai sempre; os dados são **exportados antes** de qualquer apagamento. As coleções `scores/` e `scores_history/` já têm autorização prévia de exclusão — as três acima ainda não têm.

**Recomendação:** responder por coleção, uma a uma; não decidir tudo de uma vez.

**Se não responder, o padrão é:** não apagar nada (nada é apagado sem resposta sua).

**O que trava:** a ordem de execução fica em aberto; o plano de deleção (K1) só começa com a sua resposta.

---

## D7 — recurso de outro participante responde 403 ou 404?

**Pergunta:** Quando alguém pede um dado que é de outra pessoa, qual é a resposta?

**Opções:**
- **A — 404 nos dois casos (recomendado):** responde "não existe" — quem não é dono não descobre que o dado de outra pessoa existe.
- **B — Manter 403:** responde "existe, mas não é seu" — mais claro para programador, mas permite descobrir que o dado de outra pessoa existe.

**Recomendação:** 404 nos dois casos.

**Se não responder, o padrão é:** 404 nos dois casos.

**Aviso:** isso muda o status esperado pelos testes automatizados — os testes precisam ser ajustados junto.

**O que trava:** F7.

---

## D8 — "vincular ao participante" continua materializando cópias?

**Pergunta:** Ao vincular um programa a um participante, o sistema continua gravando uma **cópia** do conteúdo para ele?

**Opções:**
- **A — Manter como está (recomendado):** o comportamento atual é coberto por 17 testes em `backend/service/program_test.go` e 28 em `backend/main_programs_test.go`; mudar é reescrever bastante.
- **B — Mudar para referência:** menos cópias no banco, porém mais risco de um participante enxergar conteúdo de outro.

**Recomendação:** manter.

**Se não responder, o padrão é:** manter.

**O que trava:** nada — está resolvido, a não ser que você mude a escolha.

---

## D9 — tirar o login com Google agora ou depois? (tem consequência para quem já entrou com Google)

**Pergunta:** Executar o ADR-002 (remover o login com Google) agora ou depois da simplificação?

**Contexto:** a V2 é e-mail/senha por decisão já tomada, mas hoje o backend ainda aceita `password|google.com` (`backend/middleware/auth.go`) e o botão do Google ainda existe no frontend.

**Opções:**
- **A — Agora:** tira o Google já, mas mistura duas mudanças grandes no mesmo período.
- **B — Depois de F1 a F3 (recomendado):** a simplificação avança primeiro; aí o Google sai sozinho, como etapa isolada.

**Impacto importante:** contas criadas com Google **precisam de uma senha definida antes** — sem isso, essas pessoas ficam sem forma de entrar.

**Recomendação:** depois de F1 a F3, para não misturar duas mudanças grandes.

**Se não responder, o padrão é:** depois de F1 a F3.

**O que trava:** nenhuma fase; mas exige o passo de migração de contas (dar senha a quem entrou com Google) antes de desligar.

---

## Respostas

| Decisão | Escolha (A ou B) | Motivo (uma frase) | Data |
|---|---|---|---|
| D1 |  |  |  |
| D2 |  |  |  |
| D3 |  |  |  |
| D4 |  |  |  |
| D5 |  |  |  |
| D6a (workoutHistory / dietLogs) |  |  |  |
| D6b (posts) |  |  |  |
| D6c (plans) |  |  |  |
| D7 |  |  |  |
| D8 |  |  |  |
| D9 |  |  |  |
