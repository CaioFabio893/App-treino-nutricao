# Area: PROGRAMAS

## Onde esta o codigo

**API (Go)**
- `backend/service/program.go` — regra de negocio
- `backend/service/cycle.go` — ciclos e semanas
- `backend/handlers/program.go` — rotas HTTP
- `backend/programmd/parser.go` — **importacao de programas** (parser de arquivo)
- `backend/cmd/programimport/main.go` — comando de importacao
- `backend/cmd/e2eseed/main.go` — popula o banco com dado de teste

**App (aluno)**
- `frontend/app/(aluno)/programas/page.tsx`
- `frontend/app/(aluno)/programas/[id]/page.tsx`
- `frontend/components/student/StudentProgramsPage.tsx`
- `frontend/components/programs/ProgramDetail.tsx`

**App (admin / profissional)**
- `frontend/app/admin/page.tsx` — painel de gestao
- `frontend/app/admin/programs/page.tsx` — lista e criacao de programas
- `frontend/app/admin/programs/[id]/page.tsx` — edicao e atribuicao
- `frontend/components/programs/ProgramForm.tsx`
- `frontend/components/programs/ProgramImport.tsx`
- `frontend/components/admin/PlansManager.tsx`

**Testes**
- `backend/service/program_test.go` — normalizacao, validacao, importacao,
  atribuicao (materializa as copias) e duplicacao
- `backend/main_programs_test.go` — cadeia de `/api/programs`, incluindo a posse do
  treino referenciado e o `studentId` imutavel no PUT
- `backend/programmd/parser_test.go` — parser do markdown (arquivo real e sintetico)
- `frontend/__tests__/ProgramDetail.test.tsx`
- `frontend/e2e/programas.spec.ts` — importa, duplica, atribui e o aluno le
- `firestore-tests/rules.test.js` — `programs` totalmente negada ao cliente

## Conceitos

- Programa (F19) e uma lista ORDENADA de REFERENCIAS a treinos que ja existem em
  `workouts/{id}` (`ProgramWorkout` = `workoutId` + `order` + rotulo). Nao ha
  semana nem subdivisao dentro do programa: quem tem ciclo/semana e o SCORE
  (`Cycle` em `backend/models/types.go`).
- `backend/programmd/parser.go` le um arquivo de programa. Se mudar o formato do
  arquivo, mexer aqui e nos testes do parser.

## Pendencias

<!-- escreva aqui -->
- [ ] `frontend/components/programs/ProgramForm.tsx` e `ProgramImport.tsx` nao tem
      teste de tela: so `ProgramDetail` tem cobertura
- [ ] nao existe `backend/handlers/program_test.go`: a rota so e exercitada pela
      cadeia em `backend/main_programs_test.go`

## Cuidado

- Importacao de programa e a parte mais delicada: um arquivo errado grava
  dado errado no banco de todo mundo. Sempre rodar os testes do parser.
- `cmd/e2eseed` mexe em dado real. Nao rodar em producao.
