# Guia: organizar trabalho de IA sem estourar cota

> Medido no projeto **Louise** (Go + Next.js + Firestore, ~270 arquivos).
> Todos os números aqui são reais, não estimados. Copie a estrutura, não os
> números — o seu projeto vai ter outro tamanho.

---

## 1. O problema: por que a IA trava

Medido no Louise:

| Coisa | Tamanho | Em tokens (~4 bytes/token) |
|---|---|---|
| Código útil (169 arquivos `.go`/`.ts`/`.tsx`) | 1.044.703 bytes | **~260.000** |
| `docs/progress.md` (status do projeto) | 43.796 bytes | **~11.000** |
| `CLAUDE.md` (instrução permanente) | ~7 KB | **~1.750** |
| Nota de uma área (`contexto/treinos.md`) | ~1 KB | **~250** |
| System prompt do OpenCode (fixo, não controlled) | — | **~11.900** |

Ou seja: **ler o projeto inteiro = 260k tokens por chamada.** Você tem 50
requisições/dia no OpenRouter free. Uma tarefa que varre o repo = 1 dia de cota
gasto em uma chamada, e o modelo ainda erra mais porque o contexto é irrelevante.

O oposto também é problema: contexto de 250 tokens é rápido mas faz a IA
chutar caminho de arquivo e alucinar.

**A meta é ficar na faixa de 2.000–6.000 tokens de entrada por chamada.**

---

## 2. Regra de ouro: índice + nota por área

O padrão que funciona (implementado em `CONTEXTO.md` + `contexto/`):

```
raiz/
├── CONTEXTO.md          ← índice: "tema → arquivo" (1 página, ~1k token)
├── contexto/            ← uma nota PEQUENA por área (~250 tokens cada)
│   ├── treinos.md
│   ├── dietas.md
│   ├── auth-perfil.md
│   └── infra.md
├── CLAUDE.md            ← regras permanentes (casa, não mapa)
└── docs/
    ├── progress.md      ← STATUS (11k tokens, NUNCA ler todo sempre)
    └── guides/          ← este arquivo
```

**Três arquivos, três funções diferentes. Confundir os três é o erro comum:**

| Arquivo | Pergunta que responde | Tamanho alvo | Quando a IA lê |
|---|---|---|---|
| `CONTEXTO.md` | "em qual nota eu leio?" | ~1 KB | **sempre**, 1º passo |
| `contexto/<area>.md` | "quais arquivos eu abro?" | ~1 KB | **toda tarefa** |
| `docs/progress.md` | "onde o projeto está?" | ilimitado | só quando perguntar |
| `CLAUDE.md` | "quais regras eu nunca quebro?" | < 5 KB | automático, sempre |

O erro clássico é colocar o `progress.md` (11k tokens) no `instructions: []` do
`opencode.json`. Aí **toda** chamada paga 11k tokens, inclusive as de 250 tokens
que eram só um grep. **Nunca coloque arquivo grande em `instructions`.**

### Anatomia de uma nota de área

Copie este formato. É o que mantém a nota útil e curta:

```markdown
# Area: TREINOS

## Onde esta o codigo

**API (Go)**
- `backend/service/exercise.go` — regra de negocio
- `backend/handlers/exercise.go` — rotas HTTP

**App (aluno)**
- `frontend/app/(aluno)/treinos/page.tsx`

**Testes**
- `backend/service/exercise_test.go`
- `frontend/__tests__/`, `frontend/e2e/`

## Conceitos
- `Session` guarda um dia de treino: semana, dia, exercicios, data.
- Progresso e calculado a partir das sessoes registradas.

## Pendencias
<!-- o agente que mexeu aqui atualiza esta lista -->
- [ ]

## Cuidado
- Mexer no parser? Rodar os testes do parser sempre.
```

O campo **Pendencias** faz o dobro do trabalho: vira fila de tarefas *e* impede
que a nota envelheça. Se a nota mente, a IA volta a varrer o código — e a nota
mente no dia em que alguém esquece de atualizar.

### Regras de granularidade

- **Uma nota por área de domínio**, não por camada. `treinos.md`, não
  `handlers.md` + `service.md` — porque a tarefa "arruma o formulário de treino"
  atravessa as três camadas.
- **Alvo: 5–15 caminhos por nota.** Mais que isso = divida. Menos = a nota não
  serve.
- **Alvo: 800–1.500 bytes.** Acima de 2 KB, corte backstory e deixe só caminhos +
  conceitos + cuidado.
- **Toda nota aponta para `progress.md`, nunca o copia.** Status é um arquivo só.

---

## 3. Mapa de agentes: quem faz o quê

Configuração real do Louise (`opencode.json` + `.opencode/agent-routing.md`).
O ponto não é o modelo específico — é o **critério de roteamento**.

| Agente | Modelo | Custo | Dispara quando | Nunca usar para |
|---|---|---|---|---|
| `explore` | mimo-flash-free | grátis | "onde está X?", "quantos Y?" | editar nada |
| `fast` | nemotron-lightning | grátis | grep, renomear, refactor mecânico, 1 arquivo | arquitetura, decisão |
| `docs` | qwen2.5-coder:1.5b | grátis | README, relatório, SDD | **números que não mediu** |
| `code_free` | north-mini-code | grátis | 1 arquivo, sem arquitetura | fluxo de segurança |
| `code` | deepseek-v4-pro | **pago** | endpoint, migration, TDD, multi-arquivo | — |
| `review` | glm-5.2 | **pago** | segurança, auth, ownership, Firestore Rules | editar |
| `agentic` | kimi-k3 | **pago** | E2E, fluxo de 5+ etapas encadeadas | tarefa de 1 passo |

### O critério, não a lista

Três perguntas antes de delegar:

1. **Maior risco técnico é o quê?**
   - Mexer em código/testes → `code`
   - Auditoria/segurança → `review`
   - Várias etapas que dependem do resultado anterior → `agentic`
   - 1 arquivo mecânico → `fast` / `code_free`
2. **Um modelo gratuito já errou 2 vezes?** Promova pro pago. Não insista em
   free errando — custa mais tempo que a cota.
3. **O resultado vai precisar de conferência humana?** Se sim, o agente tem que
   ser forte. Modelo pequeno produz texto plausível e errado, e corrigir
   plausível-e-errado é mais caro que fazer.

### Regra de ouro dos agentes gratuitos

> **Modelo pequeno pode escrever PROSA. Modelo pequeno não pode ser a fonte da
> VERDADE.**

Medido nesta entrega: o agente `docs` (qwen 1.5b) documentou bem e no mesmo
arquivo (a) regrediu 3 trechos de texto que não deviam ser tocados e (b)
**declarou "200 testes Go" quando eram 208**. Texto eu conserto em 1 minuto.
Número errado em documentação é bug que ninguém nota por 6 meses.

→ **Sempre rode o comando que mede, e nunca peça o número ao modelo.**

```
go test ./... -count=1 -v | grep -c "^--- PASS"    # não: "quantos testes existem?"
```

---

## 4. O cartão de tarefa (o que colar no prompt de delegação)

Delegação que funciona tem 6 blocos. Sem eles o subagente inventa caminho de
arquivo e volta asking.

```markdown
## Contexto
[2-3 linhas: o que o sistema faz e por que essa tarefa existe]

## Arquivos do escopo
[LISTA EXATA de caminhos. NUNCA "o projeto inteiro"]

## O que procurar
[perguntas NUMERADAS e específicas]

## Fora de escopo
[o que não deve mexer — evita refatoração criativa]

## Como verificar
[comando exato de teste + o que deve aparecer]

## Saída esperada
[formato: "máx N linhas", "responda X e Y"]
```

**O bloco que mais rende é "o que procurar" com perguntas numeradas.** Medido
nesta entrega:

- Pedido vago → *"revise a feature"* → o agente lê 40 arquivos, devolve 3
  observações genéricas, 0 achado real.
- Pedido numerado → *"1. GET /programs filtra por aluno? 2. PUT aceita
  ownership no body? 3. assign chega a copiar treino de outro?"* → **2 bugs
  reais de segurança encontrados** (exfiltração entre nutricionistas +
  `studentId` mutável), que nenhum teste funcional pegaria.

O mesmo vale para `code`: "implemente X" vs "faça Y, siga o padrão de Z que está
no arquivo W, e o teste é assim".

---

## 5. Controle de tokens: entrada e saída

### Entrada (o que você não controla)

| Fonte | Custo | Como reduzir |
|---|---|---|
| System prompt | ~11.900 tokens, fixo | sair do OpenCode (Aider) para tarefa de volume |
| `instructions: []` | soma tudo sempre | só arquivos < 2 KB |
| `CLAUDE.md` | ~1.750 | manter < 5 KB, é a casa das regras |
| Contexto da tarefa | 2.000–6.000 é o alvo | índice + nota de área |
| Histórico do chat | **cresce sem parar** | sessão nova por tarefa |

**O histórico é o vazamento silencioso.** Depois de 40 turnos, todo `read` que
você fez há uma hora continua no prompt. Regra: **sessão nova por tarefa.** Não
é 보수ador, é economia: uma sessão de 3 turnos lê 8 arquivos; a mesma tarefa numa
sessão de 40 turnos lê os mesmos 8 mais 30 arquivos de outra tarefa.

### Saída (o que você controla)

| Ação | Tokens | Regra |
|---|---|---|
| Editar arquivo | **0** (diff, não o arquivo) | sempre |
| Ler arquivo pequeno | 250–1.000 | leia só o trecho (`offset`/`limit`) |
| Ler arquivo grande | 3.000+ | `grep` primeiro, leia a linha |
| **`go test` / `npm test` verbose** | **5.000–15.000** | filtre! |
| `npm run build` | 3.000–8.000 | `-q`, `2>&1 \| tail` |
| `git diff` sem filtro | 10.000+ | `--stat`, ou um arquivo |

O piorRated offender nesta sessão foi o **contador de testes**: rodei a suíte
**3 vezes** só para descobrir a contagem exata (era 208, docs diziam 200).
Cada verbose run = ~12k tokens. O certo:

```
go test ./... -count=1 -v 2>&1 | grep -c "^--- PASS"
```

Um comando, um número. **Meça uma vez.**

No PowerShell (Windows), o filtro que funciona:

```powershell
npm test 2>&1 | Select-String -Pattern "Tests\s+\d+ passed" | ForEach-Object {
  $_.Line -replace '\x1b\[[0-9;]*m',''      # tira cor ANSI
}
```

### Regras práticas

1. **Nunca peça o número.** Meça.
2. **Filtre toda saída de comando** com `Select-String`/`grep`. Saída crua de
   build é das maiores fontes de desperdício.
3. **Chunk grande lido com `limit`.** Ler 500 linhas para achar uma função é
   desperdício puro.
4. **Subagente que vai colar 5 arquivos no relatório = desperdício.** Peça
   "caminhos e números, máx 20 linhas".
5. **Comandos independentes no mesmo bloco.** Rodar `go test` e `npm test` em
   paralelo economiza latência, não tokens — mas latência também custa a sua
   noite.

---

## 6. Padrão de trabalho em fases

O fluxo que deu certo na F19 (8 etapas, ~6h, cota não estourou):

```
1. ESCOLHER A ÁREA        → ler CONTEXTO.md + contexto/<area>.md     (~500 tok)
2. PLANEJAR                → Task list, sem editar nada              (~1k tok)
3. TDD: escrever o teste   → 1 chamada, falha de propósito
4. Implementar             → quem implementa, implementa
5. Rodar o gate            → 1 comando filtrado por área, NÃO a suíte toda
6. Delegar docs            → 1 chamada, só arquivos pequenos
7. Auditar                 → review com perguntas numeradas
8. Commit + docs da nota   → atualizar Pendencias da área
```

**Passo 5 é onde as pessoas gastam cota à toa.** Rodar a suíte completa a cada
alteração custa 5–10x o necessário:

```bash
# durante a tarefa (barato, prova o que você mexeu)
go test ./service -run CreateProgramFromImport
npm test -- programs-api

# no checkpoint (uma vez, antes do commit)
go test ./... -count=1 | tail -3
npm test 2>&1 | grep "Tests"
```

**E2E é o mais caro de tudo** (sobe emulador + backend + seed, ~2,7 min e
dezenas de milhares de tokens de log). Nesta entrega rodei 3 vezes porque um
teste novo falhou duas vezes. Aprendizado: **escreva o E2E por último** e
confirme a expectativa com o dado real antes de rodar.

---

## 7. Armadilhas medidas

| Armadilha | O que aconteceu | Regra |
|---|---|---|
| Delegação aborta | `task` falhou 3x seguidas, perdi tempo esperando | após 2 aborts, **faça você mesmo** |
| Subagente não sabe quem é | perguntou "seu papel?", respondeu "sou o build agent" | não pergunte identidade a subagente |
| Contagem errada na doc | agente disse 200, era 208 | meça com comando |
| Tool call espelhado | "35 migrations" no texto do agente = 1 chamada real, as outras viram `str_replace` | confira `git status` antes do commit |
| Contexto envelhece | nota com lista de arquivos de 3 fases atrás | passo 8 do fluxo, sempre |
| Push acidental | `opencode.json` e `.opencode/` no commit | `git add` por caminho, nunca `git add -A` |

---

## 8. Checklist para começar o projeto novo

**Arquivos para criar no primeiro dia** (~30 min, economiza centenas de
requisições depois):

- [ ] `CLAUDE.md` — regras permanentes, < 5 KB, com as "pegadinhas herdadas"
- [ ] `CONTEXTO.md` — índice tema → nota
- [ ] `contexto/` — 1 nota por área de domínio, 800–1.500 bytes cada
- [ ] `.opencode/agent-routing.md` — quem faz o quê
- [ ] `opencode.json` — agentes + `steps` por agente
- [ ] `docs/progress.md` — status, cresce, **nunca** vai em `instructions`
- [ ] `.gitignore` — `test-results/`, `.next/`, `node_modules/`, `.env.local`

**Depois de cada tarefa:**

- [ ] Atualizar `Pendencias` na nota da área
- [ ] `git add` por caminho (nunca `-A`)
- [ ] Rodar o gate da área, não a suíte toda

---

## 9. Melhorias de performance que valem implementar

### Já funcionam, use no projeto novo

1. **`steps` por agente** no `opencode.json` (o `fast` com 8 passos não pode
   entrar em loop). É o teto mais barato contra desperdício.
2. **Plugin de fallback automático** (`.opencode/model-fallback.json`): quando
   o pago cai, desce a cadeia sozinho em vez de você reprocessar.
3. **Plano pago só onde o dinheiro se paga.** Free para grep/docs/explore;
   pago para implementação e auditoria. Nesta entrega: 3 delegações gratuitas,
   1 paga (`code`) que achou 2 bugs de segurança. Custo total do dia: uma
   fração da cota.
4. **Sessão nova por tarefa** — o corte mais gratuito que existe.

### Melhorias novas que valem testar

5. **Cache de "estado do gate".** Grave num arquivo `.gates` a última saída
   verificada de cada suíte:
   ```
   go=208 ok 2026-09-28T03:00  vitest=131 ok  rules=76 ok  e2e=30 ok
   ```
   A IA lê **30 tokens** em vez de rodar a suíte para responder "o que está
   verde?". Reduz a chance dela "validar" com `git status`.

6. **Divida arquivos que passam de ~400 linhas.** Hoje no Louise:
   `programmd/parser.go` = 503, `api.ts` = +364 linhas, `program.go` = 382.
   Acima de 400 linhas o subagente lê o arquivo inteiro "por segurança" e o
   custo dobra. Um arquivo por responsabilidade = leitura dirigida.

7. **Cartão de tarefa versionado no repo.** Salve os cartões que deram certo em
   `.opencode/prompts/`. Você reusa em vez de redigir — e o prompt é a parte
   que mais influencia qualidade.

8. **Peça diff, não código, no relatório do subagente.** "Liste os arquivos
   alterados e o comportamento novo" custa ~300 tokens; "cole o código novo"
   custa 5.000 e você não usa.

9. **`explore` antes de `code`.** Uma chamada gratuita de 1.000 tokens que
   responde "onde fica X" evita que o agente pago gaste 15.000 Tokens
   procurando.

10. **Teste de fumaça no subagente.** Dê ao subagente um comando de verificação
    e peça para ele rodar. Se o subagente não tem como verificar, ele entrega
    código plausível e não testado — o mais caro de corrigir depois.

11. **Regra de "não invente número" no prompt do `docs`.** Uma linha:
    *"Se precisar de um número que não mediu, escreva `TBD`."* — eliminou
    exatamente a classe de bug que a contagem errada representa.

---

## 10. O resumo em 7 linhas

1. Índice + nota por área. 2.500 tokens por tarefa, não 260.000.
2. `progress.md` é status — nunca vai no `instructions`.
3. Roteie por **risco**, não por tamanho da tarefa.
4. Free escreve prosa; free não é fonte de número.
5. Delegue com lista de arquivos + perguntas numeradas.
6. Filtre toda saída de comando e meça uma vez só.
7. Sessão nova por tarefa; `git add` por caminho.

O resto é detalhe — e o detalhe está nos arquivos acima.
