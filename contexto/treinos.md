# Area: TREINOS e EXERCICIOS

## Onde esta o codigo

**API (Go)**
- `backend/service/exercise.go` — regra de negocio
- `backend/handlers/exercise.go` — rotas HTTP
- `backend/models/types.go` — tipos, incluindo `Exercise` e `Session`

**App (aluno)**
- `frontend/app/(aluno)/treinos/page.tsx`
- `frontend/components/student/StudentWorkoutsPage.tsx`

**App (admin / profissional)**
- `frontend/app/admin/workouts/page.tsx` — gestao de treinos
- `frontend/app/admin/exercises/page.tsx` — lista de exercicios
- `frontend/app/admin/print/page.tsx` — impressao de treino, dieta e ficha do aluno
- `frontend/components/WorkoutForm.tsx` — form de treino (usado pela tela do aluno)

**Testes**
- `backend/service/exercise_test.go` — validacao e normalizacao do exercicio da biblioteca
- `backend/main_test.go` — cadeia de treino/exercicio: aluno nao edita treino e o
  exercicio da biblioteca e gravado como snapshot, nunca como referencia viva
- `frontend/__tests__/WorkoutForm.test.tsx`, `ExercisesPage.test.tsx`,
  `exerciseToWorkoutExercise.test.ts`
- `frontend/e2e/exercicios.spec.ts` e `frontend/e2e/aluno.spec.ts`
- `firestore-tests/rules.test.js` — catalogo global: aluno le, so a API Go escreve

## Conceitos

- `Session` (em `backend/models/types.go`) guarda um dia de treino de uma semana:
  semana, dia, lista de exercicios e data de atualizacao.
- Progresso de exercicio e calculado a partir das sessoes registradas.

## Pendencias

<!-- escreva aqui, do seu jeito. a IA le isso em vez de ler o codigo -->
- [ ] `Session` (execucao que o aluno grava) nao tem teste dedicado: hoje so aparece
      em `TestAggregateStatus` e `TestWorkoutDayMatchesLocalDayAtNight`
      (`backend/service/service_test.go`)
- [ ] sem teste de tela para `frontend/components/student/StudentWorkoutsPage.tsx`

## Cuidado

- Exercicio deletado com sessao ja registrada quebra o historico. Verificar
  antes de remover.
- Mudanca aqui mexe no ranking (ver `scores-ranking.md`).
