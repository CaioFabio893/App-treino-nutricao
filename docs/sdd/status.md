# Status — SDD

Estados possíveis: `backlog` → `em_andamento` → `pronto` → `testado` → `revisado`.

## SB-001 — Aprovação de cadastro, papéis, planos e login Google

**Estado atual:** `testado` (iniciado 15/09/2026)

### Matriz de tarefas

| ID | Tarefa | Status |
|---|---|---|
| TS-01 | Backend models: Status, Feature, Plan, novos campos em UserProfile | ✅ |
| TS-02 | Repository: Planos + ListUsersByStatus | ✅ |
| TS-03 | Service: GetOrCreateProfile cria perfil pending_approval | ✅ |
| TS-04 | Service: ApproveUser / RejectUser / AssignPlan | ✅ |
| TS-05 | Middleware: RequireApproved / RequireFeature | ✅ |
| TS-06 | Handlers: fila pendente, aprovação, rejeição, planos, atribuição | ✅ |
| TS-07 | main.go: novas rotas + gates nas rotas de negócio | ✅ |
| TS-08 | firestore.rules: plans/ + proteção de users/{uid} | ✅ |
| TS-09 | Frontend lib: types (Feature/Plan) + api (plans, pending, approve/reject/assign) | ✅ |
| TS-10 | Frontend auth: googleProvider, loginWithGoogle, needsApproval | ✅ |
| TS-11 | Botão "Entrar com Google" no login | ✅ |
| TS-12 | Componente PendingApproval + branch em app/page.tsx | ✅ |
| TS-13 | Seção "Pendentes" no admin | ✅ |
| TS-14 | CRUD de Planos no admin | ✅ |
| TS-15 | Select de Plano no formulário de usuário (assignPlan) | ✅ |
| TS-16 | Esconder menu do aluno por feature | ✅ |
| TS-17 | README + docs/sdd (handoff) | ✅ |

### Histórico

- 15/09/2026: spec criada, decisões da seção 7 validadas (popup, snapshot de features, reject exclui conta Firebase), execução iniciada.
- 15/09/2026: backend completo (TS-01..TS-08) — `go build`, `go vet` e `go test ./...` verdes; rules do Firestore atualizadas.
- 15/09/2026: frontend completo (TS-09..TS-16) — `npx tsc --noEmit` limpo e `npm run build` verde (Next 16); validados login Google, PendingApproval, painéis de pendentes/planos e menu do aluno por feature.
- 15/09/2026: handoff concluído (TS-17) — README com o fluxo de aprovação/planos e novas rotas; backlog e status finalizados.