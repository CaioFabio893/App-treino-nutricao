# Spec + Plano de Implementação: Aprovação de Cadastro, Papéis, Planos (Features) e Login com Google

> Arquivo pensado para ser lido pelo **opencode** neste repositório (`treino-louise`).
> Segue o formato descrito em `.opencode/skills/writing-plans/SKILL.md` (Spec → Matriz de
> Tarefas → Cenários BDD → Checklist) e deve ser executado com a skill `executing-plans`.
> Local sugerido: `docs/superpowers/specs/gestao-cadastro-papeis-planos-google.md` (já é
> onde este arquivo está). Ao concluir, registrar em `docs/sdd/backlog.md` e `docs/sdd/status.md`.

---

## 0. Diagnóstico do estado atual (o que já existe no código)

Antes de pedir para o opencode gerar algo do zero, mapeei o que **já existe** para não
duplicar nem quebrar contratos:

- `backend/models/types.go`: já existe `Role` (`admin`, `nutritionist`, `student`) e
  `UserProfile` com `Role`, `NutritionistID`, `Status` (`active|paused|inactive`, string livre).
- `backend/middleware/auth.go`: valida o ID token do Firebase, carrega o perfil via
  `repo.GetUserProfile` e injeta `role` no contexto. **Se o perfil não existir, assume
  `student` por padrão** — hoje não existe estado "aguardando aprovação".
- `backend/service/profile.go` (`GetOrCreateProfile`): quando o perfil ainda não existe,
  cria um novo **com `role = student` automaticamente**. Ou seja: hoje, **qualquer pessoa
  que se cadastra vira aluno ativo na hora**, sem o admin decidir nada.
- `frontend/components/ProfileSetup.tsx`: tela que aparece no primeiro login; coleta só o
  **nome** e chama `PUT /api/me` com `role: "student"` fixo no código.
- `frontend/app/login/page.tsx` + `frontend/lib/auth.tsx`: login/cadastro só com
  e-mail/senha (`signInWithEmailAndPassword` / `createUserWithEmailAndPassword`). **Não
  existe botão "Entrar com Google"**.
- `frontend/app/admin/page.tsx` + `backend/handlers/nutrition.go` (`HandleListUsers`,
  `HandleCreateUser`, `HandleUpdateUser`, `HandleDeleteUser`): o admin já tem uma tela de
  gestão de usuários, mas **precisa digitar manualmente o UID do Firebase** para criar um
  usuário — não existe fila de "pessoas que se cadastraram e estão esperando aprovação".
- **Não existe** nenhum conceito de "plano"/"pacote de funcionalidades" — todo `student`
  enxerga tudo (treino, dieta, comunidade, ranking) sem distinção.

Esses 3 pontos (auto-aprovação, ausência de login social, ausência de planos) são o que
esta spec resolve.

---

## 1. Resumo e objetivo

Transformar o app num **sistema de gestão com fluxo de aprovação**, no mesmo espírito de
ferramentas como o **console de administração do Google Workspace** (todo usuário novo
entra "pendente" até um admin liberar o tipo de acesso), o convite/aprovação de
workspace do **Slack/Notion**, e sistemas de gestão de academia como **EVO, Pacto Soluções
e Tecnofit** (o aluno se cadastra pelo app, mas quem libera o plano contratado é a
recepção/admin). Três entregas:

1. **Cadastro com aprovação do admin**: o usuário (aluno) se cadastra sozinho (e-mail/senha
   **ou** Google), mas fica em estado `pending_approval` sem acesso às áreas do app até um
   admin escolher o **papel** (nutricionista ou aluno) e, se aluno, o **plano**.
2. **Login/cadastro com conta Google** (Firebase `GoogleAuthProvider`), reduzindo fricção
   de cadastro — como praticamente todo SaaS moderno oferece hoje.
3. **Sistema de Planos (feature entitlements)**: o admin cria "planos" (ex.: Básico,
   Completo, Premium) definindo quais módulos o aluno enxerga (treino, dieta, comunidade,
   ranking), e atribui um plano a cada aluno — inspirado em **Stripe Products & Prices** e
   em **feature flags por plano** (padrão usado por LaunchDarkly, e por apps de assinatura
   em geral).

---

## 2. Decisões de arquitetura

- **Não quebrar compatibilidade**: `Role` e `Status` continuam existindo como estão hoje;
  adicionamos **novos valores** (`pending_approval`, `rejected`) ao `Status`, não um campo novo.
- **Plano é uma entidade própria** (`plans/{planID}` no Firestore), não um enum fixo no
  código — assim o admin pode criar/editar planos sem precisar de deploy. É o mesmo
  princípio do "Products" no Stripe: o catálogo vive no banco, não hardcoded.
- **Features do plano são "snapshotadas" no perfil do aluno** (`UserProfile.Features`) no
  momento da atribuição, em vez de sempre buscar o plano em toda request. Motivo:
  performance (evita 1 leitura extra no Firestore por request) e histórico (se o admin
  editar o plano depois, alunos já atribuídos não mudam sozinhos — o admin reatribui
  quando quiser, de forma explícita e auditável). Trade-off documentado na seção 7.
- **Gate de acesso por feature acontece no backend** (middleware), não só escondendo botão
  no frontend — senão um aluno sem o módulo "dieta" no plano ainda conseguiria chamar
  `GET /api/diets` direto. Frontend esconde por UX; backend bloqueia por segurança.

---

## 3. Modelo de dados

### 3.1 Backend Go — `backend/models/types.go`

```go
// ── Status de acesso do usuário (estende o campo Status já existente) ──
const (
	StatusPendingApproval = "pending_approval" // cadastro feito (email/senha ou Google), aguardando admin definir role+plano
	StatusActive          = "active"           // já existia
	StatusPaused          = "paused"           // já existia
	StatusInactive        = "inactive"         // já existia
	StatusRejected        = "rejected"         // admin recusou o cadastro
)

// ── Planos (pacotes de funcionalidades) ──

// Feature identifica um módulo do app que pode ser ligado/desligado por plano.
type Feature string

const (
	FeatureWorkouts  Feature = "workouts"  // treinos
	FeatureDiet      Feature = "diet"      // dietas
	FeatureCommunity Feature = "community" // feed social / comunidade
	FeatureRanking   Feature = "ranking"   // ranking / gamificação
)

// Plan é um pacote de funcionalidades que o admin cria e atribui a alunos.
// Documento em plans/{id} no Firestore.
type Plan struct {
	ID          string    `json:"id,omitempty"`
	Name        string    `json:"name"`                  // ex.: "Completo"
	Description string    `json:"description,omitempty"` // ex.: "Treino + dieta + comunidade"
	Features    []Feature `json:"features"`               // ex.: ["workouts","diet","community"]
	Active      bool      `json:"active"`                 // planos inativos não aparecem pra atribuir a novos alunos
	CreatedAt   time.Time `json:"createdAt,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}
```

### 3.2 `UserProfile` — campos novos (adicionar aos já existentes, não remover nenhum)

```go
type UserProfile struct {
	// ...todos os campos já existentes permanecem iguais...

	PlanID          string    `json:"planID,omitempty"`       // plano atualmente atribuído (vazio = nenhum)
	Features        []Feature `json:"features,omitempty"`     // snapshot das features do plano no momento da atribuição
	AuthProvider    string    `json:"authProvider,omitempty"` // "password" | "google.com" — de onde veio o login
	ApprovedBy      string    `json:"approvedBy,omitempty"`   // uid do admin que aprovou
	ApprovedAt      time.Time `json:"approvedAt,omitempty"`
	RejectedReason  string    `json:"rejectedReason,omitempty"`
}
```

### 3.3 Firestore — coleções

```
users/{uid}                → UserProfile (já existe; ganha os campos novos acima)
plans/{planId}             → Plan (nova coleção)
```

### 3.4 Frontend TS — `frontend/lib/types.ts`

```ts
export type Feature = "workouts" | "diet" | "community" | "ranking";

export interface Plan {
  id: string;
  name: string;
  description?: string;
  features: Feature[];
  active: boolean;
  createdAt?: string;
}

export interface UserProfile {
  // ...campos já existentes...
  planID?: string;
  features?: Feature[];
  authProvider?: "password" | "google.com";
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
}
```

`status` no frontend passa a poder valer também `"pending_approval"` e `"rejected"`
(hoje é tipado como `string`, então não quebra nada — só documentar os valores).

---

## 4. Contratos de API (novos endpoints + mudanças)

Seguindo o padrão já usado (`net/http` `mux.HandleFunc("MÉTODO /rota", ...)`,
`a.Allow(role...)`, `a.Require(...)`), em `backend/main.go`:

### 4.1 Fluxo de aprovação

| Método/Rota | Quem pode | Descrição |
|---|---|---|
| `GET /api/me` | qualquer autenticado | **Alterar** resposta: se perfil não existe, criar automaticamente como `status: pending_approval`, `role: ""` (sem papel ainda), em vez de assumir `student`. |
| `PUT /api/me` | qualquer autenticado | **Alterar**: continua só atualizando `name`/`photoURL`; nunca aceita `role`, `status`, `planID` vindos do cliente (igual já faz hoje com `role`). |
| `GET /api/users/pending` | `admin` | **Novo.** Lista usuários com `status = pending_approval` (fila de aprovação). |
| `POST /api/users/{id}/approve` | `admin` | **Novo.** Body: `{ "role": "student"\|"nutritionist", "planID"?: string, "nutritionistID"?: string }`. Define o papel, marca `status: active`, `approvedBy`, `approvedAt`; se `role=student` e `planID` informado, copia `Features` do plano para o perfil. |
| `POST /api/users/{id}/reject` | `admin` | **Novo.** Body: `{ "reason"?: string }`. Marca `status: rejected`, `rejectedReason`. Usuário rejeitado não acessa nenhuma rota protegida (ver middleware, seção 5). |

### 4.2 Planos

| Método/Rota | Quem pode | Descrição |
|---|---|---|
| `GET /api/plans` | `admin`, `nutritionist` | Lista todos os planos (nutricionista só lê, pra ver o que pode oferecer/sugerir). |
| `POST /api/plans` | `admin` | Cria plano. |
| `PUT /api/plans/{id}` | `admin` | Edita plano (nome, descrição, features, active). |
| `DELETE /api/plans/{id}` | `admin` | Remove plano (bloquear exclusão se houver aluno usando — devolver 409 com contagem, e sugerir "desativar" em vez de excluir). |
| `POST /api/users/{id}/plan` | `admin` | **Novo.** Body: `{ "planID": string }`. Reatribui plano a um aluno já ativo (copia `Features` de novo). |

### 4.3 Exemplo de resposta de `GET /api/me` para usuário pendente

```json
{
  "id": "abc123",
  "name": "Maria Aluna",
  "email": "maria@email.com",
  "role": "",
  "status": "pending_approval",
  "authProvider": "google.com",
  "needsApproval": true
}
```

O frontend usa `needsApproval` (novo, análogo ao `needsProfile` que já existe) para
decidir se mostra a tela de "aguardando aprovação" (seção 6.2).

---

## 5. Regras de autorização (`backend/middleware/auth.go`)

Hoje, se o perfil não existe, o middleware assume `role = student` (linha ~48-52). Trocar
por: se o perfil não existe **ou** `status` é `pending_approval`/`rejected`, o usuário
autentica normalmente (token válido), mas **nenhuma rota de negócio libera acesso** — só
`GET/PUT /api/me` funcionam. Sugestão de implementação:

```go
// Novo helper em middleware/auth.go
func IsApproved(ctx context.Context) bool {
	status, _ := ctx.Value(statusKey).(string)
	return status == "" || status == "active" || status == "paused"
	// "" cobre perfis antigos migrados sem status explícito — não quebra usuários já ativos hoje
}
```

E um novo middleware `RequireApproved` que envolve todas as rotas de negócio (sessions,
workouts, diets, posts, ranking etc.), retornando `403 { "error": "cadastro pendente de aprovação" }`
quando `!IsApproved`. Isso fecha a brecha de segurança sem exigir reescrever cada handler.

### 5.1 Gate por feature (plano)

Novo helper, mesmo arquivo:

```go
func (a *Auth) RequireFeature(f models.Feature) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			role := RoleFrom(r.Context())
			if role == models.RoleAdmin || role == models.RoleNutritionist {
				next(w, r) // admin/nutricionista sempre têm acesso total (quem gerencia o conteúdo)
				return
			}
			features, _ := r.Context().Value(featuresKey).([]models.Feature)
			for _, ft := range features {
				if ft == f {
					next(w, r)
					return
				}
			}
			http.Error(w, `{"error":"recurso nao incluido no seu plano"}`, http.StatusForbidden)
		}
	}
}
```

Aplicar em `main.go` nas rotas do aluno que dependem de plano, por exemplo:

```go
mux.HandleFunc("GET /api/diets", a.Require(a.RequireApproved(a.RequireFeature(models.FeatureDiet)(h.HandleListDiets))))
mux.HandleFunc("GET /api/posts", a.Require(a.RequireApproved(a.RequireFeature(models.FeatureCommunity)(h.HandleListPosts))))
mux.HandleFunc("GET /api/ranking", a.Require(a.RequireApproved(a.RequireFeature(models.FeatureRanking)(h.HandleGetRanking))))
```

`workouts` fica sempre liberado para todo aluno ativo (é o "plano mínimo" — como um
"free tier" que todo sistema de assinatura costuma ter para não deixar a conta 100% vazia).

---

## 6. Frontend — telas e fluxos

### 6.1 Login com Google (`frontend/lib/firebase.ts`, `frontend/lib/auth.tsx`, `frontend/app/login/page.tsx`)

Em `firebase.ts`, exportar um novo provider:

```ts
import { GoogleAuthProvider } from "firebase/auth";
export const googleProvider = new GoogleAuthProvider();
```

Em `auth.tsx`, adicionar ao `AuthCtx`:

```ts
loginWithGoogle: () => Promise<User>;
```

```ts
import { signInWithPopup } from "firebase/auth";
import { googleProvider } from "./firebase";

const loginWithGoogle = useCallback(async () => {
  if (DEMO_MODE) return DEMO_USER;
  if (!firebaseAuth) throw new Error("Firebase não configurado");
  const cred = await signInWithPopup(firebaseAuth, googleProvider);
  return cred.user;
}, []);
```

Em `login/page.tsx`, adicionar um botão "Entrar com Google" (usar `signInWithPopup` —
`signInWithRedirect` é mais robusto em navegadores que bloqueiam popup, mas exige tratar
`getRedirectResult` no carregamento da página; recomendo começar com popup por
simplicidade e trocar depois se houver reclamação de usuários mobile). Um clique no botão
já serve tanto para "criar conta" quanto para "entrar" — é assim que Google/Slack/Notion
tratam login social (não existe "cadastro" separado de "login" quando é OAuth).

### 6.2 Tela de "aguardando aprovação" (novo componente `PendingApproval.tsx`)

Substituir, para o caso `needsApproval`, o comportamento atual de `ProfileSetup`
(que hoje libera acesso imediato). Novo fluxo em `frontend/app/page.tsx`:

```tsx
if (needsApproval) return <PendingApproval />;
```

`PendingApproval.tsx`: tela simples dizendo algo como "Seu cadastro foi recebido! Um
administrador vai liberar seu acesso em breve." + botão "Sair". Sem formulário — a
diferença central desta spec é que **quem decide o papel/plano é o admin, não o próprio
usuário digitando seu nome e virando aluno sozinho** (que é o que acontece hoje).

Ainda é útil coletar `name`/`photoURL` no primeiro login (via Google isso já vem pronto;
via e-mail/senha, um campo simples de nome antes de cair na tela de espera) — mas isso é
só perfil, não decide role/plano.

### 6.3 Fila de aprovação no Admin (`frontend/app/admin/page.tsx`)

Adicionar uma aba/seção "Pendentes" acima da lista de usuários existente, num padrão
parecido com a fila de "solicitações de acesso" do Google Workspace Admin Console ou a
tela de "convites pendentes" do Slack:

- Lista vinda de `GET /api/users/pending`: nome, e-mail, foto, data do cadastro, provedor
  (badge "Google" ou "E-mail").
- Cada linha tem: seletor de **Papel** (Aluno/Nutricionista), seletor de **Plano**
  (só aparece se Papel = Aluno; vem de `GET /api/plans`), seletor de **Nutricionista
  responsável** (reaproveitar o `<select>` que já existe no formulário de usuário) e dois
  botões: **Aprovar** (`POST /api/users/{id}/approve`) e **Recusar** (`POST /api/users/{id}/reject`,
  com campo opcional de motivo).
- Depois de aprovar/recusar, remover da lista e mostrar toast (reaproveitar o padrão
  `showToast` que já existe nessa página).

### 6.4 CRUD de Planos (`frontend/app/admin/plans/page.tsx`, novo)

Nova subpágina do admin, acessível por um link na navegação do admin. Tela simples:
tabela de planos (nome, descrição, quantidade de alunos usando, badge das features
incluídas) + formulário para criar/editar (nome, descrição, checkboxes de features:
Treinos, Dieta, Comunidade, Ranking, e toggle "ativo"). Reaproveitar as classes CSS já
existentes (`frm-card`, `frm-row`, `frm-row-inline`) para manter consistência visual —
ver `.opencode/skills/design-system/SKILL.md` antes de estilizar.

No formulário de edição de usuário existente (`admin/page.tsx`), quando `role = student`,
adicionar um `<select>` de Plano ao lado do de Nutricionista responsável, chamando
`POST /api/users/{id}/plan` quando o admin trocar o plano de um aluno já ativo.

### 6.5 Esconder módulos sem acesso no menu do aluno

Nos componentes de navegação da área do aluno (dashboard/menu), checar
`profile.features?.includes("diet")` etc. antes de renderizar o link/aba de Dieta,
Comunidade e Ranking — evita o aluno ver um link que vai dar 403. "Treinos" nunca é
escondido (feature mínima, seção 5).

---

## 7. Trade-offs e decisões que você (Caio) deve validar antes de mandar pro opencode

1. **Snapshot de features vs. leitura em tempo real do plano**: a spec acima copia as
   features do plano para o perfil no momento da atribuição (mais rápido, mas exige o
   admin "reatribuir" quando editar um plano em uso). Alternativa mais simples de manter
   consistente, porém com 1 leitura extra por request: o middleware buscar o `Plan` pelo
   `PlanID` toda vez. Para o tamanho atual do app, a leitura extra é barata — se preferir
   simplicidade em vez de performance, posso reescrever a spec assim.
2. **`signInWithPopup` vs `signInWithRedirect`** para o Google: popup é mais simples de
   implementar, mas alguns navegadores/mobile bloqueiam popup. Se o público for
   majoritariamente mobile, considere redirect desde já.
3. **Rejeição (`reject`)**: a spec permite recusar um cadastro. Decida se o app deve
   também **excluir o usuário do Firebase Auth** nesse caso (hoje o `DeleteUser` existente
   provavelmente só apaga o documento Firestore, não a conta do Firebase Auth — vale
   conferir/ajustar para não deixar contas fantasmas).

> **Decisões (validadas em 15/09/2026):**
> 1. **Snapshot** de features no perfil no momento da atribuição (spec original).
> 2. **`signInWithPopup`** para o login Google.
> 3. **Excluir também a conta do Firebase Auth** ao rejeitar (e ao excluir usuário via
>    `DELETE /api/users/{id}`) — mantendo o documento Firestore com `status=rejected`
>    para auditoria.

---

## 8. Matriz de Tarefas (Task Breakdown)

| ID | Camada | Descrição da Tarefa | Verificação / Teste |
|---|---|---|---|
| TS-01 | Backend (Go/models) | Adicionar constantes de `Status`, `Feature`, struct `Plan` e novos campos em `UserProfile` (seção 3.1–3.2) | `go build ./...` sem erros |
| TS-02 | Backend (Go/repository) | Implementar `CreatePlan`, `GetPlan`, `ListPlans`, `UpdatePlan`, `DeletePlan`, `ListUsersByStatus(pending_approval)` no `repository.Repository` (interface + implementação Firestore) | `go test -v ./repository -run TestPlan` |
| TS-03 | Backend (Go/service) | Alterar `GetOrCreateProfile` para criar perfil com `Role: ""`, `Status: pending_approval` quando não existir (em vez de forçar `student`) | `go test -v ./service -run TestGetOrCreateProfile_Pending` |
| TS-04 | Backend (Go/service) | Criar `ApproveUser(ctx, adminUID, targetID, role, planID, nutritionistID)` e `RejectUser(ctx, adminUID, targetID, reason)` — validam papel, copiam features do plano, gravam `approvedBy/approvedAt` | `go test -v ./service -run TestApproveUser` |
| TS-05 | Backend (Go/middleware) | Implementar `RequireApproved` e `RequireFeature` (seção 5) | `go test -v ./middleware -run TestRequireApproved` e `TestRequireFeature` |
| TS-06 | Backend (Go/handlers) | `HandleListPendingUsers`, `HandleApproveUser`, `HandleRejectUser`, `HandleListPlans`, `HandleCreatePlan`, `HandleUpdatePlan`, `HandleDeletePlan`, `HandleAssignPlan` | `go test -v ./handlers -run TestApprove` / `TestPlan` |
| TS-07 | Backend (Go/main) | Registrar as novas rotas (seção 4) e envolver rotas de negócio existentes com `RequireApproved`/`RequireFeature` | `go vet ./...` + smoke test manual dos endpoints existentes (não podem quebrar) |
| TS-08 | Backend (Firestore rules) | Atualizar `firestore.rules` para a nova coleção `plans/` (leitura: admin+nutricionista; escrita: admin) e negar escrita direta do cliente em `users/{uid}.status`, `.role`, `.planID`, `.features` (só a API pode mudar isso) | `firebase emulators:exec` ou revisão manual das rules |
| TS-09 | Frontend (lib) | Adicionar `Feature`, `Plan` a `types.ts`; funções `listPlans`, `createPlan`, `updatePlan`, `deletePlan`, `listPendingUsers`, `approveUser`, `rejectUser`, `assignPlan` a `api.ts` | `npm run test:run -- tests/unit/api.test.ts` (ou criar se não existir) |
| TS-10 | Frontend (auth) | `googleProvider` em `firebase.ts`; `loginWithGoogle` em `auth.tsx`; `needsApproval` derivado de `profile` (igual `needsProfile` hoje) | Inspeção manual + teste unitário do hook se houver suíte de testes de `auth.tsx` |
| TS-11 | Frontend (UI) | Botão "Entrar com Google" em `login/page.tsx` | Teste visual mobile (360px) e desktop |
| TS-12 | Frontend (UI) | Componente `PendingApproval.tsx` + branch em `app/page.tsx` | Teste manual: usuário novo cai na tela de espera, sem acesso a `/treinos` |
| TS-13 | Frontend (Admin) | Seção "Pendentes" em `admin/page.tsx` com aprovar/recusar (seção 6.3) | `npx playwright test tests/e2e/admin-approve.spec.ts` (novo) |
| TS-14 | Frontend (Admin) | Página `admin/plans/page.tsx` — CRUD de planos | `npx playwright test tests/e2e/admin-plans.spec.ts` (novo) |
| TS-15 | Frontend (Admin) | `<select>` de Plano no formulário de edição de usuário existente, chamando `assignPlan` | Teste manual |
| TS-16 | Frontend (Aluno) | Esconder itens de menu sem a feature correspondente | Teste manual com um plano "Básico" (só `workouts`) |
| TS-17 | Docs | Atualizar `README.md` (novo passo no Passo 2: habilitar "Google" em Firebase Authentication → Sign-in method) e `docs/sdd/backlog.md`/`status.md` | Revisão manual |

---

## 9. Cenários BDD detalhados

### TS-03 / TS-04: Cadastro cai pendente e admin aprova

```
Cenário: Novo usuário se cadastra e fica pendente
  Dado que uma pessoa nunca logou no app antes
  Quando ela se cadastra com e-mail/senha ou com Google
  Então a API cria o perfil dela com status "pending_approval" e role vazio
  E ela não consegue acessar /api/workouts, /api/diets, /api/posts nem /api/ranking
  E a tela do app mostra "aguardando aprovação"

Cenário: Admin aprova como aluno com plano
  Dado um usuário com status "pending_approval"
  Quando o admin chama POST /api/users/{id}/approve com role="student" e planID="plano-completo"
  Então o status do usuário muda para "active"
  E o role muda para "student"
  E o campo features do usuário passa a conter as features do plano "plano-completo"
  E approvedBy/approvedAt são preenchidos

Cenário: Admin recusa cadastro
  Dado um usuário com status "pending_approval"
  Quando o admin chama POST /api/users/{id}/reject com reason="e-mail não reconhecido"
  Então o status muda para "rejected"
  E o usuário continua sem acesso a qualquer rota de negócio
```

### TS-05 / TS-06: Gate por feature

```
Cenário: Aluno sem a feature "diet" no plano tenta acessar dietas
  Dado um aluno ativo cujo plano só inclui "workouts"
  Quando ele chama GET /api/diets
  Então a API responde 403 com {"error":"recurso nao incluido no seu plano"}

Cenário: Nutricionista sempre tem acesso, independente de plano
  Dado um usuário com role "nutritionist"
  Quando ele chama GET /api/diets ou GET /api/posts
  Então a API responde normalmente (200), pois nutricionista/admin não são limitados por plano
```

### TS-10 / TS-11: Login com Google

```
Cenário: Login com Google de um usuário novo
  Dado que a pessoa clica em "Entrar com Google" pela primeira vez
  Quando ela conclui o popup de login do Google
  Então o Firebase cria a conta automaticamente
  E o app chama GET /api/me, recebe needsApproval=true
  E a tela "aguardando aprovação" é exibida
```

---

## 10. Checklist de verificação e gates (antes de considerar a feature pronta)

- [ ] Backend Go: `go test -v ./...` sem falhas (incluindo os novos testes de `service`,
      `middleware`, `handlers` e `repository` listados na matriz)
- [ ] Backend Go: `go vet ./...` limpo
- [ ] Frontend: `npm run test:run` sem falhas
- [ ] Frontend: `npx playwright test` cobrindo aprovação de usuário e CRUD de plano
- [ ] Regressão manual: um usuário **já ativo hoje** (perfil antigo sem os campos novos)
      continua acessando tudo normalmente — nenhuma migração de dados é obrigatória para
      quem já está com `status: active`
- [ ] Firestore rules validadas (cliente não consegue escrever direto em `role`, `status`,
      `planID`, `features` de `users/{uid}`)
- [ ] Responsividade: fila de "Pendentes" e CRUD de planos testados em 360px (mobile) e
      1440px (desktop)
- [ ] `README.md` atualizado com o passo de habilitar login Google no console do Firebase

---

## 11. Opções extras de melhoria de sistema de gestão (para priorizar depois, não bloqueiam esta spec)

Cada item abaixo é independente — escolha o que fizer sentido pra fase atual do produto.
Referências de sistemas reais que resolvem o mesmo problema, para o opencode ter contexto
de "como isso costuma ser feito":

1. **Convite por link/código em vez de e-mail solto** — como Slack/Notion/Discord: admin
   gera um link/código de convite já com papel e plano pré-definidos; quem se cadastra por
   esse link entra direto aprovado (pula a fila). Reduz trabalho manual de aprovação para
   turmas grandes.
2. **Importação em massa de alunos via CSV** — padrão comum em softwares de academia (EVO,
   Pacto Soluções, Tecnofit): admin sobe uma planilha com nome/e-mail/plano e o sistema
   cria os convites/pendências de uma vez, em vez de aprovar um por um.
3. **Log de auditoria de ações administrativas** — como o Audit Log do Google Workspace
   Admin Console: registrar quem aprovou/recusou/mudou plano de quem e quando, numa
   coleção `audit_logs/`. Importante se mais de uma pessoa tiver acesso admin no futuro.
4. **Notificação por e-mail ao aprovar/recusar** — usar Firebase Extensions "Trigger
   Email" ou um serviço como Resend/SendGrid, avisando o usuário que o acesso foi
   liberado (ou recusado), em vez de ele precisar ficar checando o app.
5. **Cobrança recorrente real dos planos** — se em algum momento os planos virarem
   assinatura paga de verdade, o próximo passo natural é integrar com **Stripe Billing**
   (Products/Prices/Subscriptions) ou um gateway nacional (Pagar.me, Asaas), em vez de o
   admin controlar manualmente quem pagou.
6. **Multi-tenant (mais de uma clínica/academia no mesmo sistema)** — hoje o app pressupõe
   uma única operação (Louise Lima). Se a ideia crescer para vender o sistema para outros
   nutricionistas, o padrão é introduzir um `orgID` em todas as coleções (mesmo modelo que
   Notion/Slack usam para "workspaces"), o que é uma mudança estrutural maior — vale uma
   spec própria se/quando isso virar prioridade.
7. **Painel de métricas para o admin** — cards simples com "alunos ativos", "pendentes",
   "adesão média à dieta/treino da semana", no estilo dos dashboards de admin de
   qualquer SaaS (Stripe Dashboard, Google Analytics) — dá visibilidade sem precisar abrir
   cada aluno individualmente.

---

## 12. Ordem sugerida de execução no opencode

1. TS-01 → TS-02 → TS-03 → TS-04 → TS-05 → TS-06 → TS-07 → TS-08 (fecha o backend inteiro
   com testes antes de mexer no frontend — princípio TDD já usado no projeto).
2. TS-09 → TS-10 → TS-11 (infraestrutura de auth/api no frontend).
3. TS-12 (tela de espera) — sem isso os testes manuais das próximas tarefas ficam sem
   sentido, porque não dá pra simular "usuário pendente" na UI.
4. TS-13 → TS-14 → TS-15 (telas de admin).
5. TS-16 (esconder menu por feature).
6. TS-17 (documentação).

Ao abrir uma sessão no opencode, aponte para este arquivo e peça para seguir a skill
`writing-plans`/`executing-plans` a partir daqui, uma tarefa (`TS-xx`) por vez, rodando os
testes indicados antes de passar para a próxima.