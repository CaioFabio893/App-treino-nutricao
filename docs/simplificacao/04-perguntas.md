# 04 — Perguntas que dependem do dono

> As 5 decisões do bloco "DECISÕES JÁ TOMADAS" são **premissa**, não pergunta.
> Este arquivo lista só o que **não** foi decidido e **muda o escopo**.
>
> Cada pergunta traz: a evidência medida, a recomendação, e o que quebra se a
> resposta for diferente. **P1 e P2 bloqueiam a F1.**

---

## P1 — O "modo original" (sessions/prs/state) sai? ⛔ BLOQUEIA

**Medido:** 6 rotas em `backend/main.go` L139–L144
(`GET/PUT /api/sessions/{week}/{day}`, `GET/PUT /api/prs`, `GET/PUT /api/state`),
implementadas em `backend/handlers/handlers.go` (189L), mais
`frontend/lib/data.ts` (152L) e `days.ts` (30L), e a regra
`firestore.rules` L108–L110 (`users/{uid}/{subcollection}`).

**O problema:** essas rotas **não estão** na sua lista de remoção, mas também
**não estão** no formato novo do sistema (§4: `Login → Minha área → Treinos | Dieta`).
São o "modo original" da V1 — o aluno registrava série/PR à mão. São 6 rotas de
63 (10%) e ~370 linhas.

**Recomendação: REMOVER.** Três razões: (1) não serve a nenhum dos cinco casos
do §6; (2) `prs` e `state` são dados que **ninguém** consulta depois que o
`workoutHistory` sai na F5 — viram escrita morta; (3) manter exige manter a
regra `users/{uid}/{subcollection}` e dois arquivos de `lib/`.

**Se responder PRESERVAR:** somam-se ~370 linhas, 6 rotas e 1 regra que
continuam sem consumidor no fluxo novo. E a F6 fecha com 6 coleções em vez de 5.
Impacto: pequeno e mecânico. Mas a pergunta é sua porque é decisão de produto
(esquecer de tirar senha?), não técnica.

---

## P2 — O modo demo (`DEMO_MODE`) sai? ⛔ BLOQUEIA, e é a que mais economiza

**Medido:**

| Arquivo | Ocorrências |
|---|---|
| `frontend/lib/api.ts` | **67** (L35–L56, L589, + um ramo em **cada** função) |
| `frontend/lib/auth.tsx` | **26** |
| `frontend/components/DemoRoleSwitch.tsx` | 10 |
| `frontend/__tests__/auth-demo.test.tsx` | 4 |
| `frontend/__tests__/programs-api.test.ts` | 3 |
| `frontend/__tests__/ProgramDetail.test.tsx` | 3 |

`frontend/lib/config.ts` L3 liga com `NEXT_PUBLIC_DEMO=1`.

**O que é:** um app inteiro de mentira dentro do app real. Cada função de
`api.ts` tem **dois caminhos** — demo em `localStorage` e real em HTTP. É a
razão de `api.ts` ter **1.880 linhas** em vez de ~900. `DemoRoleSwitch.tsx` L16
troca o papel `nutritionist`↔`student` e L23–L33 reseta os dados do demo.

**Por que é bloqueio:** remover `demoAs`/`setDemoAs` de `lib/auth.tsx` é
**alterar arquivo de autenticação**. O §2 do prompt tem regra dura: *"se
qualquer passo exigir alterar um arquivo de autenticação, PARE e pergunte"*.
Então eu paro e pergunto.

**Recomendação: REMOVER.** Não é autenticação — é um toggle de papel para
apresentação, atrás de `if (!DEMO_MODE) return null` (L13). Deixar custa ~25% do
`api.ts` em código que nunca roda em produção e que **nenhum teste de regra de
acesso exercita** (o E2E sobe emulador + API real, não o demo).

⚠️ **Conferir antes:** o modo demo é usado em alguma apresentação/manual do
produto? Se sim, a remoção é de produção mas o demo pode virar um script
separado em vez de sumir.

**Se responder PRESERVAR:** nada quebra — `api.ts` fica com os dois caminhos e a
F4 ainda remove os 200 `nutritionist` dos dois lados. Mas o `DemoRoleSwitch` L16
vira `demoAs === "admin" ? "student" : "admin"`, e a pergunta volta na F5.

**Se responder REMOVER:** toca `auth.tsx` (remoção de um campo de estado, não do
fluxo de login), `api.ts` (67 pontos), `Providers.tsx` L6+L15, e **3 arquivos de
teste** (`auth-demo.test.tsx` inteiro). Considero isso *remoção*, não
*reescrita* — o login, logout, cadastro, recuperação e redefinição **não são
tocados**.

---

## P3 — `photoURL` e `bio` saem do modelo, mas o componente `<Avatar>` fica?

**Medido:** `UserProfile.PhotoURL` (L94) e `.Bio` (L95). `photoURL` está na
allowlist `allowedSelfProfileUpdate` (`firestore.rules` L75–L82) e no
`PUT /api/me`. `<Avatar>` (`components/Avatar.tsx`, 22L) tem **51 usos** em
`app/admin`, `app/nutritionist/*`, `PendingApprovals`, `StudentDetail`, `Feed`,
`PostCard`, `Sidebar`, `Skeleton`.

**O fato que decide:** a V2 é e-mail/senha (decisão de produto; login Google
saiu). **Nada preenche `photoURL`.** Login com Google não gera `photoURL`
automático. Então o campo é lixo de dado — e `bio` só existia para o perfil
público, que sai (decisão 3).

**Recomendação: os dois campos SAEM do modelo; o componente `<Avatar>` FICA.**
O componente gera iniciais a partir do nome — é como o admin distingue dois
"João Silva" na fila de aprovação. Remover o *dado* e manter a *identidade
visual* são coisas diferentes, e aqui elas apontam em direções opostas.

**Se responder REMOVER TAMBÉM O COMPONENTE:** a fila de aprovação vira uma lista
de nomes em texto. 51 arquivos tocados a mais. Não recomendo.

---

## P4 — `startDate` e `endDate` saem?

**Medido:** `UserProfile.StartDate` (L98), `.EndDate` (L99). O único
consumidor é `cycleScoreFromData(cycle, userStart, ...)` em
`backend/service/cycle.go` L112 — o denominador da nota. Esse arquivo **sai na
F1**. Depois da F1 os dois campos não têm **nenhum** leitor.

**Consequência se saírem:** precisam sair também de `service/profile.go`,
`handlers/nutrition.go` (`mergeStudentEdits` L272, `preserveAdminFields` L209),
`repository.go` (`userProfileData`), do comentário L15 do `firestore.rules`, e
do formulário de edição do participante no `StudentDetail` (855L).

**Recomendação: REMOVER na F3.** Nenhum consumidor depois da F1, e um campo de
data que ninguém lê é um convite para o próximo dev inventar um uso.

**Contrapartida a considerar:** `startDate` é o "início do acompanhamento" —
informação de negócio legítima que o admin pode querer mostrar. Se for esse o
caso, o certo **não é manter o campo órfão**: é promoting a uma informação com
uso real (ex.: "participante há N meses"). Isso é RECRIAR, não PRESERVAR.

---

## P5 — Participante `paused` continua vendo treino e dieta?

**Medido:** `firestore.rules` L48–L55 — `isApprovedUser()` aceita `''`
(legado), `active` **e `paused`**. E `backend/middleware/auth.go::IsApproved`
aceita os mesmos três. `StatusPaused` existe (`models/types.go` L60) e
`RequireApproved` é o gate de `GET /api/diets` e `GET /api/workouts`.

**Por que importa agora:** com `RequireFeature` removido na F3, **não existe mais
nenhum gate além de `RequireApproved`**. "Libreleased = participante ativo" (§4
das decisões) fica ambiguo: `paused` é aprovado? Na prática, hoje `paused` vê
tudo.

**Recomendação: `paused` continua vendo** (é o estado "aluno em pausa", não
"aluno bloqueado") — **e deixar isso escrito num teste**, porque a remoção do
gate de feature eliminou a rede de segurança que hoje documenta essa decisão.

**Se responder "paused NÃO vê":** `IsApproved` passa a aceitar só `''` e
`active`, e `isApprovedUser` idem. É uma linha em cada lado — mas exige decidir
o que a UI mostra para o usuário pausado, senão ele vê botões que dão 403.

---

## P6 — Apagar `workoutHistory` e `dietLogs` de produção?

**Medido (esta é a mais consequente):** percorri **todos** os leitores das duas
coleções. Nenhum sobrevive ao novo formato.

| Coleção | Leitor | Local | Por que sai |
|---|---|---|---|
| `workoutHistory` | `RecomputeScore` | `service/score.go` L17 | gamificação (F1) |
| `workoutHistory` | `ComputeStreak` | `service/score.go` L86 | gamificação (F1) |
| `workoutHistory` | `GetPublicProfile` | `service/public.go` L29 | perfil público (F1) |
| `workoutHistory` | `HandleListHistory` | `handlers/nutrition.go` L846 | é **escrita** do participante → read-only (F5) |
| `workoutHistory` | pós-criação de dieta | `handlers/nutrition.go` L960, `diet.go` L189 | gamificação |
| `dietLogs` | `RecomputeScore` | `service/score.go` L35 | gamificação (F1) |
| `dietLogs` | `ComputeStreak` | `service/score.go` L96 | gamificação (F1) |
| `dietLogs` | `HandleListDietLogs` | `handlers/diet.go` L35 | é **escrita** do participante → read-only (F5) |
| `dietLogs` | `DietCheck.tsx` | componente 216L | check-in = escrita (F5) |

**Então: as duas coleções saem inteiras** — junto com 4 rotas, 2 handlers,
5 índices e 5 telas. Isso é conclusão de medição, não omissão.

**Mas a autorização foi só para `scores/` e `scores_history/`** (decisão 2). Estas
duas **não** estavam autorizadas. E são dados de produção de participantes reais
("quais treinos a pessoa fez", "o que comeu no dia").

**Pergunta 1:** autorizar apagar `workoutHistory/` e `dietLogs/` de produção?
**Pergunta 2:** apagar `posts/` e `plans/` também? (comunidade e planos também
saem, e o mesmo argumento de "a código morre junto com o dado" vale)

**Recomendação:** apagar o código sempre; para os **dados**, exportar antes
(script de export) e só então apagar. Custa uma hora e elimina o arrependimento
irreversível. O prompt já authorizei `scores/`, mas "já autorizei" não é
"não preciso_exportar".

---

## P7 — 403 ou 404 quando o recurso é de outro?

**Medido:** `handlers/nutrition.go` L385–L391 (`HandleGetWorkout`):

```go
if workout == nil { http.Error(w, "treino nao encontrado", http.StatusNotFound); return }
if !canAccessResource(r, workout.StudentID, workout.NutritionistID) {
    http.Error(w, "sem permissao", http.StatusForbidden); return }
```

Ou seja: **404 = não existe**, **403 = existe mas não é seu**. Isso permite a um
participante autenticado **descobrir quais IDs existem** no banco — resource
enumeration. Com a simplificação, os IDs de `workouts`/`diets`/`programs` ficam
mais prevíveis (o `studentId` é o próprio uid), então a enumeração fica ainda
mais fácil.

**Recomendação: 404 nos dois casos.** `if !podeAcessar { 404 }`. Mesmo status,
mesma mensagem genérica. O 403 continua sendo usado onde é informativo (ex.:
participante aprovado tentando `POST /api/workouts` → é um erro de papel, não
de recurso).

**Custo:** muda o status esperado de alguns testes existentes. `main_programs_test.go`
e `main_test.go` devem ser revistos caso esperem 403. **É uma mudança de
comportamento deliberada**, então preciso do aval.

---

## P8 — "Vincular ao participante" continua sendo por `assign` materializando cópias?

**Medido (comportamento atual, F19):** `programs/{id}` guarda **só**
`workoutId` + ordem. `POST /api/programs/{id}/assign` cria **cópias** dos
treinos em `workouts/{novoId}` com `studentId = aluno` e `nutritionistId` = dono.
`PUT /api/programs/{id}` recusa (409) trocar de aluno.

**Por que a pergunta:** com um único admin, dá para simplifying — o
`studentId` no programa poderia ser gravado direto, sem materializar cópia.
Isso economizaria escrita, documentos duplicados e o `DuplicateProgram` inteiro.

**Recomendação: MANTER como está.** Três razões: (1) o caminho já está
coberto por 17 testes em `program_test.go` e 28 em `main_programs_test.go`;
(2) copiar é o que permite a dois participantes terem o mesmo treino com nomes
ajustados; (3) "não crie abstração porque pode ser útil depois" também vale
para não *remover* a que existe e está testada. O prompt é para simplificar, não
para re-arquitetar o que já funciona.

**Se responder "simplifica para studentId direto":** é uma fase a mais (reFaz o
`assign`, o `DuplicateProgram`, a materialização e ~15 testes). Não recomendo.

---

## Resumo — o que preciso antes de executar

| # | Pergunta | Bloqueia | Se não responder, o plano assume |
|---|---|---|---|
| **P1** | modo original (sessions/prs/state) sai? | escopo da F6 | **REMOVER** |
| **P2** | modo demo sai? | escopo da F4/F5 | **REMOVER** (mas exige sua autorização para tocar `auth.tsx`) |
| P3 | `Avatar` fica sem `photoURL`? | F3 | campo sai, componente fica |
| P4 | `startDate`/`endDate` saem? | F3 | saem na F3 |
| P5 | `paused` vê treino/dieta? | F3 | vê, com teste |
| **P6** | apagar `workoutHistory`/`dietLogs`/`posts`/`plans` de produção? | F5/F6 | **código sai, dados exportados e depois apagados** |
| P7 | 403 → 404 para recurso alheio? | F7 | 404 nos dois casos |
| P8 | manter a materialização do `assign`? | F4 | manter |

**P1, P2 e P6 mudam o escopo** — as outras 5 o plano já assume um padrão
razoável e cada uma está isolada em uma fase, então dá para decidir durante a
execução sem retrabalho.

### Uma observação de sequência, não uma pergunta

`scores/` e `scores_history/` estão autorizados para apagar, mas recomendo
**não** apagar antes do gate verde da F1. Se a F1 quebrar alguma coisa e você
precisar do score para diagnosticar, o dado já foi. O `scripts/drop-scores.ts`
deve imprimir a contagem e pedir confirmação — e rodar **depois** do commit
verde da F1, não antes.
