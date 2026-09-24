# FASE 18 — DEPLOY DA F17 (AUTENTICAÇÃO POR E-MAIL) EM PRODUÇÃO

**Data:** 24 set 2026
**Status:** CONCLUÍDA — deploy do frontend F17 em produção executado, revision saudável (100% tráfego), smoke test de produção verde.
**Autorização:** prompt explícito do dono (FASE 18 — F17 → PRODUÇÃO, execução autônoma completa).
**Modo:** auditoria → testes → build → deploy → validação → documentação. Push = 0. Backend/API/Firestore NÃO alterados.

---

## 1. Objetivo

Colocar a F17 (remoção do Google Login da UI, cadastro com confirmação de senha, mostrar/ocultar senha e recuperação de senha via Firebase Authentication) em produção, validando o fluxo de autenticação completo e deixando a produção com a nova experiência de login.

## 2. Estado inicial

- HEAD: `cb3162d` (`docs: add F17 authentication report`); branch `main`.
- Working tree: apenas `opencode.json` (M) e `.opencode/agent-routing.md` (??) — config local, fora do Git por governança.
- Frontend em produção (antes do deploy): revisão `treino-web-00009-mfg` (F15.2) — ainda com botão Google na UI de login.
- Backend em produção: `treino-api-00013-867` — **intocado nesta fase** (F17 é frontend-only).

## 3. Commits encontrados (fase F17)

| Commit | Mensagem |
|---|---|
| `0ea6746` | feat(frontend): remove Google login and add signup with password confirmation and password recovery |
| `c99abea` | test(frontend): cover auth flows — no Google login, signup confirmation, password recovery and show/hide |
| `cb3162d` | docs: add F17 authentication report |

## 4. Auditoria da implementação

Releitura do código real (não apenas relatórios):

- `app/login/page.tsx` — e-mail/senha via `signInWithEmailAndPassword`; `PasswordInput` com toggle; links "Esqueci minha senha" (→ /recuperar-senha) e "Criar nova conta" (→ /cadastro); loading "Aguarde…"; erros amigáveis via `friendlyAuthError`; redirecionamento pós-login; **zero Google na UI** (grep em `app/` só encontra comentário de fonte em `layout.tsx`).
- `app/cadastro/page.tsx` — e-mail + senha + confirmação com 2 `PasswordInput` independentes; validação client-side (e-mail, mín. 6, "As senhas não coincidem.") com revalidação ao vivo pós-1º submit; `aria-invalid`/`aria-describedby`/`role="alert"`; `noValidate`; link de retorno.
- `app/recuperar-senha/page.tsx` — `sendPasswordResetEmail` via `resetPassword()`; sucesso genérico anti-enumeração (`user-not-found`/`missing-email` → mensagem positiva); estados inválido/rede/invalid-email; loading; retorno ao login.
- `components/PasswordInput.tsx` — `type=button` real, `aria-label` dinâmico ("Mostrar senha"/"Ocultar senha"), estado por instância, SVG decorativo `aria-hidden`, `font-size:16px`, `name=id`.
- `lib/auth.tsx` — `loginWithGoogle`/`signInWithPopup` removidos; `resetPassword` adicionado.
- `lib/firebase.ts` — `GoogleAuthProvider`/`googleProvider` removidos; apenas `getAuth`/`connectAuthEmulator`.
- `lib/auth-errors.ts` — mapeamento amigável PT; `friendlyResetError` retorna `null` para `user-not-found`/`missing-email` (anti-enumeração).
- Segurança: senha nunca em logs/URL/localStorage/sessionStorage (localStorage só para timestamp/demo/rascunhos, sem relação com senha); tokens via `getIdToken()` apenas no header `Authorization`; sem bypass de pending approval/autorização.
- Compatibilidade V1: backend (intocado) segue aceitando `authProvider` `"password" | "google.com"`; `PendingApprovals.tsx` exibe provedor legado como dado (não é UI de login); nenhum usuário/registro V1 foi removido ou migrado.

## 5. Problemas encontrados

Nenhum problema de código na F17. Um único "FAIL" no smoke test foi **erro do próprio script de validação** (usou `/manifest.webmanifest`; o PWA serve `/manifest.json` → 200) — sem impacto.

## 6. Correções

Nenhuma correção de código necessária. Nenhuma alteração fora do escopo.

## 7. Testes (executados nesta fase)

| Suíte | Comando | Resultado |
|---|---|---|
| Go | `go test -p 1 ./... -count=1` (+ `-v` p/ contagem) | ✅ **147/147** |
| go vet | `go vet ./...` | ✅ PASS |
| Vitest | `npm test` | ✅ **98/98** |
| TypeScript | `npx tsc --noEmit` | ✅ PASS |
| Build | `npm run build` | ✅ PASS (25 rotas: `/login`, `/cadastro`, `/recuperar-senha` presentes) |
| Lint | `npm run lint` | ✅ PASS (0/0) |
| Playwright E2E | `npm run test:e2e` (emuladores + seed + API Go :8081) | ✅ **29/29** |

## 8. Build (Cloud Build)

- Comando: `gcloud builds submit frontend --config frontend/cloudbuild.yaml --ignore-file …` (ignore temporário fora do repo p/ não subir `node_modules`/`.next`/`.env*.local`).
- Build ID: `cbffe936-8099-4b9f-bbab-c97dbe69119d` — **SUCCESS**, duração 2M26S.
- Imagem: `southamerica-east1-docker.pkg.dev/treino-louise/treino-web/treino-web:latest`, digest `sha256:ce9476d024fc950f8b1771d6889952c9d6c5dec262a90ee8ff0298426126cf56`.
- Build args (config pública do Firebase Web SDK, extraída do bundle de produção — mesma origem da F15.2; **apiKey [REDACTED]**): `NEXT_PUBLIC_API_URL=https://treino-api-834622951375.southamerica-east1.run.app`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=treino-louise.firebaseapp.com`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=treino-louise`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=treino-louise.firebasestorage.app`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=834622951375`, `NEXT_PUBLIC_FIREBASE_APP_ID=1:834622951375:web:fd5f73b4f2aaefffc38cba`. `NEXT_PUBLIC_DEMO` NÃO foi passado (e `.env.local` foi excluído do contexto de upload/build via `.dockerignore` `.env*.local`).

## 9. Deploy

- Comando: `gcloud run deploy treino-web --image=…/treino-web:latest --region southamerica-east1 --project treino-louise` (sem env vars — valores públicos embutidos na imagem, por design).
- Resultado: `Done.` — nova revisão servindo **100% do tráfego**.

## 10. Cloud Run

| Item | Valor |
|---|---|
| Projeto | `treino-louise` |
| Serviço | `treino-web` |
| Região | `southamerica-east1` |
| Revisão ativa | `treino-web-00010-nhv` (latestReady, condição True, 100% tráfego) |
| Imagem | `southamerica-east1-docker.pkg.dev/treino-louise/treino-web/treino-web:latest` (digest `ce9476d…`) |
| Revisão anterior | `treino-web-00009-mfg` (True, retida — rollback manual possível) |

## 11. Revision

`treino-web-00010-nhv` — criada 2026-09-24T23:51:30Z, condição `True`, serving 100% do tráfego (confirmado em `gcloud run revisions list` e na saída do deploy).

## 12. URL

- Canônica: `https://treino-web-834622951375.southamerica-east1.run.app` (raiz `/` retorna 200, CSP com connect-src, `X-Content-Type-Options: nosniff`).
- Alias: `https://treino-web-jn4epizxfq-rj.a.run.app`.

## 13. Smoke tests (produção, após deploy)

Validados via Playwright headless contra a URL real (somente casos seguros — nenhum usuário real criado, nenhum e-mail real enviado):

| Smoke | Resultado |
|---|---|
| `/login` carrega com botão Entrar | ✅ |
| Ausência de botão Google em `/login` | ✅ (contagem 0) |
| Ausência de texto Google em `/login` | ✅ |
| Links "Esqueci minha senha" e "Criar nova conta" | ✅ |
| Toggle mostrar/ocultar senha (password→text→password) | ✅ |
| `/cadastro` carrega com campo "Confirmar senha" | ✅ |
| Cadastro com senhas diferentes bloqueado ("As senhas não coincidem.") | ✅ (sem chamada de rede — permanece em /cadastro) |
| `/recuperar-senha` e-mail inválido bloqueado ("E-mail inválido.") | ✅ (client-side) |
| `/recuperar-senha` campo vazio bloqueado ("Informe seu e-mail.") | ✅ (client-side) |
| PWA manifest (`/manifest.json`) | ✅ 200, `application/json`, name "Treino Ciclo 2 - Louise Lima", display standalone |
| PWA `sw.js` | ✅ 200, `Service-Worker-Allowed: /` |
| HTML referencia `manifest.json` | ✅ |

> Nota: `/manifest.webmanifest` é 404 (o app usa `/manifest.json`) — não é regressão; é o caminho versionado no projeto.

## 14. Autenticação (produção)

- **Login:** página serve a nova UI sem Google; e-mail/senha com toggle; links de recuperação/criação de conta; erros amigáveis. Login **efetivo** com credenciais reais é validação manual (ver §24) — não foram usadas credenciais reais nesta fase.
- **Cadastro:** página nova servida com confirmação de senha; bloqueio de mismatch confirmado em produção (client-side, sem criar usuário). Criação real de conta em produção = validação manual (não se criam usuários reais automaticamente).
- **Recovery:** página nova servida; validações client-side confirmadas sem disparar e-mails reais. Envio real de e-mail de recuperação = validação manual.

## 15. Cadastro

Fluxo completo validado em ambiente de teste (E2E 29/29, Auth Emulator): senhas iguais → cria conta → perfil nasce `pending_approval` → admin aprova → acesso ao dashboard (spec `zz-aprovacao.spec.ts`). No smoke de produção, apenas o bloqueio de senhas diferentes foi exercitado (sem criar dados).

## 16. Recovery

`sendPasswordResetEmail` é a API oficial utilizada (`lib/auth.tsx`). Casos A/B (e-mail existente/inexistente → mesma resposta genérica) cobertos por testes unitários e E2E no emulador, e em produção foram validados os bloqueios client-side (inválido/vazio). Nenhum e-mail real foi enviado nesta fase.

## 17. Google Login

Ausente da UI de produção: o HTML renderizado e o DOM validado por Playwright não contêm botão, divisor, texto ou chamada de login Google. Os imports `signInWithPopup`/`GoogleAuthProvider`/`googleProvider` foram removidos do código na F17. Grep em `frontend/app` e `frontend/lib` confirma.

## 18. Compatibilidade V1

- Backend (`treino-api-00013-867`) **não foi alterado** nesta fase; continua reconhecendo `authProvider` `"google.com"` (e `"password"`).
- Nenhum usuário V1 foi removido, migrado ou alterado; nenhum provider foi desabilitado.
- `PendingApprovals.tsx` segue exibindo o provedor legado como dado informativo.
- Usuários V1 Google continuam logando e/ou podem definir senha via "Esqueci minha senha" (comunicar é questão de produto/ops, informativo).

## 19. PWA

`/manifest.json` 200 (conteúdo completo, standalone), `sw.js` 200 com `Service-Worker-Allowed: /`, HTML referencia o manifest. Sem alterações de PWA na F17 — comportamento mantido da F14/F14.1. Validação em dispositivo real = manual (§24).

## 20. Segurança (pós-deploy)

- Nenhum secret publicado: a API key usada no build é **config pública do Firebase Web SDK**, extraída do bundle público (mesma origem da F15.2); nenhum valor sensível foi incluído em código/relatório.
- Sem `.env` publicado (`.env*.local` excluído do contexto de build; serviço Cloud Run sem env vars).
- Senha: não aparece em URL, logs ou storage; confirmação não é persistida.
- Tokens: apenas em header `Authorization` via `getIdToken()`; sem hardcode.
- Anti-enumeração: recuperação com resposta genérica para conta inexistente; login com mesma mensagem para credencial inválida.
- Autorização/pending approval: sem alterações (backend/regras intocados).
- Google não retornou à interface.

## 21. Git

- HEAD após a fase: `cb3162d` (o deploy não altera o Git local).
- Trabalho desta fase: nenhum código alterado; somente o relatório F18 criado (ver §22/§23).
- `opencode.json` e `.opencode/agent-routing.md`: permanecem fora do commit (config local, governança).
- Push: **NÃO realizado**. Deploy: **REALIZADO** (frontend apenas).

## 22. Commits criados

Nenhum commit de código. Commit de documentação (este relatório): `docs: add F18 deployment report` (ver §23).

## 23. Git — verificação final

- `git status`: ` M opencode.json`, `?? .opencode/agent-routing.md`, `?? docs/reports/phase-18-deploy-f17.md` (antes do commit do relatório).
- Commit documental realizado: `docs: add F18 deployment report` — contém somente `docs/reports/phase-18-deploy-f17.md`.
- Sem push. Sem secrets no relatório.

## 24. Pendências / validações manuais (não bloqueiam o deploy da F17)

1. **Validação humana da Louise (produção):** login real com conta real (fluxo de aluno/dashboard), cadastro real de conta nova (gera pedido aprovação → aprovação pelo admin) e recuperação com e-mail real entregue.
2. **PWA em dispositivo real** (instalação/offline).
3. **Ação manual F16 (pré-existente):** restrição por referrer / rotação da Firebase API Key pública (no histórico Git) — permanece separada, não executada nesta fase (fora do escopo, conforme instruções).
4. **Informativo:** usuários V1 Google sem senha usarão "Esqueci minha senha" no primeiro acesso pela nova UI; comunicar alunos legados é consideração de produto/ops.
5. **Smoke de produção automatizado desta fase** cobre páginas/validações client-side; fluxos que gravam dados reais (signup/login/recovery com Firebase real) ficam por conta das validações manuais acima — por design, sem criação de dados reais automatizada.

## 25. Resultado final

A F17 está **em produção** (revisão `treino-web-00010-nhv`, 100% tráfego), com a nova experiência de autenticação servida: login sem Google, cadastro com confirmação de senha, mostrar/ocultar senha e recuperação via Firebase com anti-enumeração. Todas as suítes verdes localmente (147 Go, 98 Vitest, 29 E2E, tsc/build/lint/vet), smoke de produção verde nos fluxos validáveis sem dados reais, compatibilidade V1 preservada e backend/Firestore intocados. Validações que exigem dados/credenciais reais permanecem manuais (§24).

**Classificação:** `PARTIAL — DEPLOY CONCLUÍDO, VALIDAÇÃO MANUAL PENDENTE` (deploy técnico concluído e saudável; permanecem apenas as validações humanas de produção que dependem de credenciais/dados reais do dono).