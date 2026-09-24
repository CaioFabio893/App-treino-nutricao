# AUDITORIA E CORREÇÃO — NOVA DIETA + SECURITY

**Data:** 24 set 2026
**Branch:** `main` (HEAD `3d59a6c`)
**Escopo:** Eixo segurança (secret scanning GitHub — Google API Key) + Eixo frontend (tela "Nova dieta" — UI/UX/a11y/responsividade).
**Tarefa origem:** `C:\Users\caiof\OneDrive\Desktop\1.txt` (fases 1–24).

---

## 1. Segurança

| Campo | Valor |
|---|---|
| Secret detectado | Google API Key |
| Arquivo | `reports/phase-15-2-deploy.md` (real: `docs/reports/phase-15-2-deploy.md`) |
| Commit origem | `5f82005a` |
| Chave no HEAD | **NÃO** (redigida — commit `3d59a6c` "security: redact exposed Firebase API key from F15.2 reports") |
| Resultado | **PASS — AÇÃO MANUAL PENDENTE** |

A chave é uma config **pública do Firebase Client Web SDK** (`NEXT_PUBLIC_FIREBASE_API_KEY`), usada apenas para inicializar o Firebase Auth no navegador. Referrer restriction no Firebase Console é a mitigação de menor custo; rotação/revogação exige acesso ao Google Cloud Console. **A chave NUNCA é impressa neste relatório** (`[REDACTED]`).

## 2. Secret Scanning

| Superfície | Status |
|---|---|
| HEAD | **PASS** — 0 ocorrências de `AIza[0-9A-Za-z_-]{20,}` no working tree |
| Histórico git | **PENDENTE** — chave existiu entre `5f82005a` e `3d59a6c`; repo não-shallow. Limpeza exigiria reescrita (force push) → **não executada sem autorização** (Fase 5 da tarefa) |
| Documentação | **PASS** — único `.env`-ish versionado é `frontend/.env.example` com placeholders (`your-firebase-api-key`) |
| Frontend | **PASS** — `NEXT_PUBLIC_*` apenas como referências a env vars; `playwright.config.ts` usa `e2e-fake-api-key`/`e2e-fake-app-id` (fakes) |
| Backend | **PASS** — `GOOGLE_APPLICATION_CREDENTIALS` aparece só como *nome* de variável em comentários (main.go:29, README.md:272, docs) — falsos positivos; `backend/*.exe` gitignored |
| Configuração | **PASS** — `.gitignore` cobre `.env`, `.env.local`, `.env.*.local`, `*.key`, `.env.production/.test/.development` |
| `.gitignore` | **PASS** — cobertura verificada nos dois níveis (raiz e `frontend/`) |
| URLs `key=` | **PASS** — única ocorrência é `?key=e2e-fake-api-key` (helpers.ts, emulador auth) |

**Fase 21 (auditoria final):** varreduras por `AIza…`, `GOOGLE_API_KEY`, `PRIVATE KEY`, `-----BEGIN`, `NEXT_PUBLIC_*`, `key=`, `.env`, credenciais → **nenhuma ocorrência real encontrada**.

## 3. Rotação

- **Revogada/rotacionada:** NÃO (indefinido) — **PENDENTE ação manual no Google Cloud Console** (regra da tarefa: "Rotação/revogação requer ação no Google Cloud Console").
- **Ação manual necessária:** (a) restringir o API key por referrer no Firebase Console (recomendado — config pública de client Web); (b) opcionalmente rotacionar e atualizar a env var no Cloud Run `treino-web-*`; (c) se desejar remover do histórico git, autorizar reescrita/force push (não feito).

## 4. Frontend

**Tela:** Nova dieta (`/nutritionist/diets?new=1` — `frontend/components/DietForm.tsx`).

Área afetada pelo tratamento de UI/UX/a11y (escopo: apenas apresentação — **nenhuma regra de negócio/API/auth/Firestore alterada**):

- **Labels:** removido `text-transform: uppercase` e `letter-spacing: 1px`; agora `font-size: 11px; color: var(--d-muted) (#63736C — contraste AA); font-weight: 600; margin-bottom: 6px`.
- **Inputs:** padding 10px → 12px (altura clicável ≥ 40px+, na direção dos alvos de 44px); mantidos `border: 1.5px solid var(--border)`, `background: var(--cream)`, focus `border-color: var(--terra)` — consistente com o design system existente (sem Tailwind; CSS puro com tokens).
- **Foco:** visível via `:focus` (border-color `--terra`) em input/textarea/select; alvos de toque de `.btn-sm` ampliados (padding 7px → 16px ≈ 47px de altura).
- **Acessibilidade:** `htmlFor`/`id` pareados em todos os campos (`diet-name`, `diet-student`, `diet-start`, `diet-end`, `diet-content`); erros com `role="alert"` + `aria-live="polite"`; inputs de data com `aria-invalid` e `aria-describedby` apontando para a mensagem de erro da faixa de datas.
- **Cards `.frm-card`:** estrutura preservada (agrupamento por seções "Dados da dieta" / "Conteúdo da dieta").
- **Botão "‹ Voltar":** mantém `.btn-sm` (identidade visual — verde `--terra` sobre `--cream`), agora com área de toque adequada.
- **Ícones:** nenhuma biblioteca nova; não há ícones decorativos interferindo (apenas `‹` e emoji de avatar — inalterados).
- **Install Prompt (PWA):** `.pwa-install-btn` e `.pwa-install-ios` reposicionados (`bottom: calc(68px/120px + safe-area)` e `z-index: 210`), acima da bottom nav do aluno (`z-index: 200`) e **sem sobrepor formulário nem conteúdo inferior**.
- **Bottom Navigation / conteúdo:** `.nut-main` e `.stu-main` com `padding-bottom` 90→130px / 110→130px (dashboard idem) — o conteúdo da tela rola até o fim sem ficar escondido atrás das barras fixas.
- **Responsividade:** `overflow-x: hidden` já existente no `body`; alvos ampliados, sem overflow horizontal; desktop intacto.

## 5. Arquivos modificados

```
frontend/app/base.css          (labels, inputs, .btn-sm, .btn-p, .nut-main, PWA install)
frontend/app/dashboard.css     (padding-bottom .dashboard .nut-main)
frontend/app/student.css       (padding-bottom .stu-main)
frontend/components/DietForm.tsx  (htmlFor/id, aria, role=alert nos erros)
frontend/__tests__/DietForm.test.tsx  (NOVO — a11y labels/erros)
frontend/e2e/dieta-nova.spec.ts       (NOVO — fluxo E2E Nova dieta + sobreposição)
opencode.json                  (config agente review → glm-5.2 — fora do escopo visual, requerida pela Fase 22)
.opencode/agent-routing.md     (NOVO — roteamento de agentes)
docs/reports/phase-16-nova-dieta-security-audit.md  (este relatório)
```

Sem arquivos **removidos**; nenhuma mudança em backend Go, regras Firestore, auth ou contratos de API.

## 6. Testes

| Suíte | Comando | Resultado |
|---|---|---|
| Backend | `go test -p 1 ./... -count=1` | **147/147 ok** |
| Backend vet | `go vet ./...` | **limpo** |
| Frontend build | `npm run build` | **OK** |
| Frontend lint | `npm run lint` | **0/0** |
| TypeScript | `tsc --noEmit` | **limpo** |
| Vitest | `npm test` | **63/63** (inclui 2 novos do `DietForm.test.tsx`) |
| E2E Playwright | `npm run test:e2e` | **24/24** (inclui novo `dieta-nova.spec.ts`; emuladores + backend + seed) |

**E2E — fluxo "Nova dieta" validado (Fase 18 da tarefa):** abrir página → preencher Nome/Aluno/Data início/término/texto → submeter "Salvar dieta" → retorno à listagem com o card "Dieta E2E Nova" visível → verificação de que **nenhum elemento cobre o botão** (checagem de ponto clicável após `scrollIntoView`).

**Falha pré-existente documentada:** `e2e/zz-aprovacao.spec.ts` (cadastro → admin aprova → aluno acessa dashboard) apresentou comportamento **intermitente** no `ProfileSetup` (botão "Continuar" re-resolve `disabled` após re-mount do componente — estado local `name` é perdido em re-render do `useAuth`). Evidência: 5 rodadas E2E completas, falha em 2 (rodadas 1 e 3) e passagem em 3 (incluindo rodada no **baseline limpo**, sem minhas mudanças, e a rodada final **24/24 verde**) → **não correlacionada com as alterações desta auditoria** (mudanças são CSS/a11y e não afetam `disabled`). Recomenda-se estabilizar `ProfileSetup` (preservar estado de `name` em re-renders) em fase futura.

## 7. Regressões

**Nenhuma.** Toda a suíte verde no estado final (24/24 E2E, 63/63 Vitest, 147/147 Go). As mudanças de CSS afetam apenas área de toque/padding/posicionamento e foram validadas visualmente e por E2E. Componentes compartilhados tocados (`.btn-sm`, `.btn-p`, `.frm-row label`, `.nut-main`, `.stu-main`) são usados em várias telas — cobertos pela suíte E2E completa (login, painel, alunos, treinos, exercícios, dietas, feed, PWA, aprovação).

## 8. Git

- **Branch:** `main`
- **HEAD:** `3d59a6cc075ad527a92b094f9f2c3358901f6cf5` ("security: redact exposed Firebase API key from F15.2 reports")
- **Status:** 5 arquivos modificados + 3 não rastreados (seção 5) — nada fora do escopo.
- **Diff resumido:** `git diff --stat` → 5 arquivos, +73/−22 (opencode.json +33, DietForm.tsx +38/−, base.css 18 linhas, dashboard.css 4, student.css 2).

## 9. RESULTADO FINAL

**PASS — AÇÃO MANUAL PENDENTE**

Pendências exclusivamente de ação humana (autorização externa): rotação/restrição da chave no Firebase/Google Cloud Console e, opcionalmente, limpeza do histórico git (force push — requer autorização explícita). Nenhuma pendência de código ou teste em aberto.