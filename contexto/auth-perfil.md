# Area: AUTH, PERFIL e PERMISSAO

## Onde esta o codigo

**API (Go)**
- `backend/middleware/auth.go` — **validacao de token em toda rota**
- `backend/service/access.go` — quem pode ver/acessar o que (papel/role)
- `backend/service/profile.go` — dados do perfil
- `backend/models/types.go` — tipos de usuario

**App (autenticacao)**
- `frontend/app/login/page.tsx`
- `frontend/app/cadastro/page.tsx`
- `frontend/app/recuperar-senha/page.tsx`
- `frontend/components/PasswordInput.tsx`
- `frontend/components/ConfirmModal.tsx`

**App (perfil)**
- `frontend/app/profile/[id]/page.tsx`
- `frontend/app/admin/profile/page.tsx`
- `frontend/components/Avatar.tsx`
- `frontend/components/AdminAreaSwitch.tsx` — alterna Aluno / Gestao / Cadastro
  (so aparece para `role=admin`)

**Lib (frontend)**
- `frontend/lib/` — cliente do Firebase

**Testes**
- `firestore-tests/rules.test.js` — **regras de permissao do Firestore**
  (e arquivo `.js`, nao `.ts`; helpers/setup estao dentro do mesmo pacote)
- `backend/middleware/auth_test.go` — `RequireApproved`, `RequireFeature`, papel e status
- `backend/main_test.go` — cadeia de autorizacao: rota nunca publica, aluno barrado em
  `/admin` e `PUT /api/me` preso na allowlist
- `frontend/__tests__/login-page.test.tsx`, `signup-page.test.tsx`,
  `recover-page.test.tsx`, `password-input.test.tsx`, `auth-errors.test.ts`
- `frontend/e2e/auth.spec.ts` e `frontend/e2e/autorizacao.spec.ts` — login no Auth
  Emulator (inclui o teste de que a tela de login NAO mostra Google) e bloqueio por
  papel e por feature

## Papeis (roles)

Sao **dois**, definidos em `backend/models/types.go`:
`RoleAdmin = "admin"` e `RoleStudent = "student"`. Nao existe `RoleNutritionist`,
nem o campo `NutritionistID`.

| Papel | Quem e | Onde entra | O que faz |
|---|---|---|---|
| `admin` | o profissional | `app/admin/` | gestao: alunos, treinos, dietas, programas, planos, aprovacao, feed, ranking, timeline |
| `student` | o aluno | `app/(aluno)/` + `app/login` | o proprio treino, dieta, programa, ranking e comunidade |

Quem monta a dieta, o treino e o programa de um aluno e o `admin`. O `student`
so edita o que e dele. A unica regra de acesso esta em
`backend/service/access.go`: `admin` acessa tudo; `student` so o proprio
`studentID`.

## Conceitos

- `backend/middleware/auth.go` protege a API. Rota nova sem middleware = rota aberta.
- `backend/service/access.go` decide se o aluno pode ver o programa de outro.
- As regras do Firestore sao a **segunda** linha de defesa. Se a API tem um
  erro, a regra do banco ainda bloqueia.

## Pendencias

<!-- escreva aqui -->
- [ ] `frontend/components/Avatar.tsx` nao tem teste de tela
- [ ] sobra do papel antigo no codigo (nao mexer sem pedido): comentario em
      `backend/models/types.go:236` e o mock `role: "nutritionist"` em
      `frontend/__tests__/ProgramDetail.test.tsx`. O CSS ainda tem `.nut-card`
      em `frontend/app/base.css`, `dashboard.css` e `student.css`

## Cuidado

- **Area mais sensivel do projeto.** Toda mudanca aqui precisa de:
  1. teste em `firestore-tests/rules.test.js`
  2. verificar se a rota nova tem middleware
  3. verificar se o papel novo esta no `backend/service/access.go`
- `frontend/components/AdminAreaSwitch.tsx` parece tranquilo de mudar e nao e:
  mexer no switch pode deixar a tela de aluno alcancar a area de gestao. Hoje
  ele so renderiza para `role=admin`; o antigo `DemoRoleSwitch` foi substituido
  por ele.
