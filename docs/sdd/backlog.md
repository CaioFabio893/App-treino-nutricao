# Backlog — SDD

Requisitos mapeados no fluxo SDD: `backlog` → `em_andamento` → `pronto` → `testado` → `revisado`.

| ID | Requisito / Feature | Escopo | Status | Spec / Ref |
|---|---|---|---|---|
| SB-001 | Aprovação de cadastro, papéis, planos (features) e login com Google | Backend (Go: models/repository/service/middleware/handlers/main + firestore.rules) e Frontend (Next.js: auth, login, PendingApproval, admin, planos) | `testado` | `docs/superpowers/specs/gestao-cadastro-papeis-planos-google.md` |

## SB-001 — Gestão de cadastro, papéis, planos e login Google

- **Objetivo**: transformar o app em sistema de gestão com fluxo de aprovação do admin. Usuário novo fica `pending_approval` até o admin definir papel e plano; login/cadastro via Google; sistema de planos (feature entitlements) criados pelo admin.
- **Detalhamento**: ver spec `gestao-cadastro-papeis-planos-google.md`.

### Decisões validadas (seção 7 da spec — confirmadas por Caio em 15/09/2026)

1. Snapshot de features no perfil no momento da atribuição (não leitura em tempo real do plano).
2. Google login com `signInWithPopup`.
3. Rejeição de cadastro: marcar `status=rejected` **e** excluir a conta do Firebase Auth (`admin.auth().deleteUser`) — evitar contas fantasmas; documento Firestore permanece para auditoria.
4. Cadastro: coleta de nome antes da tela de espera (ProfileSetup mantido; `PUT /api/me` cria perfil com `pending_approval`).