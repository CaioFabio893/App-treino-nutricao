# Fase 5 — Biblioteca de Exercícios

**Data:** 23 set 2026
**Status:** CONCLUÍDA — gates verdes (backend 147 · rules 64/64 · Vitest 61/61 ·
Playwright 23/23 · tsc · lint 0/0 · build).

## Objetivo

Implementar uma biblioteca **compartilhada/global** de exercícios para que
nutricionista/admin possam cadastrar, listar, buscar, editar, duplicar e excluir
exercícios, e **reutilizá-los na montagem de treinos** — sem que a biblioteca
vire uma referência viva: o treino continua armazenando uma **cópia embutida
(snapshot)** via `WorkoutExercise`.

## Decisões

1. **Catálogo global** (sem `ownerId`): exercícios são compartilhados entre
   nutricionistas. Isolamento por nutricionista NÃO é requisito.
2. **Snapshot, não referência**: selecionar um exercício copia `name`,
   `description` e `videoUrl` para um `WorkoutExercise` (os campos específicos
   de treino — séries/repetições/carga/descanso — ganham os defaults do
   formulário manual). Alterar/excluir o exercício da biblioteca **não afeta**
   treinos existentes.
3. **Autorização**: leitura para usuário aprovado; escrita (create/update/
   delete) somente nutricionista/admin. Escrita de negócio **somente via API Go**
   (regras Firestore negam SDK cliente).
4. **Listagem** ordenada por `name` (índice automático de campo único — nenhum
   índice composto novo).

## Modelo (`models.ExerciseItem`, coleção `exercises/{id}`)

| Campo | Tipo | Limite/validação |
|---|---|---|
| `id` | string | auto (omitempty) |
| `name` | string | obrigatório; ≤ 120 runas |
| `description` | string | ≤ 2000 runas |
| `muscleGroup` | string | ≤ 80 runas |
| `equipment` | string | ≤ 80 runas |
| `videoUrl` | string | ≤ 500 runas; se presente, URL absoluta http/https |
| `createdAt` / `updatedAt` | time | ServerTimestamp (criação); update preserva `createdAt` |

> O tipo é `ExerciseItem` porque `Exercise` já existia no `models` (modo original
> de sessões) — preservado por compatibilidade.

## Arquitetura / camadas

- **models** `backend/models/types.go`: `ExerciseItem` + campos.
- **repository** `backend/repository/repository.go`: `CreateExercise`,
  `GetExercise`, `ListExercises` (orderBy name), `UpdateExercise` (MergeAll sem
  `createdAt`), `DeleteExercise` na interface `Repository` + implementação
  Firestore.
- **service** `backend/service/exercise.go`: `NormalizeExercise` (trim) +
  `ValidateExercise` (limites por campo + URL) + erros sentinela.
- **handlers** `backend/handlers/exercise.go`: CRUD HTTP (decode → normalize →
  validate → repo).
- **routes** `backend/main.go`: rotas `/api/exercises`.
- **rules** `firestore.rules`: `exercises/{exerciseId}` — `allow read: if
  isApprovedUser(); allow write: if false`.
- **frontend**: `lib/types.ts` (tipo `Exercise`), `lib/exercise.ts`
  (`exerciseToWorkoutExercise` — conversão para snapshot), `lib/api.ts`
  (list/get/create/update/delete), página `app/nutritionist/exercises/`,
  item "Exercícios" na `Sidebar`, seletor "Buscar na biblioteca" no
  `WorkoutForm`.

## Endpoints

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/exercises` | RequireApproved (aluno consulta) |
| GET | `/api/exercises/{id}` | RequireApproved |
| POST | `/api/exercises` | nutricionista/admin |
| PUT | `/api/exercises/{id}` | nutricionista/admin |
| DELETE | `/api/exercises/{id}` | nutricionista/admin |

## Testes

### Backend (Go) — +27 (120 → 147)
- `service/exercise_test.go` (11): validação (nome vazio/longo, descrição/
  grupo/equipamento/URL longos, URL inválida, URL sem scheme, válida, URL
  vazia) + trim da normalização.
- `main_test.go` (16): create (admin/nutri), aluno não cria/atualiza/exclui,
  aluno aprovado lista, pendente não lê, sem token 401, nome vazio 400, nome
  longo 400, URL inválida 400, get/update 404, admin atualiza/exclui, e o
  **snapshot** (treino carrega cópia embutida, sem referência viva).

### Firestore rules — +11 (53 → 64)
`firestore-tests/rules.test.js` seção 10: aprovado/nutri/admin leem; pendente/
inativo não leem; aluno/nutri/admin não escrevem (só API Go); não autenticado
não lê.

### Frontend (Vitest) — +11 (50 → 61)
- `exerciseToWorkoutExercise.test.ts` (4): cópia de campos, snapshot não muda
  após alterar biblioteca, sem referência viva, exclusão não quebra treino
  (**teste obrigatório de snapshot**).
- `ExercisesPage.test.tsx` (5): listagem, busca, criação, edição, exclusão.
- `WorkoutForm.test.tsx` (2): entrada manual preservada + seleção da biblioteca
  copia como snapshot.

### E2E (Playwright) — +1 (22 → 23)
`e2e/exercicios.spec.ts`: nutricionista cria exercício → busca → usa num treino
→ salva → renomeia na biblioteca → verifica que o treino mantém o snapshot
original.

## Gates

| Gate | Resultado |
|---|---|
| `go test ./...` | ✅ 147 testes |
| `go vet ./...` | ✅ limpo |
| Firestore rules (Emulador) | ✅ 64/64 |
| Vitest | ✅ 61/61 |
| Playwright E2E | ✅ 23/23 |
| `tsc --noEmit` | ✅ |
| `next build` | ✅ (rota `/nutritionist/exercises` gerada) |
| Lint frontend | ✅ 0/0 |

## Limitações

- **Sem endpoint de duplicação** no backend: "duplicar" é feito no frontend
  (pré-preenche o formulário com `nome (cópia)`), coerente com o fluxo atual.
- **Busca é client-side** (como treinos/dietas): `ListExercises` devolve tudo
  ordenado por nome; o filtro por nome/grupo/equipamento roda no navegador.
  Para catálogos muito grandes, uma busca server-side/paginada seria um
  aprimoramento futuro.
- `muscleGroup`/`equipment` são texto livre (sem enum fechado) — coerente com a
  simplicidade do produto atual; um vocabulário controlado é candidato futuro.

## Riscos residuais

- **Nenhum** de segurança: escrita fechada (rules + API), leitura aprovada,
  validação por campo e URL. Snapshot isolado da biblioteca por construção.

## Próximos passos

- F8 (alimentos) continua **bloqueada** por decisão de produto (formato da
  dieta: texto livre vs estruturado).
- F15.1 (checklist pré-deploy) pode ser feita posteriormente.
- F15.2 (deploy) **não** iniciar automaticamente.
