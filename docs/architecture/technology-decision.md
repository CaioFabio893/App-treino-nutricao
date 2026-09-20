# Decisão tecnológica — Treino & Nutrição V2

Status: **Consultado e aprovado na Fase 0** — registro: `docs/decisions/ADR-001-stack.md`.
Aplicável a: toda a implementação do V2.

## Contexto

O V2 é um rebuild profissional do app "Treino & Nutrição". A V1 roda em
produção com:

- **Frontend**: Next.js 16.3.5 (React 19.2.8, TypeScript) — Cloud Run (standalone).
- **Backend**: API REST em Go 1.23 — Cloud Run (South America East 1).
- **Banco**: Firestore (NoSQL) + Firebase Auth (e-mail/senha e Google).
- **Regras/índices**: `firestore.rules` + 9 índices compostos.

O V2 poderia manter essa stack (menor risco, migração incremental) ou trocar
alguma camada. Esta decisão precisa ser **técnica e registrada**, não
"manter porque já existe".

## Critérios de avaliação (do plano do projeto, seção 4)

1. **Correção** — tipagem que impeça bugs; testes.
2. **Segurança** — auth robusta (JWT), regras de banco, hardening HTTP.
3. **Testabilidade** — TDD viável em todas as camadas.
4. **Manutenibilidade** — separação de responsabilidades, legibilidade.
5. **Simplicidade** — mínimo de peças móveis para o tamanho do produto.
6. **Performance** — latência aceitável em mobile (4G) e sem servidor ocioso.
7. **Velocidade de desenvolvimento** — produtividade da equipe (indivíduo único).
8. **Custo** — camada gratuita do Google Cloud (Spark plan).

## Candidatos

| Camada | Opção A (escolhida) | Opção B |
|---|---|---|
| Backend | **Go 1.23** | TypeScript/Node.js (Fastify/Nest) |
| Frontend | **Next.js 16** (React 19 + TS) | Vite + React SPA estática |
| Banco | **Firestore** | PostgreSQL (Supabase) |
| Auth | **Firebase Auth (e-mail/senha)** | Auth próprio (JWT/BCrypt) |

## Decisão

**Manter Go + Next.js + Firestore + Firebase Auth**, com corte do login
Google (V2 é e-mail/senha apenas — decisão de produto, ver
`docs/decisions/ADR-002-auth-email-senha.md`).

Justificativa resumida:

### 1. Backend — Go > Node.js

- **Correção/segurança**: Go é compilado, com `go vet`, `go test` e
  `http.ServeMux` com rotas tipadas (Go 1.22+). A V1 já tem **77 testes**
  incluindo cadeia de autorização completa com fakes (sem Firebase real)
  em `main_test.go` — prova de que o TDD de backend funciona neste formato.
- **Performance**: Go é um dos melhores em latência p99 para APIs simples e
  tem runtime de baixa memória (a V1 roda com `--memory 128Mi`).
- **Simplicidade**: sem runtime JS no servidor de API; binário único, deploy
  trivial no Cloud Run; stdlib cobre 95% das necessidades.
- **Risco de migração**: trocar Go → Node seria reescrever 77 testes e toda a
  camada de service/repository com o único ganho de "mesma linguagem do
  frontend" — que **não** é critério técnico para este tamanho de produto e
  atrapalha a prioridade Simplicidade.
- **Curva**: o dono do projeto já domina a V1 em Go — manter acelera a Fase 1+.

*Contraponto honesto*: Node.js reduziria o custo de contexto entre camadas
para um único dev fullstack TS. Este ganho é real, mas **não supera**
correção/testabilidade/manutenibilidade já provadas em Go neste repo.

### 2. Frontend — Next.js (server) > SPA estática

- **Rotas dinâmicas reais** (`/nutritionist/students/[studentId]`) exigem
  servidor Node — a V1 já usa `output: "standalone"` e funciona.
- **SSR/SSG** ajudam SEO/UX e permitem `next/font` self-hosted (privacidade,
  performance, PWA offline).
- **Manutenibilidade**: App Router + React Server Components + TS satisfazem
  a camada de apresentação sem introduzir um segundo framework.
- V2 **adiciona** o que falta: Vitest + Playwright (testes) e design system
  consistente (docs/design/design-system.md).

### 3. Banco — Firestore > PostgreSQL

- **Escala/custo**: Firestore cabe na camada gratuita; o volume do app (dezenas
  de alunos, treinos/dietas/histórico) está muito abaixo dos limites (1 GB,
  50k leituras/dia).
- **Integração**: Admin SDK + React Admin Firebase já dominados; regras de
  segurança testáveis com Emulator na V2 (não existe hoje).
- **Simplicidade**: evita migrar schema relacional, restrições de row-level
  security e o custo/ops de um Postgres gerenciado para um produto deste porte.
- **Mitigação de desvantagens**: queries exigem índices compostos (já mapeados
  em `firestore.indexes.json` — 9); a V2 os **testa com Emulator** e os
  sincroniza com o código (evita o `FAILED_PRECONDITION: requires index` visto
  em produção na V1 com o endpoint de diet-logs).

### 4. Auth — Firebase Auth (e-mail/senha)

- Já validado em produção; tokens JWT verificados no backend (`VerifyIDToken`);
  cara de custo zero (50k usuários/mês).
- **V2 remove Google** (ADR-002) — decisão do dono do projeto, simplifica
  regras, `authProvider` e o risco de contas duplicadas (e-mail vs Google).
- Auth próprio não se justifica: reimplementar password reset, MFA, bloqueio,
  hashing (BCrypt) e revogação seria violar Segurança/Simplicidade.

## Consequências

1. A migração V1→V2 é **incremental por camada** (não greenfield total):
   backend vira fonte da verdade; frontend é reconstruído com design system;
   modelo de dados evolve com versão/`migrations` controlada.
2. **Registros**:
   - `docs/decisions/ADR-001-stack.md`
   - `docs/decisions/ADR-002-auth-email-senha.md`
   - `docs/decisions/ADR-003-timezone-america-recife.md` (já na V1, formalizado)
3. Nada é committado sem autorização (governança do projeto).

## Alternativas rejeitadas e por quê

| Alternativa | Motivo da rejeição |
|---|---|
| Backend em Node/Fastify | Reescreve 77 testes sem ganho técnico; fere Simplicidade/Manutenibilidade |
| Vite SPA estático | Perde rotas dinâmicas/SSR; PWA e hospedagem ficam mais complexos |
| Supabase/Postgres | Custo/ops maiores; migração de regras + índices sem ganho para o porte |
| Auth próprio | Reimplementa segurança sensível sem necessidade (Firebase cobre) |
| MongoDB/outro NoSQL | Firestore já cobre; trocar só por gosto novo viola Correção/Risco |