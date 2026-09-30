# Area: ALUNOS e APROVACAO

## Onde esta o codigo

**API (Go)**
- `backend/service/approval.go` — regra de aprovacao de cadastro
- `backend/handlers/approval.go` — rotas de aprovacao
- `backend/service/access.go` — permissao por papel

**App (admin / profissional)**
- `frontend/app/admin/page.tsx` — painel de gestao
- `frontend/app/admin/students/page.tsx` — lista de alunos
- `frontend/app/admin/students/[studentId]/page.tsx` — ficha do aluno
- `frontend/app/admin/timeline/page.tsx` — timeline do aluno
- `frontend/app/admin/activities/page.tsx` — atividades
- `frontend/app/admin/usuarios/page.tsx` — gestao de usuarios e planos
- `frontend/components/admin/PendingApprovals.tsx` — fila de aprovacao
- `frontend/components/PendingApproval.tsx` — tela de "aguardando aprovacao"
- `frontend/components/AdminAreaSwitch.tsx` — alterna aluno / gestao / cadastro
- `frontend/components/StudentDetail.tsx` — dados e treinos do aluno

**Testes**
- `backend/service/approval_test.go` — perfil nasce pendente, aprovar, recusar, atribuir plano
- `backend/handlers/approval_test.go` — listar pendentes, recusar, excluir plano em uso
- `backend/handlers/nutrition_test.go` — update de aluno nao apaga plano/features/aprovacao
- `backend/main_test.go` — `GET /api/me` cria perfil pendente e pendente e barrado nas
  rotas de negocio
- `frontend/e2e/zz-aprovacao.spec.ts` — cadastro nasce pendente, admin aprova, aluno entra
- `firestore-tests/rules.test.js` — criacao de perfil pendente sem campo administrativo e
  `paused` como eixo separado de aprovacao

## Conceitos

- Aluno novo cadastro **nao entra direto**: fica como pendente ate um **admin**
  aprovar. Nao existe mais o papel `nutritionist`: `backend/models/types.go` so
  define `admin` e `student`.
- Aprovacao so confirma o papel `student` e o **plano** do cadastro: em
  `backend/service/approval.go`, `ApproveUser` recusa qualquer papel diferente de
  `RoleStudent` com `ErrInvalidRole` (evita escalada de privilegio). Quem vira
  `admin` e o admin, na criacao/edicao do usuario — nao pela aprovacao.

## Pendencias

<!-- escreva aqui -->
- [ ] sem teste de tela da fila de aprovacao: `frontend/components/admin/PendingApprovals.tsx`
      e `frontend/components/PendingApproval.tsx` so tem cobertura no E2E
- [ ] `frontend/app/admin/timeline/page.tsx` nao tem nenhum teste

## Cuidado

- Aprovar o aluno errado da acesso a programa de outra pessoa.
- Ver `auth-perfil.md` para regra de permissao.
