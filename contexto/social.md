# Area: SOCIAL e COMUNIDADE

> 30/09/2026 — F2 removeu comunidade, posts automáticos, comentários e curtidas
> do código local. Este documento é histórico. URLs antigas respondem 404;
> posts legados são negados pelas rules, inclusive para admin via SDK.
> Dados de produção preservados. Leia PROJECT_STATE.md para continuar.

## Onde esta o codigo

**API (Go)**
- `backend/service/social.go` — regra de negocio
- `backend/handlers/social.go` — rotas
- `backend/service/public.go` — dados publicos (perfil publico, feed)

**App (aluno)**
- `frontend/app/(aluno)/comunidade/page.tsx`
- `frontend/components/student/StudentCommunityPage.tsx`
- `frontend/components/Feed.tsx`

**App (admin / profissional)**
- `frontend/app/admin/feed/page.tsx` — o mesmo `components/Feed.tsx`, com as
  publicacoes de todos os alunos

**Testes**
- `backend/main_test.go` — like, comentario e apagamento de post pela cadeia HTTP real
- `backend/service/public_test.go` — perfil publico nao expoe campo sensivel
- `firestore-tests/rules.test.js` — leitura de post do feed negada para inativo,
  rejected e pendente

## Conceitos

- Feed mostra post de alunos do mesmo grupo/programa.
- `backend/service/public.go` expoe dado sem autenticacao. Cuidado: e o caminho mais
  sensivel do projeto em termos de privacidade.

## Pendencias

<!-- escreva aqui -->
- [ ] nao existe `backend/service/social_test.go`: o service de social so e
      exercitado pela cadeia em `backend/main_test.go`
- [ ] sem teste de tela para `frontend/components/Feed.tsx` e para
      `frontend/components/student/StudentCommunityPage.tsx`
- [ ] sem E2E de `/comunidade`: em `frontend/e2e/aluno.spec.ts` o feed aparece so
      como link de navegacao, sem interacao

## Cuidado

- Dado publico e dado que qualquer pessoa pode ler. Qualquer campo novo
  em `backend/service/public.go` precisa de revisao explicita antes de ir para producao.
- Firestore: regra de leitura precisa de teste em `firestore-tests/`.
