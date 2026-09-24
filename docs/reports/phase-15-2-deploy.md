# Fase 15.2 — Preparação de deploy (Cloud Run) + Migration V1→V2 em produção

**Data:** 23–24 set 2026
**Status:** CONCLUÍDA — preparação completa (23 set) **E migração V1→V2 EXECUTADA EM PRODUÇÃO (24 set)** com autorização explícita do dono. 8 gates revalidados verdes; deploy executado; smoke/E2E de produção verdes.
**Modo:** preparação READ-ONLY evoluiu para execução autorizada. Commits = 0, Push = 0 (governança). **Produção agora roda 100% V2.**

---

## 0. Migration V1→V2 em produção — EXECUTADA (24 set 2026)

**Autorização:** mensagem explícita do dono ("AUTORIZO A MIGRAÇÃO V1 → V2 EM PRODUÇÃO"), removendo o bloqueio de governança. Regras seguidas: projeto `treino-louise`, região `southamerica-east1`, serviços `treino-api`/`treino-web`, Firestore Rules V2, `GO_ENV=production`, `RATE_LIMIT=120`, `ALLOWED_ORIGIN` com as origens corretas, `NEXT_PUBLIC_API_URL` real, valores reais `NEXT_PUBLIC_FIREBASE_*`, revalidação Git pré-deploy, deploy completo, smoke tests F15.1 §16, sem commit/push, autonomia.

### 0.1 Valores reais usados

| Variável | Valor |
|---|---|
| `GO_ENV` | `production` |
| `ALLOWED_ORIGIN` | `https://treino-web-834622951375.southamerica-east1.run.app,https://treino-web-jn4epizxfq-rj.a.run.app` |
| `RATE_LIMIT` | `120` |
| `NEXT_PUBLIC_API_URL` | `https://treino-api-834622951375.southamerica-east1.run.app` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `[REDACTED]` (config pública Web SDK do Firebase — redigida após alerta de Secret Scanning; aplicar restrição de referrer no console do Firebase) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `treino-louise.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `treino-louise` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `treino-louise.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `834622951375` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:834622951375:web:fd5f73b4f2aaefffc38cba` |
| Região | `southamerica-east1` |

> **Origem dos `NEXT_PUBLIC_FIREBASE_*`:** config pública do Firebase Web SDK (dados públicos por design, não segredos) extraída do bundle real do frontend V1 servido em produção (chunk `_next/static/chunks/37g--pg9agc92.js`), validada contra o projeto `treino-louise` (senderId/appId = project number `834622951375`; `projectId: "treino-louise"`). Nada foi lido de credenciais/segredos.

### 0.2 Ações executadas

1. **Revalidação pré-deploy (regra 8):** `git status` — apenas docs (`README.md`, `docs/progress.md`, `frontend/.env.example`) + `opencode.json` pré-existente; **zero alteração inesperada em código**; HEAD `248e83e` conferido; baseline `/health` V1 → 200 `{"status":"ok"}`.
2. **API `treino-api` (V2):** build no Cloud Build (`360d078a…`, 1M55S, digest `6789bdbf…`) → `gcloud run deploy` com env acima → revisão **`treino-api-00013-867`**, 100% tráfego. *(Passo intermediário com `--set-env-vars` que perdeu `RATE_LIMIT` foi corrigido no mesmo deploy via `--env-vars-file` com as 3 variáveis — estado final correto, verificado em `gcloud run services describe`.)*
3. **Frontend `treino-web` (V2):** build Cloud Build (`a4a181e4…`, 2M29S, digest `531814c4…`, 21 rotas, `npm ci` 0 vulnerabilidades, EBADENGINE apenas warnings de toolchain na imagem Node 20 do Cloud Build — sem impacto) → `gcloud run deploy` → revisão **`treino-web-00009-mfg`**, 100% tráfego.
4. **Firestore:** `firebase deploy --only firestore --project treino-louise` → regras V2 (64/64) publicadas + **9 índices compostos** (todos READY em `gcloud firestore indexes composite list`).

### 0.3 Smoke tests pós-deploy (F15.1 §16) — TODOS VERDES

| Smoke | Resultado |
|---|---|
| `GET /health` (API prod) | ✅ 200 `{"status":"ok"}` |
| CORS origem canônica | ✅ 200 + `Access-Control-Allow-Origin` correto |
| CORS alias antigo | ✅ 200 (ALVO — regressão evitada; ver §0.4) |
| CORS origem maliciosa | ✅ 403, sem ACAO |
| `/api/me` com token inválido | ✅ 401 |
| Headers de segurança API | ✅ `X-Content-Type-Options: nosniff` |
| Frontend `/`, `/login`, `/dashboard` | ✅ todos 200 |
| `manifest.json` | ✅ 200, conteúdo completo (standalone, ícones any+maskable, screenshots) |
| `sw.js` | ✅ 200, `Content-Type: application/javascript`, `Service-Worker-Allowed: /` |
| CSP | ✅ idêntico ao versionado (sem `unsafe-eval`; `connect-src` com API URL exata) |
| `serviceWorker.register` no bundle | ✅ encontrado no chunk `28g9c9p507948.js` |
| firebaseConfig REAL embutido no bundle V2 | ✅ apiKey + API URL no chunk `37g--pg9agc92.js` |
| Firestore REST — leitura de `workouts`/`users` sem Auth | ✅ 403 (rules V2 ativas) |
| Firestore REST — escrita em `workouts` sem Auth | ✅ 403 |
| **Cadeia Auth real (sem deixar dados)** | ✅ signUp temporário → `GET /api/ranking` → 403 (não-aprovado, JWT real validado) → `GET /api/me` → 200 (perfil pending criado via API Go, comportamento de onboarding) → **cleanup completo**: `accounts:delete` (Auth) + `firebase firestore:delete` do perfil órfão → 404 confirmado. Zero resíduo em produção. |

### 0.4 Problema encontrado e corrigido durante o deploy

- **CORS do alias antigo 403** no primeiro deploy: o V1 permitia as 2 origens (`…run.app` + alias `.a.run.app`) e o alias continua sendo URL ativa do serviço (o `gcloud run services list` exibe o alias como URL oficial). O primeiro `--set-env-vars` usou só a origem canônica. **Corrigido** re-deployando a API com `--env-vars-file` contendo `ALLOWED_ORIGIN=origem1,origem2` (vírgula dentro do valor não é parseável com `--set-env-vars`). Após a correção: CORS das 2 origens → 200. OBS: segundo deploy rapidamente depois do primeiro — janela de minutos sem impacto prático.

### 0.5 Estado final da produção (24 set 2026)

| Item | Valor |
|---|---|
| API URL | `https://treino-api-834622951375.southamerica-east1.run.app` |
| Web URL | `https://treino-web-834622951375.southamerica-east1.run.app` (e alias `.a.run.app`) |
| API revisão ativa | `treino-api-00013-867` (100% tráfego, IMAGE `…/treino-api/treino-api:latest`, digest `6789bdbf…`) |
| Web revisão ativa | `treino-web-00009-mfg` (100% tráfego, digest `531814c4…`) |
| API env | `GO_ENV=production`, `ALLOWED_ORIGIN=<2 origens>`, `RATE_LIMIT=120` |
| Web env | nenhuma (valores públicos embutidos na imagem — por design) |
| Firestore | rules V2 (64/64) + 9 índices READY |
| V1 | sobrescrita (revisões históricas retidas no Cloud Run; rollback manual possível via apontar para revisão antiga, NÃO preferível) |
| Auth | Firebase Auth real do projeto `treino-louise` (config pública correta), sem emulador |
| Dados | zero dados de teste: usuário temporário removido, perfil órfão removido |

### 0.6 O que ainda falta para considerar a migração ENCERRADA

1. **Validação humana final:** confirmar login real (e-mail/senha) + fluxo de aluno (dashboard, treinos, dieta) numa conta real em produção, após a migração — smoke automatizado validou a cadeia Auth/API, mas a validação completa com dados reais depende do dono (nenhum dado real foi criado de propósito).
2. **Validação do PWA instalável e offline** num dispositivo real (recomendado).
3. **Decisão de produto sobre o Google login**: o código V2 em produção **AINDA oferece o botão "Entrar com Google"** ativo (`frontend/app/login/page.tsx:99-124`, `frontend/lib/auth.tsx:155-162` `loginWithGoogle` com `signInWithPopup`, `frontend/lib/firebase.ts:41` `googleProvider`; backend aceita `authProvider` `"password" | "google.com"`). O ADR-002 decidiu remover o Google da V2, mas a remoção **não foi implementada** — permanece como INFORMATIVO mantido (F15.1). Impacto real: usuários V1 com Google continuam logando na V2 (o mesmo UID/`authProvider=google.com` funciona), então **não há bloqueio de acesso imediato**. A remoção coordenada (frontend + rules + testes) continua pendente de decisão de produto, e usuários novos com Google caem no fluxo `pending_approval` normal.
4. **Decisão de produto:** F8 (alimentos) permanece bloqueada (formato da dieta).
5. OBS notável: `GO_ENV=production` nunca esteve setado na V1 — a V2 agora está com o hardening completo ativo em produção (CORS fail-fast, rate limit reforçado, headers de segurança).

---

## 1. Executive Summary

Preparação final do app **Treino & Nutrição** (V2) para deploy no projeto `treino-louise` (Firebase + GCP, região `southamerica-east1`). Foram revalidados sequencialmente os 8 gates de qualidade (mesma bateria da F15.1), auditado o caminho de deploy inteiro (Dockerfiles, cloudbuild, config de produção, Firestore indexes/rules, next.config, PWA) e corrigidas duas documentações que continham informações incorretas sobre `ALLOWED_ORIGIN` (`.env.example` e `README.md`).

**Conclusão:** o projeto está **PREPARADO para deploy**, com 0 achados de severidade CRÍTICA/ALTA/MÉDIA. Todos os 8 gates passaram sem regressão frente ao HEAD `248e83e`. O deploy **não foi executado** por duas razões não-técnicas: (1) decisão humana pendente (publicar V2 sobrescreve serviços V1 em produção) e (2) valores `NEXT_PUBLIC_FIREBASE_*` ausentes no repositório (são dados públicos do Firebase Web SDK, mas não versionados).

**Nenhum bloqueador técnico.** As duas pendências são de natureza operacional/humana e serão resolvidas pelo dono do projeto antes do deploy.

## 2. Estado atual

- **Baseline:** HEAD `248e83e` (`feat: add shared exercise library`). Projeto real `treino-louise` (Firebase + GCP), região `southamerica-east1`.
- **gcloud/firebase autenticados** nesta sessão.
- **Serviços existentes em produção (V1):**
  - `treino-api` → `https://treino-api-834622951375.southamerica-east1.run.app`
  - `treino-web` → `https://treino-web-834622951375.southamerica-east1.run.app` (alias antigo `https://treino-web-jn4epizxfq-rj.a.run.app`)
- **Env do `treino-api` V1 (leitura, sem alteração):** `ALLOWED_ORIGIN=https://treino-web-834622951375.southamerica-east1.run.app,https://treino-web-jn4epizxfq-rj.a.run.app` e `RATE_LIMIT=120` — **SEM** `GO_ENV=production` (configuração V1 legada).
- **Alterações nesta sessão (fora da F15.1):**
  - `frontend/.env.example`: correção do comentário de `ALLOWED_ORIGIN` (antes dizia "vazio = todas"; agora documenta que em produção ausente = boot FALHA, `*` rejeitado em qualquer ambiente, default dev `http://localhost:3000`, valor OBRIGATÓRIO com `GO_ENV=production`).
  - `README.md` passo 5 (deploy do backend): comentário antigo "Sem essa variável o backend responde com CORS `*`" corrigido (ausente em produção = boot falha; nunca "permitir todas"); comando `gcloud run deploy treino-api` agora inclui `GO_ENV=production` no `--set-env-vars`.
- **Nenhum código de produção alterado.** Nenhum commit/push/deploy.

## 3. Auditoria do caminho de deploy (READ-ONLY)

| Arquivo | Veredito / Evidência |
|---|---|
| `backend/Dockerfile` | ✅ distroless nonroot static, `CGO_ENABLED=0 -trimpath -ldflags="-s -w"`, `PORT=8080` — compatível Cloud Run |
| `frontend/Dockerfile` | ✅ multi-stage standalone, `NEXT_PUBLIC_*` via build args, `NEXT_PUBLIC_DEMO` deliberadamente fora |
| `frontend/cloudbuild.yaml` | ✅ região `southamerica-east1`, serviço `treino-web`, separador vírgula obrigatório documentado |
| `backend/config.go` | ✅ fail-fast: `GO_ENV=production` exige `ALLOWED_ORIGIN` (ausente = boot falha), `*` rejeitado, `RATE_LIMIT=0` em prod = boot falha |
| `main.go` | ✅ `GET /health` público (linha 136) — healthcheck Cloud Run funcional sem autenticação |
| `firestore.indexes.json` | ✅ 9 índices compostos, incluindo `dietLogs(studentId ASC, date DESC)` — todas queries cobertas |
| `next.config.ts` | ✅ CSP produção sem `unsafe-eval`, `connect-src` com URL exata da API + `*.a.run.app`, headers PWA (`sw.js` no-cache + `Service-Worker-Allowed: /`, manifest no-cache, ícones immutable) |
| `firestore.rules` | ✅ 64/64 testadas no emulador — escrita de negócio só via API Go |
| `README.md` | ✅ runbook totalmente coerente com os arquivos acima; comentários de `ALLOWED_ORIGIN` corrigidos |
| `frontend/.env.example` | ✅ comentário de `ALLOWED_ORIGIN` corrigido; placeholders `REPLACE_ME_*` claros |
| `docs/reports/phase-14-pwa-production.md` | ✅ PWA auditado para produção — PASS, nenhuma alteração necessária |

**Resultado da auditoria:** caminho de deploy **100% consistente** com a documentação e a configuração de produção. Zero discrepâncias encontradas.

## 4. Correções de documentação feitas

### `frontend/.env.example`
- **Antes:** comentário de `ALLOWED_ORIGIN` indicava "vazio = todas as origens permitidas".
- **Depois:** documenta que em produção `ALLOWED_ORIGIN` ausente = boot FALHA, `*` rejeitado em qualquer ambiente, default dev = `http://localhost:3000`, valor OBRIGATÓRIO quando `GO_ENV=production`.
- **Motivo:** achado INFORMATIVO da revisão de segurança F15.1 — a documentação era enganosa e poderia levar a configurações incorretas em produção.

### `README.md` (passo 5 — deploy do backend)
- **Antes:** comentário "Sem essa variável o backend responde com CORS `*`".
- **Depois:** comentário corrigido — ausente em produção = boot falha; nunca "permitir todas". Comando `gcloud run deploy treino-api` agora inclui `GO_ENV=production` no `--set-env-vars`.
- **Motivo:** consistência com `backend/config.go` (fail-fast) e prevenção de deploy com CORS aberto.

## 5. Gates revalidados nesta sessão (sequenciais)

| # | Gate | Resultado |
|---|---|---|
| 1 | `go test ./... -count=1` | ✅ **147/147** (com `-p 1` — ver §6 nota operacional) |
| 2 | `go vet ./...` | ✅ limpo |
| 3 | Firestore rules (`firestore-tests`) | ✅ **64/64** |
| 4 | Vitest (`npm test`) | ✅ **61/61** (12 suítes) |
| 5 | `npx tsc --noEmit` | ✅ limpo |
| 6 | `npm run build` (Next standalone) | ✅ OK — 21 rotas (2 dinâmicas) |
| 7 | `npm run lint` | ✅ **0/0** |
| 8 | Playwright E2E | ✅ **23/23** |

## 6. Notas operacionais

### 6.1 Linker Go (`-p 1`)
Com link paralelo (default) o linker crasha por memória ao construir o pacote `repository` (panic `cmd/link/internal/ld.deadcode`). Com `-p 1` passa 147/147. É problema de toolchain/ambiente (Go 1.27.1 Windows, recursos limitados), **NÃO regressão**. Uso recomendado nesta máquina: `go test -p 1 ./... -count=1`.

### 6.2 E2E — corrupção de cache e emulador órfão
O primeiro run desta sessão falhou com corrupção de cache do Turbopack (`frontend/.next/cache` — checksum mismatch em `.sst`, panic nativo exit `0xC0000409`) + um Firestore Emulator órfão (java) ocupando a porta. Remédio: apagar `.next` (artefato gitignored) e encerrar o emulador órfão → 2º run 23/23. Nenhuma alteração de código envolvida.

## 7. Checklist pré-deploy

**Valores reais conhecidos e prontos para uso:**

| Variável | Valor |
|---|---|
| `GO_ENV` | `production` |
| `ALLOWED_ORIGIN` | `https://treino-web-834622951375.southamerica-east1.run.app` (+ alias antigo `https://treino-web-jn4epizxfq-rj.a.run.app`) |
| `RATE_LIMIT` | `120` |
| `NEXT_PUBLIC_API_URL` | `https://treino-api-834622951375.southamerica-east1.run.app` |
| Região | `southamerica-east1` |
| Firebase Auth emulator | `false` (production — nunca injetar `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR=1`) |

**Passos de deploy (runbook):**
- [ ] Fornecer valores `NEXT_PUBLIC_FIREBASE_*` como build args (mesma origem do console Firebase)
- [ ] `gcloud run deploy treino-api --set-env-vars GO_ENV=production,ALLOWED_ORIGIN=...,RATE_LIMIT=120,...`
- [ ] `gcloud run deploy treino-web --set-env-vars NEXT_PUBLIC_API_URL=...,NEXT_PUBLIC_FIREBASE_*=...`
- [ ] `firebase deploy --only firestore` (aplica as 9 combinações de índices já versionadas em `firestore.indexes.json` + as `firestore.rules` V2 testadas 64/64)
- [ ] Smoke test pós-deploy: `GET /health` + login real + CORS prod

## 8. Bloqueios (pendências que exigem ação humana)

| # | Bloqueio | Tipo | Detalhes |
|---|---|---|---|
| 1 | **Decisão humana: publicar V2 sobrescreve V1** | Decisão de produto/governança | Publicar a V2 no projeto `treino-louise` sobrescreve os serviços V1 em produção (`treino-api`/`treino-web` — nova revisão, 100% tráfego) e as `firestore.rules` de produção (escrita de negócio passa a ser só via API Go — mudança de comportamento para os clientes V1 no mesmo projeto). Governança atual (CLAUDE.md) proíbe tocar V1 em produção sem instrução explícita. **Sem instrução → sem deploy.** |
| 2 | **Valores `NEXT_PUBLIC_FIREBASE_*` ausentes** | Valores públicos não versionados | Config Web SDK do Firebase (DADOS PÚBLICOS, não segredos) não estão no repositório — `.env.example` só tem placeholders `REPLACE_ME_*`; `.env.local` é `NEXT_PUBLIC_DEMO=1`. Para o build do frontend V2 será preciso fornecê-los como build args (mesma origem do console Firebase). Também confirmar a URL final da API após cada deploy do backend para `NEXT_PUBLIC_API_URL`/`ALLOWED_ORIGIN`. |
| 3 | (Preparado, mas pertence ao deploy) Aplicar índices/regras | Operacional | `firebase deploy --only firestore` (as 9 combinações já estão versionadas em `firestore.indexes.json`; as regras em `firestore.rules` — 64/64 testadas). Este passo só é executado após os bloqueios 1 e 2 serem resolvidos. |

**Classificação:** NENHUM dos bloqueios é técnico. São decisões de produto/valores públicos ausentes que requerem ação humana explícita do dono do projeto.

## 9. Riscos residuais

Herdados da F15.1 (sem agravamento):

1. **Rate limit por `X-Forwarded-For` (INFORMATIVO):** confia no primeiro elemento — spoofável quando não há proxy confiável. Mitigação: Cloud Run LB sobrescreve o header.
2. **Migração V2 em curso:** risco de conflito de branch — mitigado pela governança de execução contínua (sem push/deploy).
3. **Google login descontinuado na V2:** requer remoção coordenada (frontend + rules + testes). Baixo.
4. **F8 (alimentos) bloqueada por decisão de produto:** sem impacto técnico.

## 10. Próximos passos

1. **Decisão do dono do projeto** (bloqueio 1): autorizar ou não a publicação da V2 em produção (sobrescrevendo V1).
2. **Se autorizado:** fornecer valores `NEXT_PUBLIC_FIREBASE_*` (bloqueio 2) e executar o runbook do §7.
3. **Smoke test pós-deploy:** `GET /health` + login real + verificar CORS com `ALLOWED_ORIGIN` exato.
4. **Registrar resultado no `docs/progress.md`.**
5. Próximas fases a decidir: F8 (alimentos, bloqueada por produto), F13 revisão, F14 PWA, F15 produção — roadmap depende de decisão de produto.

---

### F15.2 — RESULTADO

- **Preparação:** PASS
- **Gates:** 8/8 verdes (147/147, vet limpo, rules 64/64, Vitest 61/61, tsc limpo, build OK, lint 0/0, E2E 23/23)
- **Segurança:** PASS (sem regressão desde F15.1)
- **Caminho de deploy:** AUDITADO E CONSISTENTE
- **Documentação corrigida:** `.env.example`, `README.md` (comentários `ALLOWED_ORIGIN`)
- **MIGRATION V1→V2 EM PRODUÇÃO:** EXECUTADA (24 set 2026, autorização explícita do dono)
- **API:** revisão `treino-api-00013-867` (digest `6789bdbf…`) — `GO_ENV=production`, `ALLOWED_ORIGIN` (2 origens), `RATE_LIMIT=120`
- **Frontend:** revisão `treino-web-00009-mfg` (digest `531814c4…`) — 21 rotas, config Firebase real embutida, PWA ativo
- **Firestore:** rules V2 (64/64) + 9 índices READY publicados
- **Smoke/E2E produção:** TODOS VERDES (health, CORS 2 origens + 403 maliciosa, 401 token inválido, Firestore 403 sem Auth, cadeia Auth real com cleanup completo, PWA/CSP/headers)
- **Problema corrigido durante deploy:** CORS do alias antigo (regressão evitada via `--env-vars-file` com 2 origens)
- **Produção:** 100% V2 — V1 sobrescrita (revisões históricas retidas)
- **Deploy:** EXECUTADO (3 ações: API, web, firestore)
- **Push:** 0 | **Commits:** 0 | **Dados de teste residuais:** 0 (cleanup completo)

### TESTES

| Gate | Resultado |
|---|---|
| `go test ./...` | ✅ 147/147 |
| `go vet ./...` | ✅ limpo |
| Firestore rules | ✅ 64/64 |
| Vitest | ✅ 61/61 |
| Playwright | ✅ 23/23 |
| `tsc --noEmit` | ✅ OK |
| `next build` | ✅ OK (21 rotas, dentro do Cloud Build em produção) |
| lint | ✅ 0/0 |
| Smoke produção §16 | ✅ 16/16 (ver §0.3) |

### FINDINGS

CRÍTICO: 0 | ALTO: 0 | MÉDIO: 0 | BAIXO: 0 | INFORMATIVO: 1 (CORS alias antigo — encontrado e corrigido durante o próprio deploy; sem impacto residual. Obs. técnica: `--set-env-vars` não parseia vírgula dentro do valor → usar `--env-vars-file` para listas de origens.)

### ARQUIVOS ALTERADOS

- `frontend/.env.example` — correção de comentário de `ALLOWED_ORIGIN` (informação correta sobre fail-fast em produção)
- `README.md` — correção de comentário sobre `ALLOWED_ORIGIN` e inclusão de `GO_ENV=production` no comando de deploy
- `docs/progress.md` — status da migração executada (24 set 2026)
- `docs/reports/phase-15-2-deploy.md` — esta seção de execução da migração

### GIT

- HEAD: `248e83e` (inalterado)
- Commits: nenhum criado
- Produção: **MIGRADA PARA V2** (100% tráfego nas revisões V2)

### RECOMENDAÇÃO

Migração **concluída tecnicamente**. Para encerramento formal: validação humana final (login real + fluxos com dados reais), validação PWA em dispositivo, decisão sobre Google login e F8. Não commitado por governança — aguardar autorização do dono para commits/push.
