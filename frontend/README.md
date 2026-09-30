# Frontend — Treino Louise (Next.js)

Frontend do app **Treino Louise** — veja o [`README.md`](../README.md) na raiz
para a visão geral do projeto (backend Go, Firestore e deploy no Cloud Run).

Roda em modo **servidor standalone** (Cloud Run) com rotas dinâmicas
(ex. `/admin/students/[studentId]`).

## Rodando local

```bash
npm install
cp .env.example .env.local   # no Windows: copy .env.example .env.local
npm run dev                  # abre http://localhost:3000
```

## Scripts

| Comando               | O que faz                                          |
|-----------------------|----------------------------------------------------|
| `npm run dev`         | servidor de desenvolvimento (Turbopack)            |
| `npm run build`       | build de produção (standalone)                     |
| `npm run start`       | serve o build de produção (`next start`)           |
| `npm run lint`        | ESLint                                             |
| `npm test`            | Vitest — testes unitários/componentes (99)        |
| `npm run test:e2e`    | Playwright E2E (28 — sobe emuladores + backend + seed) |

## Estrutura

```
app/
  page.tsx            # home: redireciona por papel
  login/              # login (Firebase)
  (aluno)/            # área do aluno: treinos, dietas e programas
  admin/              # área de gestão (admin): painel, alunos, treinos, dietas,
                      #   exercícios, programas e
                      #   usuarios/ (cadastro e planos)
  base.css            # design system global
  dashboard.css       # estilos da área de gestão
  student.css         # estilos da área do aluno
components/           # UI: layouts, cards, modais, formulários, student/
lib/                  # api, auth (roles), configuração, tipos, dias da semana
public/               # ícones, manifest PWA, service worker
```

## PWA

O app é instalável (manifest + service worker em `public/`): precache do
shell, network-first com fallback offline e **nunca cacheia `/api/*`** nem
cabeçalhos `Authorization`. Coberto por testes dedicados (F14.1 — Vitest +
E2E); veja a seção "Validação humana pendente — PWA" em
`docs/reports/phase-15-3-post-migration.md` para o checklist em dispositivo.

## Segurança

- O `next.config.ts` aplica **security headers** em todas as respostas
  (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`).
- Quem autentica é o **backend Go** (Firebase Auth, `Authorization: Bearer
  <token>`) e ele valida papéis (`admin`, `student`) — o
  frontend nunca fala direto com o Firestore.
- O `.gitignore` bloqueia `.env*` e arquivos de chave (`*.pem`, `*.key`,
  `*.p12`, ...): **nunca** versione credenciais.
