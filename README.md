# Treino Louise — App profissional (Go + Next.js + Firestore)

Migração do app de treino da **Louise Lima** para uma arquitetura profissional
com login e dados na nuvem — tudo dentro da **camada gratuita** do Google Cloud.

## O que cada parte faz

```
┌─────────────────────┐      login e senha       ┌──────────────────────┐
│ Frontend (Next.js)  │ ───────────────────────► │ Firebase Authentication│
│ Cloud Run (grátis)  │                          └──────────────────────┘
└─────────┬───────────┘
          │ chama a API com "Authorization: Bearer <token>"
          ▼
┌─────────────────────┐        salva e lê         ┌──────────────────────┐
│ Backend (Go)        │ ───────────────────────► │ Firestore (NoSQL)    │
│ Cloud Run (grátis)  │                          │ (grátis)             │
└─────────────────────┘                          └──────────────────────┘
```

- **Frontend**: Next.js (React) com `output: "standalone"` — um **servidor Node**
  autocontido no **Cloud Run**. O modo servidor permite **rotas dinâmicas**
  (ex. `/nutritionist/students/[studentId]`), que não existem em exportação
  estática.
- **Backend**: API em **Go** no **Cloud Run** — verifica o token do Firebase e
  acessa o Firestore (o usuário nunca fala direto com o banco).
- **Banco**: **Firestore** (NoSQL) — dados por usuário em `users/{uid}/...`.
- **Login**: **Firebase Authentication** (e-mail/senha).

## Estrutura do projeto

```
├── backend/          # API Go (Cloud Run)
│   ├── main.go       # rotas + subida do servidor
│   ├── auth.go       # verificação do token (Firebase Admin SDK) + roles
│   ├── handlers.go   # endpoints HTTP + CORS (fluxo do aluno)
│   ├── handlers_nutrition.go # endpoints do nutricionista/admin
│   ├── store.go      # operações no Firestore (CRUD de tudo)
│   ├── models.go     # structs (Session, PR, AppState, UserProfile, WorkoutDefine, Diet…)
│   ├── Dockerfile    # imagem para o Cloud Run
│   └── go.mod
├── frontend/         # app Next.js (Cloud Run — modo servidor/standalone)
│   ├── app/          # páginas (login, treino, painel do nutricionista, admin)
│   ├── components/   # UI (cards, timer, modais, formulários de treinos/dietas…)
│   ├── lib/          # firebase, api, auth (roles), tipos
│   ├── public/       # ícones, manifest, service worker
│   ├── Dockerfile    # imagem do frontend para o Cloud Run
│   └── .env.example  # modelo das variáveis
├── firebase.json     # configuração do Firebase Hosting + Firestore
├── firestore.rules   # regras de segurança do banco
└── .firebaserc       # projeto Firebase padrão
```

> A pasta `treino-louise-main/` (versão antiga, arquivo único) continua existindo
> como referência até a migração terminar.

## Pré-requisitos

- **Node.js 20+** e npm ✅ (já instalado na máquina)
- **Go 1.23+** ❌ (instalar agora: https://go.dev/dl)
- **Firebase CLI**: `npm install -g firebase-tools`
- **Google Cloud CLI (gcloud)**: https://cloud.google.com/sdk/docs/install
- **Docker** (para build local do backend, opcional — dá pra usar `gcloud builds submit` sem Docker local)

---

## Modo demo (ver o app funcionando hoje, sem Firebase)

Só precisa do Node. Sem configurar nada no Google:

```bash
cd frontend
copy .env.example .env.local   # no Linux: cp .env.example .env.local
npm install                    # já feito se você seguiu a migração
```

No arquivo `frontend/.env.local`, coloque:

```
NEXT_PUBLIC_DEMO=1
```

Rode `npm run dev` e abra **http://localhost:3000** — o app entra direto numa
conta demo **do nutricionista**, com alunos, treinos e dietas de exemplo
(alunos, CRUD, duplicação, timeline e finalização de treino funcionam; tudo
fica salvo no navegador). Troque para `NEXT_PUBLIC_DEMO=0` quando for conectar
o Firebase de verdade.

> O modo demo simula o backend Go inteiro em memória/localStorage — útil
> também pra entender o fluxo antes de subir o Cloud Run.

> ⚠️ **Windows Defender**: o `go build` local às vezes é bloqueado com
> "contém um vírus ou software potencialmente indesejado" — é falso positivo
> em binários Go. Não afeta o deploy (o `gcloud builds submit` compila na
> nuvem do Google). Se quiser compilar local, adicione exceção no Windows
> Security para a pasta do projeto e para `%TEMP%`. O `go vet` não é bloqueado
> (valida o código sem gerar executável).

---

## Guia de configuração (tudo de graça)

### Passo 1 — Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**.
2. Nome do projeto: ex. `treino-louise` (ou o que quiser).
3. **Desative o Google Analytics** (a menos que queira).
4. O plano gratuito (**Spark**) é o padrão — perfeito.

### Passo 2 — Ativar Authentication (login)

1. No console, menu **Build → Authentication → Get started**.
2. Na aba **Sign-in method**, habilite **E-mail/Senha** e salve.
3. (Opcional) Crie um usuário de teste em **Users → Add user**.

### Passo 3 — Criar o Firestore (banco NoSQL)

1. Menu **Build → Firestore Database → Create database**.
2. Modo de produção.
3. Região: escolha a mais próxima (o app dá deploy no Cloud Run na mesma região).
4. Depois publique as regras: rode `firebase deploy --only firestore` na raiz deste projeto.

### Passo 4 — Pegar as chaves do frontend

1. Console → ⚙️ **Configurações do projeto → Seus apps**.
2. Se não existir app web: clique no ícone **</> (Web)** e registre (ex. nome "treino-web").
3. Copie o objeto `firebaseConfig` (apiKey, authDomain, projectId, …) para o
   arquivo `frontend/.env.local`:

```bash
cd frontend
cp .env.example .env.local   # no Windows: copy .env.example .env.local
```

Preencha todas as `NEXT_PUBLIC_FIREBASE_*` com os valores do console.

### Passo 5 — Subir o backend Go no Cloud Run

Precisa do **gcloud** instalado e logado:

```bash
gcloud auth login
gcloud config set project SEU_PROJECT_ID
```

Troque `SEU_PROJECT_ID` pelo id do projeto (o mesmo do Firebase). Depois:

```bash
cd backend

# Via gcloud build (não precisa de Docker local):
gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/treino-api

# Publica no Cloud Run (cota gratuita):
gcloud run deploy treino-api \
  --image gcr.io/SEU_PROJECT_ID/treino-api \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --max-instances 1 \
  --memory 128Mi
```

O comando no final mostra a **URL da sua API**. Copie para o `.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://treino-api-XXX-uc.a.run.app
```

> Como o backend roda com a identidade do Cloud Run (Service Account padrão),
> ele já tem acesso ao Firestore do mesmo projeto — sem chaves na mão. 🎉

**Alternativa local (para desenvolver):**

1. Console Firebase → ⚙️ → **Contas de serviço** → **Gerar nova chave privada**
   (baixa um `serviceAccountKey.json`).
2. Rode:
   ```bash
   cd backend
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\serviceAccountKey.json"
   go mod tidy
   go run .
   ```
   A API sobe em `http://localhost:8080`. Ajuste `NEXT_PUBLIC_API_URL=http://localhost:8080`.
3. **Nunca** suba esse JSON para o git (o `.gitignore` já bloqueia).

### Passo 6 — Rodar o frontend local

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:3000, crie uma conta e comece a usar.

### Passo 7 — Publicar o frontend (Cloud Run)

O frontend agora roda como **servidor Node standalone** (rotas dinâmicas e
SSR). A imagem do Docker está em `frontend/Dockerfile`:

```bash
cd frontend
# IMPORTANTE: o build embute as variáveis NEXT_PUBLIC_* — tenha o .env.local
# preenchido antes de publicar.
npm run build

# (opcional) testar o servidor de produção localmente:
#   Copy-Item -Recurse .next\static .next\standalone\.next\static
#   Copy-Item -Recurse public\* .next\standalone\
#   node .next/standalone/server.js   → http://localhost:3000

cd ..
# Publica no Cloud Run com o build na nuvem:
gcloud builds submit frontend --tag gcr.io/SEU_PROJECT_ID/treino-web
gcloud run deploy treino-web \
  --image gcr.io/SEU_PROJECT_ID/treino-web \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --max-instances 1 \
  --memory 512Mi
```

O link final fica em `https://treino-web-XXX-uc.a.run.app`.

> **Atualização do app:** publique novas versões com `gcloud run deploy treino-web`
> usando o mesmo nome de imagem (o Cloud Run atualiza a instância).

### Passo 8 — Propagar as regras do Firestore

```bash
firebase deploy --only firestore
```

---

## Cotas gratuitas (Spark plan)

| Recurso                 | Cota grátis                          | Pra ver isso, use…           |
|-------------------------|--------------------------------------|------------------------------|
| Cloud Run (frontend)    | ~2 milhões de requests/mês + instância grátis | o app de treino inteiro      |
| Firestore               | 1 GiB, 50 mil leituras/dia, 20 mil gravações/dia | só dados de séries, sem foto |
| Cloud Run (API Go)      | ~2 milhões de requests/mês + instância grátis   | perfeito pra esse uso        |
| Authentication          | 50 mil usuários ativos/mês           | conta pessoal / alunos       |

> Dica do Cloud Run: com `--max-instances 1` e `--min-instances 0` a instância
> "dorme" quando ninguém usa (sem cobrança) e acorda na primeira chamada
> (os primeiros ~3s são um pouco mais lentos — normal).

## Aprendizado — o que cada peça te ensina

- **Firebase Auth**: autenticação, tokens JWT, sessão.
- **Firestore**: banco NoSQL, modelos de dados, regras de segurança.
- **Go + Cloud Run**: API REST, containerização (Dockerfile), deploy serverless.
- **Next.js**: React, componentes, SSR/SSG, variáveis de ambiente.
- **JWT no backend**: como um servidor confirma que uma requisição é de um usuário real.

## API (referência rápida)

Todas as rotas exigem `Authorization: Bearer <idToken>` (menos `/health`).

### Fluxo do aluno (original)

| Método | Rota                          | Descrição                                  |
|--------|-------------------------------|--------------------------------------------|
| GET    | `/health`                     | Health check                               |
| GET    | `/api/sessions/{week}/{day}`  | Lê o treino (ex. `/api/sessions/3/tb`)     |
| PUT    | `/api/sessions/{week}/{day}`  | Salva o treino                             |
| GET    | `/api/prs`                    | Lê os recordes pessoais                    |
| PUT    | `/api/prs`                    | Salva os recordes pessoais                 |
| GET    | `/api/state`                  | Lê a última posição (semana/dia)           |
| PUT    | `/api/state`                  | Salva a última posição                     |

### Gestão (nutricionista/admin/aluno) — nova área

| Método | Rota                          | Descrição                                  |
|--------|-------------------------------|--------------------------------------------|
| GET    | `/api/me`                     | Perfil do usuário + role                    |
| PUT    | `/api/me`                     | Cria/atualiza o perfil (setup inicial)      |
| GET/POST | `/api/users`                | Lista/cria usuários (admin)                 |
| GET/PUT/DELETE | `/api/users/{id}`    | Edita/exclui usuário (admin)                |
| GET    | `/api/students`               | Alunos do nutricionista                     |
| GET    | `/api/students/{id}`          | Detalhe de um aluno                         |
| PUT    | `/api/students/{id}`          | Nutricionista edita dados do próprio aluno  |
| GET/POST | `/api/workouts`             | Lista/cria treinos                          |
| GET/PUT/DELETE | `/api/workouts/{id}`  | Edita/exclui treino                         |
| POST   | `/api/workouts/{id}/duplicate`| Duplica treino (para outro aluno)           |
| GET/POST | `/api/diets`               | Lista/cria dietas                           |
| GET/PUT/DELETE | `/api/diets/{id}`    | Edita/exclui dieta                          |
| POST   | `/api/diets/{id}/duplicate`   | Duplica dieta                               |
| GET    | `/api/workout-history`        | Histórico de treinos concluídos             |
| POST   | `/api/workouts/complete`      | Finaliza um treino (gera registro)          |

### Exemplo de payload (PUT /api/sessions/1/ta)

```json
{
  "week": 1,
  "day": "ta",
  "exercise": [
    { "sets": [{ "w": 55, "r": 8, "c": "ok" }], "note": "bom rendimento" },
    { "sets": [] }
  ]
}
```

### Modelo de dados (gestão)

Existe um coleção de **perfis** em `users/{uid}` (nome, email, role, status,
nutritionistID…) e três coleções raiz gerenciadas **somente pela API Go** (o
cliente não as acessa direto — as regras em `firestore.rules` negam):

- `workouts/{id}` — treino com `exercises: [...]` embutido (nome, séries,
  reps, carga, descanso, notas, dia da semana).
- `diets/{id}` — dieta com `meals: [...]` embutido e cada refeição com
  `foods: [...]` (nome, quantidade, unidade, notas).
- `workoutHistory/{id}` — registro de treino concluído (percentual, duração,
  data, exercícios). O aluno marca **séries executadas** (peso/reps) no modal de
  conclusão — elas ficam no campo `exercises` do registro e aparecem no
  histórico do nutricionista (aluno, timeline e exportação CSV em Atividades).

**Papéis** (`role`): `admin` (vê tudo), `nutritionist` (só o que criou),
`student` (só o próprio). O nutricionista gerencia **treinos por dia da
semana** e dietas com **refeições/alimentos**, além de duplicar treinos e
dietas para outros alunos.

> **Primeiro acesso (definir papéis):** todo usuário novo nasce como `student`.
> Para "subir de cargo", edite o perfil dele no console do Firebase
> (Firestore → `users/{uid}` → campo `role`), ou chame a API com um admin já
> existente (painel `/admin`). Sugestão: crie o primeiro admin direto no
> Firestore logo após o primeiro deploy.

## Comandos úteis

```bash
# Frontend
cd frontend && npm run dev     # desenvolvimento
cd frontend && npm run build   # build server (standalone)

# Backend (local, com service account)
cd backend && go run .

# Deploy
# frontend: gcloud builds submit frontend --tag gcr.io/SEU_PROJETO/treino-web
#          gcloud run deploy treino-web --image gcr.io/SEU_PROJETO/treino-web ...
# backend:  gcloud run deploy treino-api
firebase deploy --only firestore
```