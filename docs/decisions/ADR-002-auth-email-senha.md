# ADR-002 — V2 autentica com e-mail/senha apenas (sem Google)

- Status: **Aceito (Fase 0 — decisão de produto; validação no checkpoint)**
- Data: 2026-09-20

## Contexto

A V1 permite login Google (`signInWithPopup`, `googleProvider`) e e-mail/senha.
O plano do V2 (seção 8) determina **e-mail/senha apenas**.

## Decisão

No V2 o login Google **é removido**: tela de login, `googleProvider`,
`loginWithGoogle` e `authProvider == "google.com"` deixam de existir.

## Motivação

- Simplificação (menos fluxos, menos regras), identidade única por e-mail,
  aprovação do admin como única porta de entrada sem contas duplicadas
  (e-mail vs Google para a mesma pessoa) e escopo reduzido de ataque.

## Consequências

- `authProvider` continua como campo (para auditoria) mas só terá `password`.
- Perfis já criados via Google na V1 **permanecem válidos** (mesmo UID);
  apenas o fluxo de criar/entrar com Google some.
- Ajustes no frontend (login, botão Google/divisor) e backend (sem
  `google.com` na lista de providers aceitos) entram na Fase 1.