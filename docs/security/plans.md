# Planos, papéis e permissões — Treino & Nutrição V2

Status: Proposta Fase 0 (aprovação pendente). Base = modelo real da V1
(`service/approval.go`, `middleware/auth.go`, `models/types.go`) + decisões do
projeto. Este arquivo cobre **política de planos, roles, status e matriz de
permissões**.

## Papéis (roles)

| Role | Quem | Acesso |
|---|---|---|
| `admin` | Dono / administradora | Tudo: usuários, planos, aprovações, alunos, todo conteúdo, moderar feed |
| `nutritionist` | Nutricionista(s) | Só o que criou/vínculo `nutritionistId`; cria/edita treinos e dietas; vê seus alunos e histórico; modera feed |
| `student` | Aluno | Só a si mesmo; visualiza treinos/dietas atribuídos; conclui treinos; features do plano |

Regras herdadas da V1 (já implementadas):
- `RoleFrom` (middleware) devolve `student` se role vazio (compatibilidade
  legado — documento sem role é tratado como aluno).
- Admin **sempre passa** em `RequireApproved` e `RequireFeature` (bypass).
- Nutritionist **sempre passa** em `RequireFeature` (não é limitado por plano);
  admin/nutritionist são moderadores do feed (editar/apagar posts & comentários).

## Status do usuário (máquina de estados)

| Status | Significado | Transições |
|---|---|---|
| `pending_approval` | Cadastro criado, aguardando admin definir role/plano | → `active` (approve) \| → `rejected` (reject) |
| `active` | Aprovado, acesso normal | → `paused` \| `inactive` \| `rejected` |
| `paused` | Pausado manualmente | → `active` |
| `inactive` | Desligado manualmente | → `active` |
| `rejected` | Recusado pelo admin (conta Firebase excluída; doc permanece p/ auditoria) | terminal |

Comportamento de acesso:
- `IsApproved` (middleware): `""` (legado), `active`, `paused` passam;
  `pending_approval`, `rejected`, `inactive` bloqueiam.
- O dono de perfil pendente só acessa GET/PUT `/api/me` (cadastro começa aí).

## Planos (entitlements)

Modelo V1 (confirmado):
- `plans/{id}`: `name`, `description`, `features[]`, `active`, timestamps.
- **Features**: `workouts` (sempre liberado), `diet`, `community`, `ranking`.
- Ao **aprovar** ou **atribuir** um plano, o perfil recebe **snapshot** das
  features (`features[]` + `planID`) — alterar o plano depois **não** muda
  quem já está vinculado; re-atribuir é o mecanismo de atualização.
- Exclusão de plano em uso → `409 plan_in_use` (`CountStudentsWithPlan`).
- Planos inativos não aparecem para atribuição.

Política V2 (deliberada):
1. **Autorização por feature no backend** (já existe via `RequireFeature`):
   menu oculto no front **não basta** — a API nega.
2. **Snapshot é a fonte de verdade do acesso** do usuário (não leitura em
   tempo real do plano). Mantido da V1.
3. Cadastro novo **nunca** se auto-atribui features/role (regra
   `isPendingSelfProfile`). Mantido da V1.
4. **Nutricionista** não consome features (não é aluno); admin idem.
5. Novas features (Fase 1+) entram como constantes novas sem quebrar planos
   existentes (backward compatible).

## Matriz de permissões (rota × papel × feature)

Legenda: ✅ permite · ⛔ bloqueia · *(EV)* sempre exige aprovação primeiro.

| Recurso/Rota | student | nutritionist | admin | Feature extra |
|---|---|---|---|---|
| `/api/me` GET/PUT | ✅ (pendente também) | ✅ | ✅ | — |
| `/api/sessions|prs|state` | ✅ (EV*) | ✅ | ✅ | — |
| `/api/users*` (adm) | ⛔ | ⛔ | ✅ | — |
| `/api/plans*` (adm) | ⛔ | ⛔ | ✅ | — |
| `/api/students` | ⛔ | ✅ (próprios) | ✅ (todos) | — |
| `/api/workouts` GET | ✅ (próprios) | ✅ (seus) | ✅ | — |
| `/api/workouts` POST/PUT/DELETE/duplicate | ⛔ | ✅ (seus) | ✅ | — |
| `/api/diets*` (escrita) | ⛔ | ✅ (suas) | ✅ | — |
| `/api/diets` GET | ✅ | ✅ | ✅ | `diet` (aluno) |
| `/api/workout-history` | ✅ (próprio) | ✅ (seus) | ✅ | — |
| `/api/workouts/complete` | ✅ (próprio) | ⛔ | ✅ | — |
| `/api/posts*` (escrita/comente/curta) | ✅ | ✅ | ✅ | `community` (aluno) |
| `/api/posts` GET | ✅ | ✅ | ✅ | `community` (aluno) |
| `/api/diet-logs` | ✅ (próprio) | ✅ (seus) | ✅ | `diet` |
| `/api/ranking` | ✅ | ✅ | ✅ | `ranking` |
| `/api/scores/history` | ✅ | ✅ | ✅ | `ranking` |
| `/api/public/profile/{id}` | ✅ | ✅ | ✅ | `ranking` |

Mecânica real (V1):
- `RequireApproved` envolve **tudo** (menos `/api/me`) — aluno pendente não
  chega em rota de negócio.
- `Allow(roles...)`: admin/nutritionist para escrita; admin para admin-only.
- `RequireFeature(f)`: aluno precisa ter a feature; admin/nutri passam.
- Lesão de papel na rota é 403 JSON `{"error":"sem permissao"}`.

## Regras do Firestore (camada extra — já ativas)

- `users/{uid}`: dono lê/escreve dados próprios SEM campos administrativos;
  create só via `isPendingSelfProfile`; admins sobrescrevem; delete admin.
- `posts`: autor cria; autor/moderador edita/apaga (soft delete auditado).
- `dietLogs`: aluno e seu nutricionista leem; aluno/admin escrevem.
- `workouts|diets|workoutHistory`: **negados a clientes** (só API Go).
- `scores*`: escrita só API; leitura pública/dono+nutri/admin.

## Perguntas ainda em aberto (para o dono do projeto)

1. Status `blocked` (mencionado no plano) não existe na V1 (usa `paused`/
   `inactive`) — **manter os 5 da V1** ou introduzir `blocked`? Proposta:
   manter compatibilidade, `blocked` como alias de `inactive`.
2. Novo aluno pode ter **plano vazio** (features só `workouts`)? — Proposta:
   sim, default livre.
3. Nutricionista pode ter **acesso a plano/features**? — Proposta: não;
   nutricionista não é aluno.

> Decisões acima são **recomendações de Fase 0**; validação no checkpoint.