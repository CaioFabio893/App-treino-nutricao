# Fase 15.3 — Fechamento pós-migração (auditoria READ-ONLY + validações humanas)

**Data:** 24 set 2026
**Status:** CONCLUÍDA — auditoria READ-ONLY pós-deploy PASS (todas as verificações técnicas verdes). Migração V1→V2 **tecnicamente encerrada**.
**Modo:** READ-ONLY. Nenhum código de produção alterado. Nenhuma infraestrutura modificada. Commits = 0, Push = 0, Rollback = 0.

---

## 1. STATUS PÓS-MIGRAÇÃO

**PASS — a migração está completa e consistente em produção.** Verificação independente (gcloud/gcloud run/firebase, leitura) confirmou todos os marcadores da migração.

## 2. PRODUÇÃO

| Verificação | Resultado |
|---|---|
| API na revisão V2 correta (REST) | ✅ `treino-api-00013-867` (Ready=True, latestRevision) |
| Frontend na revisão V2 correta (REST) | ✅ `treino-web-00009-mfg` (Ready=True, latestRevision) |
| 100% do tráfego nas revisões atuais | ✅ ambos `latestRevision=True, percent=100` |
| API env correto | ✅ `GO_ENV=production`, `ALLOWED_ORIGIN=<2 origens canônica+alias>`, `RATE_LIMIT=120` |
| API imagem | ✅ `…/treino-api/treino-api:latest` (digest `6789bdbf…`) |
| Frontend imagem | ✅ `…/treino-web/treino-web:latest` (digest `531814c4…`) |
| `/health` final | ✅ 200 `{"status":"ok"}` |
| Frontend `/` final | ✅ 200 |
| Sem deploy pendente / operação parcial | ✅ últimos builds SUCCESS (API `360d078a…` e web `a4a181e4…`); nenhum build em execução; 1 problema de CORS do alias corrigido DURANTE o deploy (F15.2 §0.4), sem pendência |

## 3. SEGURANÇA

- **Hardening V2 ativo pela primeira vez em produção**: `GO_ENV=production` nunca esteve setado na V1; agora CORS fail-fast, rate limit reforçado, headers de segurança (`X-Content-Type-Options: nosniff`, CSP sem `unsafe-eval`) estão em vigor.
- CORS: origens canônica e alias → 200; origem maliciosa → 403 sem `Access-Control-Allow-Origin`.
- Token inválido → 401 no `/api/me`.
- Firestore Rules V2: leitura/escrita direta de cliente sem Auth → 403 (comportamento esperado — toda escrita de negócio passa pela API Go).
- Autenticação real validada ponta a ponta (signUp temporário → 403 por não-aprovado no ranking; `/api/me` 200 criando perfil `pending_approval`; cleanup completo).
- **Nota Google login**: o código V2 em produção AINDA expõe o botão "Entrar com Google" ativo (`login/page.tsx:99-124`, `auth.tsx:155-162`, `firebase.ts:41`). Não é vulnerabilidade — o backend valida tokens via Firebase Auth Admin SDK independente do provider e o `authProvider` vem do ID token (nunca do body, corrigido na F13). É decisão de produto pendente (item 8).

## 4. TESTES

| Gate | Resultado |
|---|---|
| `go test ./...` (147/147) | ✅ (F15.2, pré-deploy) |
| `go vet ./...` | ✅ (F15.2) |
| Firestore rules (64/64) | ✅ (F15.2) |
| Vitest (61/61) | ✅ (F15.2) |
| Playwright E2E (23/23, emuladores) | ✅ (F15.2) |
| `tsc --noEmit` / `next build` / lint | ✅ (F15.2; build reproduzido dentro do Cloud Build em produção com 21 rotas) |
| Smoke produção pós-deploy (F15.1 §16) | ✅ 16/16 (F15.2 §0.3) |
| E2E crítico de produção (cadeia Auth real) | ✅ (F15.2 §0.3) |

Nenhum gate re-executado nesta fase de fechamento (README-ONLY) — todos vêm do relatório F15.2; re-verificados somente os pontos de produção que poderiam ter regredido (revisões/tráfego/health/índices/dados).

## 5. FIRESTORE

| Verificação | Resultado |
|---|---|
| Rules V2 publicadas | ✅ `firebase deploy --only firestore` OK (F15.2); comportamento de negação revalidado em produção (403 em leitura/escrita cliente) |
| Índices compostos | ✅ **9/9 READY** (verificado nesta fase: `gcloud firestore indexes composite list`) |
| Dados de teste residuais | ✅ **zero** — usuário temporário removido do Auth (`INVALID_LOGIN_CREDENTIALS` ao tentar logar) e perfil órfão `users/anTOhcYwV6a2YQWZ5PJ3FgxKnvp2` removido (404 confirmado via leitura Admin) |

## 6. PWA

- **Pronto para validação humana** em produção:
  - `manifest.json` servido (200) — standalone, id/start_url/scope `/`, ícones 192/512 any + maskable, screenshots, lang pt-BR.
  - `sw.js` servido (200) com `Service-Worker-Allowed: /` e `Content-Type: application/javascript`.
  - `serviceWorker.register` presente no bundle (`chunk 28g9c9p507948.js`).
  - CSP/headers corretos; nunca cacheia `/api/*`/`Authorization` (testado em F14.1).
- Checklist humano em "Validações humanas pendentes" (item 7).

## 7. VALIDAÇÕES HUMANAS PENDENTES (dono do projeto — não bloqueiam a migração técnica)

### A) LOGIN REAL e fluxos principais (e-mail/senha — a Louise precisa validar)

1. Abrir `https://treino-web-834622951375.southamerica-east1.run.app` e entrar com e-mail/senha real (conta existente; se for usuária Google da V1, o botão "Entrar com Google" também funciona — ver item 8).
2. Confirmar que NÃO aparece a tela "SetupNeeded"/modo demo e que o painel carrega.
3. Validar no papel de **aluno**: dashboard, perfil, treinos (cada dia da semana, concluir treino), dietas (ver dieta, marcar adesão no calendário), comunidade (post/like/comentário), ranking.
4. Validar no papel de **nutricionista**: painel nutricionista (alunos, exercícios, treinos, dietas, feed, ranking, timeline, impressão), aprovar cadastro pendente, atribuir plano/features.
5. Validar **logout** e login alternado (aluno ↔ nutricionista) se existirem contas distintas.
6. Em qualquer falha: registrar e NÃO mascarar — a equipe técnica diagnostica (sem alteração automática de código).

### B) PWA — checklist curto (celular)

1. **Instalação**: no navegador (Chrome Android / Safari iOS), abrir o site → menu → "Adicionar à tela inicial" / "Instalar app" (deve aparecer por ter manifest válido + HTTPS).
2. **Abertura standalone**: abrir pelo ícone da tela inicial → deve abrir em janela própria (sem barra de endereço), com nome "Treino" e tema verde.
3. **Navegação**: percorrer treinos/dietas/ranking normalmente dentro do app instalado.
4. **Offline** (modo avião): recarregar → o shell deve carregar do cache (precache) e exibir fallback offline para navegações não cacheadas.
5. **Retorno online**: desligar o modo avião → recarregar → conteúdo volta a carregar da rede (network-first para shell, stale-while-revalidate para estáticos).
6. **Atualização do service worker**: com o app aberto, publicar uma atualização futura → o `SKIP_WAITING`+reload deve aplicar a nova versão sem exigir 2 aberturas (comportamento coberto por testes F14.1, só confirmação visual).

### C) GOOGLE LOGIN — estado objetivo (decisão de produto em aberto)

- **Como funcionava na V1:** botão "Entrar com Google" no login (`signInWithPopup` + `GoogleAuthProvider`), cadastro ou acesso com conta Google; `authProvider = "google.com"`; usuário cai no fluxo de aprovação (`pending_approval`) até o admin definir papel/plano.
- **O que existe na V2 (código em produção):** o botão e o fluxo **continuam 100% ativos** — `googleProvider` em `frontend/lib/firebase.ts:41`, `loginWithGoogle` com `signInWithPopup` em `frontend/lib/auth.tsx:155-162`, botão em `frontend/app/login/page.tsx:99-124`; backend aceita `authProvider` `"password" | "google.com"` (`backend/models/types.go:106`, `middleware/auth.go:189`). O ADR-002 documentou a intenção de remover, mas **a remoção não foi implementada** (classificado INFORMATIVO mantido na F15.1 §13/§5).
- **Impacto para usuários existentes:** NENHUM bloqueio imediato — usuários V1 com `authProvider=google.com` continuam logando na V2 com o mesmo UID (perfis permanecem válidos, mesmo Firebase project). A remoção SÓ afetaria fluxos futuros.
- **Opções técnicas possíveis (NÃO decididas — escolher em conjunto):**
  1. **Manter Google** como está (zero trabalho; remove a divergência entre código e ADR-002 se o ADR for revisto).
  2. **Remover Google da V2** como o ADR-002 prevê (remover botão + `googleProvider` + `loginWithGoogle`; decidir se backend passa a rejeitar `google.com` — impacta usuários existentes que ainda usariam o fluxo); exigiria migrar usuários Google para e-mail/senha (reset de senha via Firebase) OU manter backend tolerante.
  3. **Remover só o botão** (UI sem Google) mantendo backend tolerante ao provider (usuários já logados não são afetados; novos só e-mail/senha).
- **Recomendação NÃO prescritiva (aguarda decisão):** documentar o impacto de cada opção antes de escolher. Qualquer remoção deve ser coordenada (frontend + backend + testes + documentação + comunicação aos usuários) e é uma nova fase de implementação.

### D) F8 (alimentos) — MANTIDA BLOQUEADA

- Nenhuma implementação iniciada (regra).
- **O que está decidido/pendente:** a V1/V2 atual modela dieta como **texto livre com refeições** (`meals`) e há um helper legado `mealsToText` (dieta legada → texto); módulo de "alimentos" como biblioteca estruturada (análoga à biblioteca de exercícios da F5) ainda **não tem decisão de produto**.
- **Decisões pendentes (donas da F8):**
  1. Formato da dieta: manter **texto livre** (como hoje) vs **refeições/alimentos estruturados** (biblioteca de alimentos com nutrientes/quantidades) vs híbrido.
  2. Se estruturado: a biblioteca é **global compartilhada** (como exercícios da F5) ou **por nutricionista**?
  3. Campos mínimos do alimento (nome, kcal, macros, porção, unidade?) e granularidade do cadastro.
  4. Impacto com dietas existentes (migração do legado: `mealsToText` mantido?).
- Registrar aqui qualquer decisão: **PENDENTE** (formato da dieta não decidido).

## 8. DECISÕES DE PRODUTO PENDENTES

| # | Assunto | Pendência |
|---|---|---|
| 1 | **Google login** | Decidir entre manter / remover botão+provider total / remover só UI (item 7C) — o ADR-002 vs código divergem |
| 2 | **F8 alimentos** | Formato da dieta: texto livre vs estruturado (item 7D) |
| 3 | **PWA** | Validação humana em dispositivo (item 7B) + eventual ajuste de ícones/marca |
| 4 | **Validação humana geral** | Login real e fluxos com dados reais (item 7A) |
| 5 | **Próximas fases** | Roadmap pós-migração: nada além de F8/F13-revisão já mapeadas; aguardar decisão |

## 9. ESTADO DO GIT

HEAD: `248e83e` (inalterado). Nenhum commit/push (governança).

**Alterações necessárias da migração/documentação (devem ser commitadas quando autorizado):**
| Arquivo | Tipo | Motivo |
|---|---|---|
| `README.md` | modificado | Correções `ALLOWED_ORIGIN`/`GO_ENV=production` no runbook (F15.2) |
| `docs/progress.md` | modificado | Registro da migração executada (F15.2 foi dividida em preparação + execução) |
| `frontend/.env.example` | modificado | Correção do comentário `ALLOWED_ORIGIN` (fail-fast em produção) |
| `docs/reports/phase-15-2-deploy.md` | novo (untracked) | Relatório da migração (este relatório F15.3 referencia) |
| `docs/reports/phase-15-1-pre-deploy-audit.md` | novo (untracked) | Auditoria pré-deploy (base da F15.2) |
| `docs/reports/phase-15-1-final-security-review.md` | novo (untracked) | Revisão de segurança dedicada |
| `docs/reports/phase-14-pwa-production.md` | novo (untracked) | Auditoria PWA produção |
| `docs/reports/phase-15-3-post-migration.md` | novo (untracked) | Este relatório |

**Arquivos gerados (NÃO commitados, ignorados corretamente):**
| Caminho | Status |
|---|---|
| `frontend/.next/` | build local (no `.gitignore`) |
| `frontend/test-results/` | Playwright (no `.gitignore`) |
| `frontend/.env.local` | config local (`NEXT_PUBLIC_DEMO=1`) — no `.gitignore` |
| `backend/server` / `backend/bin` | ausentes (não há binário local) |

**Arquivos que NÃO devem ser commitados (config do ambiente de trabalho):**
| Arquivo | Motivo |
|---|---|
| `opencode.json` | Config local do opencode (modelos/agentes da máquina) — pré-existente, fora do escopo do app |
| `.opencode/agent-routing.md` | Config local de roteamento de agentes — infraestrutura de trabalho, não produto |

**Relatórios que devem permanecer versionados:** todos em `docs/reports/` (a pasta inteira é versionada como documentação do projeto; os 5 novos seguem o padrão). Nada a apagar (nenhum arquivo marcado para remoção — governança: não apagar automaticamente).

Obs. detecção: TODOS os arquivos novos/modificados foram auditados por conteúdo (dif), nenhum contém secret. `frontend/.env.local` confere `NEXT_PUBLIC_DEMO=1` apenas.

## 10. PRÓXIMO PASSO RECOMENDADO

1. **Decisão de produto do dono** — itens 8.1 (Google) e 8.2 (F8); são as únicas pendências que exigem decisão humana real (nenhuma bloqueia o funcionamento de produção).
2. **Validação humana** (8.3/8.4): login real + fluxos + PWA em dispositivo — conforme listas do item 7; reportar falhas sem que ninguém altere código automaticamente.
3. **Quando autorizado pelo dono**: commit do working tree da migração (item 9 — docs/relatórios) e push; sem isso nada é commitado.
4. **Monitoramento de produção** (recomendado, sem implementar): acompanhar logs do Cloud Run e erros 5xx/429 nas primeiras semanas pós-migração.
5. **Não iniciar** F8/Google-novo/outras features até decisão de produto.

---

### F15.3 — RESULTADO

- **Auditoria pós-migração:** PASS (todos os pontos técnicos re-verificados)
- **Produção:** 100% V2 nas revisões corretas; 0 pendências técnicas; 0 dados de teste; 0 processos órfãos locais; 0 builds pendentes
- **Firestore:** rules V2 + 9/9 índices READY; negação de cliente confirmada
- **Segurança:** hardening ativo; sem novas exposições; 1 INFORMATIVO (Google login ainda presente — decisão de produto, não defeito)
- **Migração técnica:** ENCERRADA
- **Pendências humanas:** A) login real + fluxos; B) PWA em dispositivo; C) decisão Google; D) decisão F8
- **Git:** HEAD `248e83e`, 0 commits/push, working tree classificado (docs a versionar × config local a não commitar)