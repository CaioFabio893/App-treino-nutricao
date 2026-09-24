# FASE 17 — AUTENTICAÇÃO POR E-MAIL, CADASTRO E RECUPERAÇÃO DE SENHA

**Data:** 24 set 2026
**Branch:** `main` (HEAD `c99abea`)
**Escopo:** Implementação do fluxo de autenticação por e-mail/senha no frontend — remoção do Google Login da UI, cadastro com confirmação de senha, mostrar/ocultar senha e recuperação de senha via Firebase Auth.
**Tarefa origem:** `C:\Users\caiof\OneDrive\Desktop\1.txt` (fases 1–24).

---

## 1. Objetivo

Implementar no frontend a autenticação por e-mail e senha, conforme decisão ADR-002, com os seguintes entregáveis:

- **Login** (`/login`): e-mail/senha; remoção total do botão/divisor Google da UI; link "Esqueci minha senha" (→ `/recuperar-senha`); link "Criar nova conta" (→ `/cadastro`); toggle mostrar/ocultar senha; erros amigáveis via `friendlyAuthError`.
- **Cadastro** (`/cadastro`, novo): e-mail + senha + confirmação de senha (dois `PasswordInput`s independentes); validação "As senhas não coincidem." exibida apenas após o primeiro submit e depois ao vivo; integração com fluxo de pending approval (perfil nasce `pending_approval`).
- **Recuperação de senha** (`/recuperar-senha`, novo): `sendPasswordResetEmail` via `resetPassword()` em `lib/auth.tsx`; mensagem de sucesso genérica (anti-enumeração); estados de loading, erro e retorno ao login.
- **Remoção do Google Login da UI**: `loginWithGoogle`/`signInWithPopup` removidos de `lib/auth.tsx`; `googleProvider` removido de `lib/firebase.ts`.

---

## 2. Escopo

| Campo | Valor |
|---|---|
| Frontend | **Alterado** (novas páginas, componentes, libs, CSS, testes) |
| Backend Go | **NÃO alterado** |
| Firestore | **NÃO alterado** |
| Regras Firestore | **NÃO alteradas** |
| Modelo de autorização | **NÃO alterado** |
| Compatibilidade V1 | **Preservada** |

A F17 é uma implementação exclusivamente no frontend. O backend Go continua aceitando `password` e `google.com` como provedores de auth válidos. Nenhuma regra de segurança, coleção ou índice do Firestore foi modificado.

---

## 3. Arquivos modificados

### Commit `0ea6746` (feat)

```
docs/progress.md                      (referência F17 atualizada)
frontend/app/base.css                 (login-wrap, login-card, pw-field, pw-toggle, forgot-link, field-err, login-ok, recover-hint, etc.)
frontend/app/cadastro/page.tsx        (NOVO — cadastro com confirmação de senha)
frontend/app/login/page.tsx           (alterado — remoção do Google, adição de links e PasswordInput)
frontend/app/recuperar-senha/page.tsx (NOVO — recuperação de senha)
frontend/components/PasswordInput.tsx (NOVO — mostrar/ocultar senha)
frontend/lib/auth-errors.ts           (NOVO — friendlyAuthError e friendlyResetError)
frontend/lib/auth.tsx                 (alterado — resetPassword(), remoção de loginWithGoogle/signInWithPopup)
frontend/lib/firebase.ts              (alterado — remoção de googleProvider)
```

### Commit `c99abea` (test)

```
frontend/__tests__/auth-demo.test.tsx   (remoção de 1 linha: googleProvider mock)
frontend/__tests__/auth-errors.test.ts  (NOVO)
frontend/__tests__/login-page.test.tsx  (NOVO)
frontend/__tests__/password-input.test.tsx (NOVO)
frontend/__tests__/recover-page.test.tsx (NOVO)
frontend/__tests__/signup-page.test.tsx (NOVO)
frontend/e2e/auth.spec.ts               (alterado — +5 testes F17)
frontend/e2e/helpers.ts                 (alterado — +função signup())
```

Sem arquivos **removidos**. Sem mudanças em backend Go, regras Firestore, auth ou contratos de API.

---

## 4. Login

A tela de login (`/login`) passa a funcionar exclusivamente com e-mail e senha:

- **Google removido da UI**: nenhum botão, texto ou divisor "Google" é renderizado. O `auth-demo.test.tsx` teve o mock `googleProvider: undefined` removido em consequência.
- **"Esqueci minha senha"**: link com `href="/recuperar-senha"` posicionado ao lado do campo de senha (`.forgot-link`).
- **"Criar nova conta"**: link com `href="/cadastro"` posicionado abaixo do formulário (`.mode-switch-link`).
- **Mostrar/ocultar senha**: `PasswordInput` com botão `<button type="button" aria-label="Mostrar senha"/>\Ocultar senha>` (SVG olho); estado de visibilidade independente por instância.
- **Erros amigáveis**: qualquer código de erro do Firebase Auth é mapeado por `friendlyAuthError()` para mensagem em PT (ex.: `auth/invalid-credential` → "E-mail ou senha incorretos.").
- **Estado de loading**: botão fica "Aguarde…" e `disabled` enquanto a autenticação está em andamento.

---

## 5. Cadastro

A tela de cadastro (`/cadastro`) é uma nova página com os seguintes comportamentos:

- **Três campos**: e-mail, senha e confirmação de senha — cada um com `PasswordInput` independente (estado de visibilidade separado).
- **Validação "As senhas não coincidem."**: exibida **apenas após o primeiro submit** do formulário. Antes disso, o campo de confirmação não mostra erro ao ser digitado vazio. Após a primeira tentativa, a validação ocorre **ao vivo** a cada tecla (revalidação imediata sem novo submit).
- **Bloqueio de envio**: se senhas divergentes, o `handleSubmit` retorna antes de chamar o Firebase (`Object.keys(next).length > 0`).
- **Acessibilidade**: `htmlFor`/`id` pareados em todos os campos; `aria-invalid` e `aria-describedby` no input de confirmação quando há erro; `role="alert"` nas mensagens de erro; `noValidate` no formulário.
- **Pending approval**: o cadastro via `createUserWithEmailAndPassword` cria o usuário no Firebase Auth, e o perfil é criado no backend como `pending_approval` (fluxo existente preservado).
- **Erros do Firebase**: `auth/email-already-in-use` → "Esse e-mail já está cadastrado."; `auth/weak-password` → "Senha muito fraca (mínimo 6 caracteres)."; demais via `friendlyAuthError`.

---

## 6. Recuperação de Senha

A tela de recuperação (`/recuperar-senha`) é uma nova página:

- **`sendPasswordResetEmail`**: implementada em `lib/auth.tsx` como `resetPassword(email)` → chama `sendPasswordResetEmail(firebaseAuth, email)`.
- **Anti-enumeração**: `auth/user-not-found` e `auth/missing-email` retornam `null` via `friendlyResetError()`, que é tratado como **sucesso genérico** — o usuário vê "Se o e-mail estiver cadastrado, enviaremos as instruções..." independentemente de a conta existir.
- **Validação**: e-mail vazio → "Informe seu e-mail."; e-mail inválido → "E-mail inválido." (bloqueado antes de chamar o Firebase).
- **Loading**: botão "Enviar" → "Enviando…" com `disabled` durante o envio.
- **Erro de rede**: `auth/network-request-failed` → "Falha de conexão. Verifique sua internet e tente novamente."
- **Sucesso**: mensagem com `role="status"`, hint sobre caixa de spam, e link "Voltar para o login" (`/login`).
- **Nenhuma senha, token ou credencial** é exposta na URL, nos logs, no localStorage ou sessionStorage.

---

## 7. Acessibilidade (a11y)

Todos os inputs e componentes da F17 seguem os critérios WCAG 2.2:

- **`htmlFor`/`id` pareados**: todos os campos de e-mail, senha e confirmação possuem labels associados (ex.: `htmlFor="cadastro-email"`, `id="cadastro-email"`).
- **`aria-invalid`/`aria-describedby`**: inputs com erro recebem `aria-invalid="true"` e `aria-describedby` apontando para o elemento de mensagem de erro correspondente.
- **`role="alert"`**: mensagens de erro de validação (campo e formulário) possuem `role="alert"` para anúncio imediato por leitores de tela.
- **`role="status"`**: mensagem de sucesso da recuperação de senha possui `role="status"`.
- **Botão de mostrar/ocultar**: `<button type="button">` com `aria-label` dinâmico ("Mostrar senha"/"Ocultar senha"); `focus-visible` com `outline: 2px solid var(--terra)`; alvo de toque ~40px (`width: 40px; height: 40px`).
- **Teclado**: toda a navegação é feita via tab e enter; o `noValidate` nativo do HTML é combinado com validação JavaScript para feedback visual consistente.
- **Touch targets**: `.pw-toggle` (40×40px), `.btn-p` e `.mode-switch-link` com áreas de toque adequadas.
- **Inputs 16px**: todos os inputs de texto/senha possuem `font-size: 16px` para evitar zoom automático no mobile.

---

## 8. Segurança

- **Senhas não persistidas**: o frontend nunca armazena senhas em localStorage, sessionStorage, URL ou logs. O estado é mantido apenas em memória (React `useState`).
- **Recuperação oficial do Firebase**: `sendPasswordResetEmail` é o mecanismo oficial do Firebase Auth; nenhuma lógica customizada de reset de senha é implementada.
- **Anti-enumeração**: `auth/user-not-found` e `auth/missing-email` são tratados como sucesso, impedindo a descoberta de quais e-mails estão registrados.
- **Nenhuma regra Firestore alterada**: as regras de segurança permanecem idênticas às da fase anterior (64/64 testadas).
- **Nenhuma mudança no modelo de autorização**: roles, ownership e permissões continuam as mesmas.
- **`NEXT_PUBLIC_FIREBASE_API_KEY`**: trata-se de uma config **pública do Firebase Web Client SDK** (usada para inicializar o Firebase Auth no navegador). **Não é uma credencial privada**. A questão da chave pública no histórico git (detectada na F15.2/F16 como `[REDACTED]`) permanece como pendência da F16 (referrer restriction + rotação) e **não foi resolvida nesta fase**.
- **CORS/Hardening**: configuração de produção existente (`ALLOWED_ORIGIN` obrigatório, `RATE_LIMIT` validado) é herdada e preservada; nenhuma alteração necessária.

---

## 9. Compatibilidade com V1

- **Usuários V1 com provider `google.com`**: continuam sendo reconhecidos pelo backend Go (que aceita `password|google.com`). O provedor Google permanece válido no backend.
- **Google removido da NOVA UI**: a interface de login não expõe mais o botão/divisor Google; porém, o código backend continua a aceitar login Google para contas existentes.
- **Registros V1 não removidos**: nenhum dado de usuário V1 foi alterado ou excluído.
- **Pending approval intacto**: o fluxo de aprovação de novos cadastros continua funcionando normalmente (perfil nasce `pending_approval`).
- **`PendingApprovals.tsx`**: mantém o rótulo "login Google" **apenas para exibição de contas legadas V1** (`authProvider === "google.com"`); não é UI de login da F17.
- **NÃO houve migração de usuários Google para senha**: nenhum usuário foi convertido ou notificado. A mudança é exclusivamente na UI de login.

---

## 10. Testes

### Vitest (98/98 — +35 novos testes)

| Arquivo | Tipo | O que cobre |
|---|---|---|
| `frontend/__tests__/auth-errors.test.ts` | NOVO | `friendlyAuthError`: mapeia `auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found` → "E-mail ou senha incorretos."; `auth/email-already-in-use` → "Esse e-mail já está cadastrado."; `auth/weak-password` → "Senha muito fraca"; `auth/invalid-email` → "E-mail inválido."; `auth/too-many-requests` → "Muitas tentativas"; `auth/network-request-failed` → "Falha de conexão."; fallback para código desconhecido. `friendlyResetError`: `auth/user-not-found`/`auth/missing-email` → `null` (anti-enumeração); `auth/invalid-email`, `auth/network-request-failed`, `auth/too-many-requests` → mensagens exibíveis; fallback. |
| `frontend/__tests__/login-page.test.tsx` | NOVO | Renderização do formulário de login com links de cadastro/recuperação; **ausência de Google** (botão, texto, divisor); login válido chama `login(email, senha)`; login inválido mostra erro amigável; estado de loading ("Aguarde…" disabled); alternância mostrar/ocultar senha. |
| `frontend/__tests__/password-input.test.tsx` | NOVO | Renderização como `type="password"` com botão "Mostrar senha"; alternância mostrar→ocultar com `aria-label` dinâmico; **estado independente entre instâncias** (senha e confirmação); `aria-invalid`/`aria-describedby`; placeholder; onChange com valor acumulado. |
| `frontend/__tests__/recover-page.test.tsx` | NOVO | Renderização do campo de e-mail, botão Enviar, link de retorno ao login; validação de e-mail inválido/vazio; e-mail válido chama `resetPassword(email)` e mostra sucesso (anti-enumeração); loading ("Enviando…" disabled); erro de rede; e-mail inexistente → sucesso genérico; link de volta ao login no estado de sucesso. |
| `frontend/__tests__/signup-page.test.tsx` | NOVO | Renderização de e-mail/senha/confirmação com link de volta ao login; toggles independentes de mostrar/ocultar; **sem erros antes da interação**; bloqueio quando senhas diferentes (erro "As senhas não coincidem." com `role="alert"` e `aria-describedby`); validação de confirmação vazia; validação de e-mail inválido; cadastro com senhas iguais chama `signup(email, senha)`; erro de e-mail em uso; **revalidação ao vivo** após primeira tentativa. |
| `frontend/__tests__/auth-demo.test.tsx` | ALTERADO | Remoção do mock `googleProvider: undefined` (consequência da remoção do Google Login). |

### Playwright E2E (29/29 — +5 novos testes)

| Arquivo | Teste novo | O que cobre |
|---|---|---|
| `frontend/e2e/auth.spec.ts` | "tela de login não mostra Google" | Google ausente da UI; links "Criar nova conta" e "Esqueci minha senha" visíveis; mostrar/ocultar senha funciona. |
| `frontend/e2e/auth.spec.ts` | "cadastro: senhas diferentes bloqueiam o envio" | Erro "As senhas não coincidem." visível; permanece na tela de cadastro. |
| `frontend/e2e/auth.spec.ts` | "cadastro: senhas iguais criam o pedido de conta" | Cadastro bem-sucedido com Auth Emulator; redireciona para ProfileSetup. |
| `frontend/e2e/auth.spec.ts` | "recuperação: dentro do fluxo até o sucesso e de volta ao login" | Navegação login → recuperar-senha → sucesso genérico → retorno ao login. |
| `frontend/e2e/auth.spec.ts` | "recuperação: e-mail inválido é bloqueadado na validação" | Validação de e-mail inválido antes do Firebase; permanece na tela. |

`frontend/e2e/helpers.ts`: adição da função `signup(page, email, password)` que navega para `/cadastro`, preenche e-mail/senha/confirmação e submette — o cadastro nasce como `pending_approval`.

### Backend Go (147/147)

Nenhum arquivo Go foi alterado na F17. A suíte Go permanece em **147/147** (igual à F16). `go vet` limpo. `tsc --noEmit` limpo. `next build` OK (25 rotas). Lint frontend 0/0.

---

## 11. Regressão

**Nenhuma regressão.** Toda a suíte verde no estado final (29/29 E2E, 98/98 Vitest, 147/147 Go). As mudanças afetam apenas a tela de autenticação (login/cadastro/recuperação) e componentes relacionados (`PasswordInput`, `auth-errors`). Componentes compartilhados tocados (`.mode-switch`, `.login-card`, `.login-err`) são usados em várias telas — cobertos pela suíte E2E completa.

**Fluxos cobertos pelos specs E2E existentes (suíte completa, sem regressão):**
- `auth.spec.ts`: autenticação (login, senha incorreta, admin, aluno, pendente, recusado, deep-link), cadastro sem Google, recuperação de senha.
- `aluno.spec.ts`: fluxo do aluno.
- `autorizacao.spec.ts`: autorização por role.
- `dieta-nova.spec.ts`: tela Nova dieta (F16).
- `exercicios.spec.ts`: exercícios.
- `pwa.spec.ts`: PWA.
- `ranking.spec.ts`: ranking.
- `aprovacao.spec.ts`: aprovação de cadastros.
- `zz-aprovacao.spec.ts`: fluxo de aprovação de cadastros (login → pending → admin aprova → aluno acessa).

---

## 12. Git

| Item | Detalhe |
|---|---|
| **Branch** | `main` |
| **Commits** | `0ea6746` (feat: remove Google login e adiciona cadastro com confirmação + recuperação) e `c99abea` (test: cobertura de auth flows) |
| **HEAD** | `c99abea` |
| **Status** | 2 arquivos modificados + 1 não rastreado (`opencode.json`, `.opencode/agent-routing.md`) — **fora do escopo da F17** (config local) |
| **Push** | **NÃO realizado** |
| **Deploy** | **NÃO realizado** |
| **Config local** | `opencode.json` e `.opencode/agent-routing.md` **não commitados** (conforme governança) |

Regra de governança desde 20 set 2026: **execução contínua** — commits automáticos em checkpoints verdes (Conventional Commits), sem push/deploy, sem tocar na V1 em produção.

---

## 13. Auditoria pré-deploy

**Resultado: PASS — PRONTO PARA DEPLOY**

A auditoria pré-deploy da F17 executou a suíte completa de validação:

- Vitest **98/98** ✅
- Playwright E2E **29/29** ✅
- Backend Go `go test` **147/147** ✅
- `go vet` **PASS** ✅
- TypeScript `tsc --noEmit` **PASS** ✅
- `next build` **PASS** (25 rotas) ✅
- Lint frontend **0/0** ✅
- Firestore rules **64/64** ✅ (sem alterações; regras inalteradas)

**"PRONTO PARA DEPLOY" = validação local concluída.** Produção ainda requer smoke test humano após publicação. A produção continua executando a versão anterior da F15.2 (com botão Google) — **sem deploy na F17**.

---

## 14. Pendências

As pendências abaixo **não são falhas da F17** e não impedem o deploy:

### Pendências da F16 (security — não resolvidas nesta fase)
- **Restrição por referrer** no Firebase API Key (ação manual no Google Cloud Console).
- **Rotação/revogação** da chave (ação manual no Google Cloud Console).
- **Limpeza do histórico git** (requer reescrita com force push — autorização explícita necessária).
- A questão da `NEXT_PUBLIC_FIREBASE_API_KEY` como chave pública do Web SDK é documentada na F16 e **não é alterada pela F17**.

### Pós-deploy (após publish da F17)
- **Smoke humano**: login real com e-mail/senha, cadastro completo, recuperação de senha, fluxo de pending approval.
- **PWA em dispositivo**: validação no mobile real.
- **Validação pela Louise**: experiência completa de login/cadastro/recuperação.
- **F8 (alimentos)**: bloqueada por decisão de produto.

---

## 15. Conclusão

A F17 foi **implementada, testada e auditada localmente** com sucesso:

- A UI de login foi despojada do Google, permanecendo apenas e-mail/senha com toggle mostrar/ocultar.
- O cadastro inclui confirmação de senha com validação "As senhas não coincidem." (somente após 1º submit e depois ao vivo), dois PasswordInputs independentes e integração com pending approval.
- A recuperação de senha utiliza o mecanismo oficial `sendPasswordResetEmail` do Firebase Auth com mensagem genérica anti-enumeração.
- A compatibilidade com a V1 foi preservada: usuários legados Google continuam reconhecidos pelo backend.
- Todas as suítes de teste estão verdes: **Vitest 98/98, Playwright 29/29, Go 147/147, go vet PASS, tsc PASS, next build PASS, lint 0/0**.
- Nenhum código de backend, regra Firestore ou modelo de autorização foi alterado.
- **PASS — PRONTO PARA DEPLOY**. Produção não alterada nesta fase; smoke test humano necessário após publicação.
