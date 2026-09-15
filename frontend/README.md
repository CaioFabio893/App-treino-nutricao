# Frontend — Treino Louise (Next.js)

Frontend do app **Treino Louise** — veja o [`README.md`](../README.md) na raiz
para a visão geral do projeto (backend Go, Firestore e deploy no Cloud Run).

Roda em modo **servidor standalone** (Cloud Run) com rotas dinâmicas
(ex. `/nutritionist/students/[studentId]`).

## Rodando local

```bash
npm install
cp .env.example .env.local   # no Windows: copy .env.example .env.local
npm run dev                  # abre http://localhost:3000
```

### Modo demo (sem Firebase)

No `.env.local`, basta:

```
NEXT_PUBLIC_DEMO=1
```

O app simula o backend Go inteiro em memória/localStorage (sem rede), com
dados de exemplo — login, treinos, dietas, feed, ranking e painel do
nutricionista funcionam. Troque para `NEXT_PUBLIC_DEMO=0` quando for conectar
o Firebase de verdade (preencha as `NEXT_PUBLIC_FIREBASE_*` e
`NEXT_PUBLIC_API_URL` conforme o guia da raiz).

## Scripts

| Comando         | O que faz                                          |
|-----------------|----------------------------------------------------|
| `npm run dev`   | servidor de desenvolvimento (Turbopack)            |
| `npm run build` | build de produção (standalone)                     |
| `npm run start` | serve o build de produção (`next start`)           |
| `npm run lint`  | ESLint                                             |

## Estrutura

```
app/
  page.tsx            # home: redireciona por papel (demo)
  login/              # login (Firebase)
  (aluno)/            # área do aluno: treinos, dietas, comunidade
  nutritionist/       # painel: alunos, treinos, dietas, feed, ranking, timeline, CSV
  admin/              # gestão de usuários
  profile/[id]/       # perfil público
  base.css            # design system global
  dashboard.css       # estilos da área de gestão
  student.css         # estilos da área do aluno
components/           # UI: layouts, cards, modais, formulários, student/
lib/                  # api, auth (roles), configuração, tipos, dias da semana
public/               # ícones, manifest PWA, service worker
```

## Segurança

- O `next.config.ts` aplica **security headers** em todas as respostas
  (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`).
- Quem autentica é o **backend Go** (Firebase Auth, `Authorization: Bearer
  <token>`) e ele valida papéis (`admin`, `nutritionist`, `student`) — o
  frontend nunca fala direto com o Firestore.
- O `.gitignore` bloqueia `.env*` e arquivos de chave (`*.pem`, `*.key`,
  `*.p12`, ...): **nunca** versione credenciais.