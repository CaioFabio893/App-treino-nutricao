# Fase 2 — Frontend Tests (Vitest)

**Data:** 22 set 2026
**Status:** CONCLUÍDA
**Gates:** Vitest 28/28 ✅ · Build ✅ · Typecheck ✅ · Lint (dívida pré-existente, sem novos) · Backend 112+ ✅

---

## 1. Objetivo

Fechar a Fase 2 do plano: levar o frontend de **zero testes** para uma suíte
de unit/component tests com Vitest + Testing Library, corrigir os 4 testes que
estavam falhando (com decisão fundamentada em código/documentação, nunca
"fazer o teste passar" à força), validar o frontend inteiro (build, typecheck,
lint), e deixar o projeto em checkpoint limpo — preparando o terreno para o
Playwright (E2E).

## 2. Estado inicial

- Working tree com trabalho **não commitado** da Fase 2 (setup Vitest + testes):
  - `frontend/package.json` / `package-lock.json` (modificados): script `test`/
    `test:watch` + deps `vitest`, `jsdom`, `@testing-library/*`,
    `@vitejs/plugin-react`, `vite-tsconfig-paths`.
  - `frontend/vitest.config.mts`, `frontend/vitest.setup.ts` (novos).
  - `frontend/__tests__/` (novo): 6 arquivos de teste, 28 testes no total.
- Estado conhecido antes desta execução: **24 passando / 4 falhando**.
- Dívida de lint registrada no `docs/progress.md`: 31 erros + 11 warnings
  pré-existentes (principalmente `react-hooks/set-state-in-effect` e
  `@next/next/no-img-element`) — retaguarda, não bloqueia.

## 3. Testes existentes (28, após a Fase 2)

| Arquivo | Escopo | Testes |
|---|---|---|
| `__tests__/StudentDietPage.test.tsx` | Dieta do aluno (texto livre) | 6 |
| `__tests__/Ranking.test.tsx` | Página de ranking do aluno | 5 |
| `__tests__/StudentDashboard.test.tsx` | Cards de módulo por feature (tier gratuito) | 5 |
| `__tests__/mealsToText.test.ts` | Conversão dieta legada → texto livre | 5 |
| `__tests__/EmptyDietState.test.tsx` | Estado vazio da tela de dietas | 3 |
| `__tests__/auth-demo.test.tsx` | AuthProvider em modo demo (sem Firebase) | 4 |
| **Total** | | **28** |

## 4. Falhas encontradas

### Falha 1 e 2 — `mealsToText.test.ts` (2 testes)

- **Teste:** `converte refeições com horário...` e `filtra alimentos e
  refeições sem nome...`.
- **Comportamento esperado (teste):** cabeçalhos em MAIÚSCULAS
  (`"CAFÉ DA MANHÃ"`, `"ALMOÇO"`).
- **Comportamento real:** `"Café da manhã (07:00)"` / `"Almoço (12:00)"` —
  nome preservado como no legado + horário no cabeçalho quando existe.
- **Investigação:**
  - `components/DietForm.tsx` `mealsToText()`: função de **conversão** de
    refeições estruturadas (legado) em texto livre. Ela não aplica nenhuma
    transformação de caixa — preserva `m.name` como está e anexa `(time)`
    quando há horário.
  - O teste "mantém cabeçalho mesmo sem horário..." (que já passava) valida
    **exatamente** a preservação do nome (`"Lanche\n• Maçã"`) — ou seja, a
    própria suíte estava inconsistente consigo mesma ao exigir maiúsculas
    em outros casos.
  - O placeholder do `DietForm` mostra `"CAFÉ DA MANHÃ (07:00)"` como
    **exemplo de digitação** no formato texto livre — é um exemplo de entrada
    do usuário, **não** uma regra de transformação da função.
  - Nenhuma documentação (design/API) define normalização de caixa.
- **Causa:** **TESTE INCORRETO** — capitalização é apresentação; o contrato
  funcional da função é preservar o conteúdo do legado.
- **Decisão:** ajustar os testes ao contrato real; validar os conteúdos
  funcionais relevantes (cabeçalho com horário, alimentos com
  quantidade/unidade/notes, `Obs:`, filtro de vazios).
- **Alteração:** asserções atualizadas para `"Café da manhã (07:00)"`,
  `"Almoço (12:30)"`, `"Almoço (12:00)\n• Feijão — 100 g"` + comentários
  documentando a regra de preservação. Nenhuma mudança de implementação.

### Falha 3 — `EmptyDietState.test.tsx` (1 teste)

- **Teste:** `mostra título e texto de orientação`.
- **Comportamento esperado (teste):** texto `"Ajude o aluno..."` (inventado).
- **Comportamento real:** `"Adicione uma refeição ou plano alimentar para
  acompanhar a nutrição do aluno."`.
- **Investigação:**
  - `components/EmptyDietState.tsx`: único uso em
    `app/nutritionist/diets/page.tsx` — tela **do nutricionista** (botão
    "Cadastrar Dieta" → nova dieta). O texto atual é dirigido ao nutricionista
    ("...do aluno") e coerente com o produto.
  - Nenhuma documentação de produto define outro texto para esse empty state;
    o design system exige apenas cobrir o estado vazio com `.empty-state`.
- **Causa:** **TESTE INCORRETO** — expectativa de redação sem fonte.
- **Decisão:** validar o texto real do produto (intenção/nutrição do aluno),
  mantendo asserção da mensagem de orientação, sem acoplar a detalhes frágeis.
- **Alteração:** asserção atualizada para
  `getByText(/Adicione uma refeição ou plano alimentar/i)`. Nenhuma mudança de
  implementação.

### Falha 4 — `StudentDashboard.test.tsx` (1 teste)

- **Teste:** `mostra Treinos sempre, mesmo sem features`.
- **Comportamento esperado (teste):** link "Treinos" **e** mensagem
  `"Seu plano ainda não tem módulos liberados"` ao mesmo tempo (features `[]`).
- **Comportamento real:** com Treinos sempre visível, `visible.length ≥ 1`
  sempre → a mensagem de empty state é **inalcançável**.
- **Investigação (a mais profunda):**
  - `components/student/StudentDashboard.tsx`: `SECTIONS` define o card
    "Treinos" com `feature: null` (comentário no código: *"Treinos é sempre
    liberado (tier gratuito)"*). A mensagem de empty state só renderiza quando
    `visible.length === 0` — impossível com Treinos sempre presente.
  - `docs/security/plans.md` L42: **`workouts` (sempre liberado)** — regra de
    produto documentada.
  - `frontend/lib/types.ts` L70: `FEATURES` → `{ value: "workouts", ...
    desc: "Treinos e histórico (tier gratuito)" }`.
  - Commit `a7a047d` (Checkpoint 1): comportamento trazido na integração do
    working tree V2, intencional.
  - Os testes 3 e 5 da mesma suíte (plano completo / perfil `null`) **exigem**
    Treinos visível sempre — o teste 1 contradizia a própria suíte.
- **Causa:** **TESTE INCORRETO** — asserção internamente contraditória (pede
  Treinos visível E empty state simultaneamente).
- **Decisão:** proteger a regra real: Treinos sempre visível (tier gratuito),
  empty state inalcançável, módulos extras (Dietas/Ranking) ocultos sem
  feature. O ramo `visible.length === 0` do componente foi **mantido** como
  guarda defensiva (não é remoção de código/alteração de comportamento).
- **Alteração:** asserções atualizadas: Treinos presente, mensagem de empty
  state `not.toBeInTheDocument()`, Dietas/Ranking ausentes; título do teste
  explicitando "(tier gratuito)" + comentários com a referência
  `docs/security/plans.md`. Nenhuma mudança de implementação.

### Extra — `vitest.setup.ts` (achado de build)

- O `npx tsc --noEmit` e o `next build` falhavam com
  `TS2304: Cannot find name 'afterEach'` no `vitest.setup.ts` (o `globals:
  true` do Vitest não tipa o TS sem import).
- **Causa:** setup usava o global `afterEach` sem import.
- **Correção:** `import { afterEach } from "vitest";` — explícito, sem tocar
  tsconfig/gates. Typecheck/build voltaram a passar.

## 5. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/__tests__/mealsToText.test.ts` | Asserções alinhadas ao contrato real de preservação de nomes + horário; comentários |
| `frontend/__tests__/EmptyDietState.test.tsx` | Asserção do texto de orientação alinhada ao produto real |
| `frontend/__tests__/StudentDashboard.test.tsx` | Teste do tier gratuito corrigido (sem contradição); comentários |
| `frontend/vitest.setup.ts` | Import explícito de `afterEach` (corrige TS2304 no build) |
| `frontend/package.json` / `package-lock.json` | (já presentes no working tree) deps + scripts da Fase 2 |
| `frontend/vitest.config.mts` | (já presente) config Vitest — sem mudanças nesta execução |

Nenhuma alteração em `app/`, `components/` (produção), backend, rules,
configuração de build/deploy.

## 6. Validações (resultados reais)

- **Vitest** (`npx vitest run`): **6 arquivos / 28 testes — 28 passando, 0
  falhando** ✅ (rodado 2×, antes e depois do fix no setup).
- **Typecheck** (`npx tsc --noEmit`): **PASSOU** ✅ (após fix do setup).
- **Build** (`npm run build`): **PASSOU** ✅ — 1ª execução caiu com crash do
  worker do Next/Turbopack (`code 3221225477`, acesso inválido de memória,
  durante "Collecting page data"); **reexecução idêntica passou** (transitório,
  sem mudança de código entre as duas). 20 rotas geradas.
- **Lint** (`npm run lint`): **42 problemas — 31 erros + 11 warnings**, todos
  **pré-existentes** (idêntico à dívida registrada no `progress.md` antes da
  Fase 2); **nenhum** problema nos arquivos da Fase 2 (`__tests__/`,
  `vitest.*`).
- **Backend** (`go test -count=1 ./...`): **PASSOU** ✅ (todos os pacotes,
  rodada fresca sem cache — sem regressão; frontend-only).
- **Sem** `.only` / `.skip` / `test.todo` nos testes (grep) ✅.
- **Nota:** o Vite emite um *warning* informativo de que `vite-tsconfig-paths`
  é redundante (o Vite agora resolve tsconfig paths nativamente). Não é erro e
  não afeta gates — mantido para não aumentar escopo.

## 7. Segurança/regressão

- **Nenhum impacto** em autenticação, autorização, roles, features, API ou
  backend: apenas arquivos de teste + `vitest.setup.ts`.
- **Produção/V1**: intocada. Nenhum build/deploy/push executado.
- **Mocks**: apenas `vi.mock("@/lib/auth")` no `StudentDashboard.test` e
  `vi.mock("@/lib/firebase")` + `vi.mock("@/lib/config")` no `auth-demo.test`
  (modo demo por design do próprio `AuthProvider`) — já existentes no working
  tree, sem mocks novos introduzidos nesta execução.
- **Sem** remoção de testes, `skip`/`only` ou enfraquecimento de asserções:
  asserções corrigidas continuam validando intenção e conteúdo funcional.

## 8. Decisões importantes

1. **`mealsToText`**: contrato = preservar conteúdo do legado (nomes como
   estão) + horário no cabeçalho quando presente. Capitalização é apresentação
   e **não** será normalizada. Testes ajustados; implementação intacta.
2. **`EmptyDietState`**: texto real do produto ("Adicione uma refeição ou
   plano alimentar para acompanhar a nutrição do aluno.") mantido; teste
   ajustado à intenção do produto.
3. **`StudentDashboard`/Treinos**: **`workouts` é tier gratuito, sempre
   liberado** (fonte: `docs/security/plans.md` + `lib/types.ts` FEATURES).
   Consequência: o dashboard de aluno **nunca** exibe o empty state "ainda não
   tem módulos" — o ramo continua como guarda defensiva no código.
4. **`vitest.setup.ts`**: import explícito de `afterEach` (em vez de
   `"types": ["vitest/globals"]` no tsconfig) — menor superfície de mudança,
   sem mexer em config de build do Next.

## 9. Estado final

- Fase 2 **concluída**: Vitest 28/28 verde, typecheck limpo, build verde,
  lint sem novos problemas, backend verde.
- Working tree contém somente mudanças da Fase 2 (deps + config + 6 arquivos
  de teste), prontas para checkpoint.
- Dívida de lint (31/11) permanece registrada como retaguarda.

## 10. Próximo passo

**Planejamento/implementação dos testes E2E com Playwright**:
- setup do Playwright (`playwright.config.ts`, `@playwright/test`, browsers),
- fluxos críticos: login, aprovação de cadastro, conclusão de treino,
  dashboard/ranking — seguindo a estratégia de testes da documentação.
- Fase 2 concluída. Próximo passo: planejamento/implementação dos testes E2E
  com Playwright.