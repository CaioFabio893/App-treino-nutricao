# Area: DIETAS e NUTRICAO

## Onde esta o codigo

**API (Go)**
- `backend/service/diet.go` — regra de negocio de dieta
- `backend/service/profile.go` — objetivo, peso, perfil que a dieta usa
- `backend/handlers/diet.go` — rotas de dieta
- `backend/handlers/nutrition.go` — rotas de nutricao/macros

**App (aluno)**
- `frontend/app/(aluno)/dietas/page.tsx`
- `frontend/components/student/StudentDietPage.tsx`
- `frontend/components/DietForm.tsx`
- `frontend/components/DietCheck.tsx`
- `frontend/components/EmptyDietState.tsx`

**App (admin / profissional)**
- `frontend/app/admin/diets/page.tsx` — gestao de dietas
- `frontend/app/admin/students/[studentId]/page.tsx` — ficha do aluno com a dieta

**Testes**
- `backend/service/service_test.go` — `TestNormalizeMeals` e `TestAggregateStatus`
- `backend/main_test.go` — cadeia de dieta: gate de feature, edicao, duplicacao e
  visibilidade de dieta nao atribuida
- `frontend/__tests__/DietForm.test.tsx`, `StudentDietPage.test.tsx`,
  `EmptyDietState.test.tsx`, `mealsToText.test.ts`
- `frontend/e2e/dieta-nova.spec.ts` — criar dieta pelo painel
- `firestore-tests/rules.test.js` — `dietLog` so para o dono ou admin

## Conceitos

- Dieta pertence a um aluno. Quem **cria** e o admin (`role` tem de ser `admin`
  em `backend/handlers/nutrition.go`); o aluno ve e edita a propria dieta
  (`canAccessResource`).
- `DietCheck` valida a dieta contra o perfil antes de salvar.

## Pendencias

<!-- escreva aqui -->
- [ ] nao existe `backend/service/diet_test.go`: a regra de negocio de dieta so e
      coberta pela cadeia em `backend/main_test.go`
- [ ] `frontend/components/DietCheck.tsx` nao tem teste proprio: em
      `frontend/__tests__/StudentDietPage.test.tsx` ele e mockado de proposito
- [ ] `backend/handlers/nutrition_test.go` tem nome de dieta mas nao cobre dieta:
      os 3 testes sao de preservacao de campo administrativo no update de usuario

## Cuidado

- Dieta referencia o aluno. Alterar peso/altura no perfil pode invalidar
  dieta ja montada. Ver `auth-perfil.md`.
