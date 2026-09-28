# Fase 19 — Programa de Treino

**Data:** 26 set 2026
**Status:** CONCLUÍDA — gates verdes (backend `go vet`/`go test` **208/208** ·
Firestore rules **76/76** · Vitest **131/131** · Playwright E2E **30/30** ·
`tsc --noEmit` ✅ · `eslint` **0/0** · `next build` ✅).

## Objetivo

Permitir que a nutricionista **monte um programa de treino como coleção de
treinos** (e não como treino solto), e — o ponto central da fase — que ela
**importe automaticamente o programa escrito em markdown**
(`treino.md`), sem digitar exercício por exercício.

## Decisões

1. **Programa não é entidade de treino.** Um item do programa é um
   `WorkoutDefine` **já existente** em `workouts/{id}`; o programa guarda só uma
   lista **ordenada de referências** (`ProgramWorkout`). Consequências:
   - uma única implementação de treino — histórico, execução, impressão e a UI
     do aluno continuam apontando para `workouts/{id}`;
   - reordenar/duplicar programa não exige tocar nos treinos;
   - atribuir a um aluno **materializa cópias** (o modelo original fica na
     biblioteca), então evoluir o aluno não altera a base.
2. **Parser no servidor.** O parse do markdown é Go (`backend/programmd`), não
   TypeScript: a importação pela tela e pelo CLI produzem exatamente o mesmo
   resultado, e existe um único lugar com as regras de preservação.
3. **Free tier.** Programas não dependem de feature de plano (o aluno vê o
   agrupamento; a execução continua em `/treinos`).
4. **Atribuição é destrutiva para o vínculo, não para o conteúdo.** Reatribuir a
   outro aluno é recusado com **409** — trocar de aluno é duplicar o programa,
   não sequestrar o trabalho já entregue ao primeiro.
5. **Apagar programa não apaga treinos.** Os treinos podem estar compartilhados
   com outros programas ou já atribuídos a alunos.

## Regras de preservação (nada é inventado)

| Trecho da fonte | Destino |
|---|---|
| `# Programa de Treino — Louise Lima (Ciclo 2)` | `TrainingProgram.Name` |
| `**Foco: …**` | `TrainingProgram.Objective` |
| `## TREINO X — Nome` | `WorkoutDefine.Name` + `ProgramWorkout.Label` |
| tabela `\| # \| Exercício \| Séries \| Reps \| Observação \|` | `WorkoutExercise[]` renumerado na ordem da fonte |
| tabela "Estrutura semanal" | `ProgramWorkout.DayOfWeek` (A–E → `monday`–`friday`) |
| bloco de cardio (B e D) | `WorkoutDefine.Description`, **verbatim** — não vira exercício fictício |
| PRs / Periodização | `TrainingProgram.Notes`, **verbatim** |
| carga e descanso | **vazios** — não existem na fonte; a nutricionista preenche depois |

Divergências entre o título do treino e o foco da tabela semanal (A, C, D, E)
são preservadas como `Warnings` no log, sem sobrescrever o original.

Validação do material real: **1 programa, 5 treinos (A–E), 30 exercícios**
(A=5, B=5, C=7, D=6, E=7).

## Modelo (`models.TrainingProgram`, coleção `programs/{id}`)

| Campo | Tipo | Nota |
|---|---|---|
| `id` | string | auto |
| `studentId` | string | **vazio = programa de biblioteca**; definido = atribuído |
| `nutritionistId` | string | ownership imutável (o body nunca transfere) |
| `name` | string | obrigatório, ≤ `MaxNameLength` |
| `description` | string | H1 original preservado |
| `objective` | string | linha de foco |
| `workouts` | `[]ProgramWorkout` | ≤ `MaxProgramWorkouts`; normalizado (dedup + `order` 1..N) |
| `notes` | string | ≤ `MaxNotesLength`; PRs/periodização/estrutura semanal verbatim |
| `source` | string | proveniência (ex.: `treino.md`) |
| `createdAt`/`updatedAt` | time | criação/update; `createdAt` nunca sobrescrito |

`ProgramWorkout{workoutId, order, label, name, dayOfWeek}` — `label`/`name`/
`dayOfWeek` são **snapshot** do vínculo, para a listagem continuar legível se o
treino for renomeado depois.

## API

| Método | Rota | Quem pode |
|---|---|---|
| GET | `/api/programs` | aprovado; nutricionista vê os próprios, aluno só os atribuídos |
| POST | `/api/programs` | nutricionista/admin aprovado |
| POST | `/api/programs/import` | nutricionista/admin aprovado |
| GET | `/api/programs/{id}` | dono (aluno), nutricionista dono ou admin |
| PUT | `/api/programs/{id}` | nutricionista dono/admin (ownership imutável) |
| DELETE | `/api/programs/{id}` | nutricionista dono/admin (não apaga treinos) |
| POST | `/api/programs/{id}/assign` | nutricionista dono/admin (409 se já atribuído) |
| POST | `/api/programs/{id}/duplicate` | nutricionista dono/admin (nova biblioteca) |

Erros: **400** validação/parse · **401** sessão · **403** papel/sem permissão ou
treino de outra nutricionista · **404** inexistente · **409** já atribuído a outro
aluno.

## CLI

```
go run ./cmd/programimport -file treino.md -nutritionist <uid> [-student <uid>] \
  [-name "…"] [-source "…"] -dry-run
```

`-dry-run` faz o parse e imprime o plano (programa, treinos, exercícios,
avisos) **sem gravar**. Em produção exige flag explícita de confirmação.

## Frontend

- `lib/types.ts`: `TrainingProgram`, `ProgramWorkout`, `ImportProgramRequest`,
  `AssignProgramRequest`.
- `lib/api.ts`: `listPrograms`, `getProgram`, `createProgram`, `updateProgram`,
  `deleteProgram`, `assignProgram`, `duplicateProgram`, `importProgram` — todas
  com branch de **modo demo** (localStorage). O demo traz um parser markdown
  mínimo, marcado como mock: o parsing real é do backend.
- `lib/programDays.ts`: rótulos de dia PT-BR + total de exercícios.
- `components/programs/`: `ProgramDetail` (compartilhado, `readOnly` no aluno),
  `ProgramForm` (metadados + ordem das referências), `ProgramImport`.
- `components/student/StudentProgramsPage.tsx` (aluno, somente leitura).
- Rotas: `/nutritionist/programs`, `/nutritionist/programs/[id]`, `/programas`,
  `/programas/[id]`.
- Navegação: "Programas" na sidebar da nutricionista; "Programa" na bottom nav
  do aluno. Ícone `ProgramIcon` (AppIcons + fallback no DashIcon).

## Firestore

- `programs/{id}` — acesso cliente **totalmente negado** (`allow read, write: if
  false`); todo acesso passa pela API Go.
- Índices compostos: `nutritionistId ASC + createdAt DESC` e
  `studentId ASC + createdAt DESC`.

## Bugs encontrados e corrigidos na fase

1. **`CreateProgramFromImport` criava treinos órfãos** — sem `NutritionistID`/
   `StudentID`, a nutricionista recebia **403** ao abrir o programa que acabara
   de importar. Corrigido no service (ownership dos treinos no import) com
   teste de regressão confirmado RED sem o fix e GREEN com ele.
2. **Parser do modo demo lia a coluna `#` como nome do exercício** (virava
   `name: "1"`). Corrigido com `cells.slice(1)`.
3. **`importProgram` (demo) lançava erro síncrono**, escapando do tratamento de
   erro da UI. Agora retorna Promise rejeitada.
4. **Divergência de contagem no E2E**: somatório de séries do teste estava errado
   (8 em vez de 12) — corrigido o teste, não o código.
5. **Programa referenciando treino de OUTRA nutricionista (exfiltração)** —
   auditado depois da entrega. O programa guarda só *referências* a
   `workouts/{id}`, e nem o `POST /api/programs`, nem o `PUT`, nem o `assign`
   conferiam a posse dos treinos referenciados. A nutricionista A conseguia
   montar um programa apontando para o treino da B e o `assign` materializava
   uma **cópia** do conteúdo alheio (exercícios, nomes, `videoUrl`) para o aluno
   dela. `HandleDuplicateWorkout` já fazia essa checagem (`canAccessResource`);
   o caminho de programa não. Corrigido com
   `Service.ValidateProgramWorkoutOwnership` (create/update) e a checagem
   `src.NutritionistID != p.NutritionistID` no `AssignProgram` e no
   `DuplicateProgram`. 6 testes de regressão (RED confirmado antes do fix).
6. **`studentId` mutável via `PUT /api/programs/{id}`** — o handler só
   preenchia o aluno do registro quando o body vinha vazio, então um
   `studentId` não vazio no body **reatribuía o programa** e burrava o 409 do
   `assign`. Pior: os treinos já materializados continuariam do aluno anterior,
   então o novo cairia em 403 nos treinos e o antigo perderia o programa. Agora
   `program.StudentID = existing.StudentID` é **incondicional** — reatribuição só
   existe via `POST /assign`, que materializa as cópias.

## Testes

- Go **208/208** — `main_programs_test.go` (28 chain de integração: escopo por
  papel, 403 em aluno, 409 na reatribuição, ownership, treino alheio no
  create/update/assign, `studentId` imutável, delete sem destruir treinos),
  `service/program_test.go` (24: normalize, validate, convert do arquivo real,
  assign idempotente, duplicate), `programmd` (parser), `repository`
  (`programsFromIter` → `[]`).
- Vitest **131/131** — `programs-api.test.ts` (23) e `ProgramDetail.test.tsx`
  (10) novos.
- Rules **76/76** — 12 novos para `programs` (leitura, escrita, subpath, não
  autenticado).
- Playwright **30/30** — `e2e/programas.spec.ts`: importa markdown → confere
  treinos/exercícios/cardio/notas → duplica → atribui a aluno → o aluno
  visualiza em modo leitura (sem botões de escrita).

## Pendências (não bloqueiam)

- Preencher **carga e descanso** dos 30 exercícios (não existem na fonte).
- Resolver a divergência A/C/D/E entre título do treino e foco da tabela
  semanal — hoje preservada como aviso, decisão de produto pendente.
- `ProgramForm` não edita exercícios (por desenho: o programa só referencia
  treinos; para mudar exercício, edita-se o treino).
