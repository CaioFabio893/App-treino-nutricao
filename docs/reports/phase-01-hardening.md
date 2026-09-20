# Relatório — Fase 1 (3ª execução): Hardening de produção (CORS, rate limit, allowlist de users)

**Data:** 20 set 2026
**Escopo:** CORS estrito + rate limit com defaults por ambiente + allowlist
estrita de `users` update no Firestore + decisão do achado A3. Sem frontend,
sem deploy, sem commit/push (governança do projeto — tudo fica no working tree).

---

## 1. Objetivo

Eliminar os três pontos abertos de segurança de produção identificados na
auditoria (Fase 0) e mantidos até esta execução:

1. **CORS liberado** — o boot caía em `ALLOWED_ORIGIN="*"` quando a variável
   não existia (`backend/main.go`), e o middleware ecoava qualquer origem.
2. **Rate limit desativado por default** — `RATE_LIMIT=0` (ou ausente)
   desativava a proteção; 429 não informava quando tentar de novo.
3. **`users` update por SDK de cliente** — `sensitiveChanged()` protegia os
   campos administrativos, mas **não cobria `createdAt` nem `authProvider`** e
   não impedia combinações "campo legítimo + campo sensível" se o campo sensível
   não estivesse na lista.

Regras de execução seguidas: TDD (Red → Green → Refactor), nenhuma mudança de
contrato público de API, cadeia de middleware preservada (Recover → MaxBody →
RateLimit → CORS → SecurityHeaders → mux) e nenhum endpoint alterado.

## 2. O que mudou

### `backend/config.go` (novo) + `backend/main.go`

`loadConfig(getenv)` carrega e valida o hardening **uma única vez no boot**
(fail-fast com `log.Fatalf` — nunca cai em fallback permissivo):

| Variável | Produção (`GO_ENV=production`) | Dev/teste (qualquer outro `GO_ENV`) |
|---|---|---|
| `ALLOWED_ORIGIN` | **Obrigatório** — ausente = boot rejeitado; `*` sempre rejeitado | Default `http://localhost:3000` (nunca `*`); override livre |
| `RATE_LIMIT` | Default **120** req/min/IP; `0`/inválido = boot rejeitado | Default **600** req/min/IP; override livre |

- `GO_ENV` não existia no projeto — foi introduzido agora como o seletor de
  ambiente de produção. Sem `GO_ENV`, o comportamento é dev/teste (defaults
  permissivos, porém ainda nunca `*`).
- `main.go` agora monta a cadeia com os valores validados: `CORS(cfg.allowedOrigin)`
  e `RateLimit(cfg.rateLimit, cfg.rateWindow)`.

### `backend/middleware/http.go`

- **CORS estrito**: removeu o wildcard. Origem permitida → `Access-Control-
  Allow-Origin` ecoa a origem exata + `Vary: Origin` (lista por vírgula
  continua suportada — compatível com a V1). Origem fora da lista → **403 sem
  `Access-Control-Allow-Origin`** (requests reais **e** preflights são
  bloqueados no middleware, antes do handler). Request sem header `Origin`
  (curl, healthcheck, mesma origem) → passa direto, sem headers de CORS.
- **Rate limit**: `allow(key)` agora devolve `(ok, tempo até o reset)` e o 429
  inclui **`Retry-After` em segundos** (arredondado para cima, mínimo 1s).
  Política de key por IP **inalterada** (1º elemento de `X-Forwarded-For`, com
  fallback `RemoteAddr`) — decisão e risco documentados na seção 5.

### `firestore.rules`

Substituiu `fieldChanged()`/`sensitiveChanged()` por **allowlist estrita**:

```javascript
function allowedSelfProfileUpdate() {
  return request.resource.data.diff(resource.data).affectedKeys().hasOnly([
    'name', 'email', 'photoURL', 'bio'
  ]);
}
```

- `allow update: if isOwner(uid) && allowedSelfProfileUpdate();`
- Derivada do comportamento real do produto: o frontend **não usa SDK de
  Firestore** (só `firebase/app` para auth); todas as escritas passam pela API
  Go (Admin SDK ignora regras). Os únicos campos que `PUT /api/me` recebe no
  fluxo real são `name` e `email` (ProfileSetup e página do nutricionista);
  `photoURL`/`bio` são dados de perfil não privilegiados aceitos pela mesma
  rota. **`role`/`status` enviados pelo ProfileSetup são removidos/no-op no
  backend** (`service/profile.go` preserva os campos de controle).
- Efeito: qualquer chave fora da lista — `role`, `status`, `planID`,
  `features`, `nutritionistID`, `approvedBy`, `approvedAt`, `rejectedReason`,
  **`createdAt`, `authProvider`**, e também `startDate`/outros — nega o update
  **inteiro** (inclusive combinações "name + role", "name + status" etc.).
  Regressões da suíte anterior (campos administrativos negados, updates
  legítimos permitidos) continuam passando.

### Testes novos (TDD)

| Arquivo | Casos | O que cobre |
|---|---|---|
| `backend/config_test.go` | 10 | Boot: prod sem `ALLOWED_ORIGIN` → erro; origem válida aceita; `*` rejeitado (todos os ambientes); dev default localhost; override de origem; defaults de rate limit por ambiente (120/600); override; prod `RATE_LIMIT=0` → erro; valor não numérico → erro |
| `backend/middleware/http_test.go` | 11 | CORS: eco+`Vary: Origin`, 403 sem ACAO, pass-through sem Origin, preflight 204/403, lista multi-origem. Rate limit: dentro do limite, 429+`Retry-After` (1..60s), IPs diferentes com orçamento independente, key pelo 1º XFF, `limit<=0` desativa |
| `firestore-tests/rules.test.js` | 18 | Allowlist: cada campo protegido negado (incl. `createdAt` e `authProvider`); `name`/`email`/multi permitidos; combinações legítimo+sensível negadas; documento administrativo completo negado |

## 3. TDD (Red → Green)

- **Red (backend)**: `config_test.go` não compila (sem `loadConfig`); 5 testes
  de middleware falham (sem `Vary`, sem 403, preflight não bloqueado, sem
  `Retry-After`); 2 testes de regras falham (**`createdAt` e `authProvider`
  atualizáveis pelo SDK** — confirmação objetiva do buraco).
- **Green**: após implementação, **112 testes Go** (antes 91) e **53 testes de
  regras** (antes 35).
- **Refactor**: `allow()` devolve duração de retry intacta; configuração
  isolada em `config.go` (injeção de `getenv`); comentários de migração
  documentam cada decisão.

## 4. Decisão do achado A3 — índice composto `users(role, nutritionistID)`

**Decisão: NÃO criar o índice.** `ListStudents` consulta
`Where(role == "student")` + `Where(nutritionistID == X)` **sem** `orderBy` e
sem range. Segundo a documentação do Firestore, consultas de igualdade em
múltiplos campos são atendidas por **index-merge** (cada `Where` usa o índice
de campo único). Um índice composto `users(role ASC, nutritionistID ASC)` só
seria exigido por consulta com `orderBy` sobre esses campos combinados, o que
não existe hoje. `firestore.indexes.json` **não foi alterado**. Se no futuro um
ranking/ordenação exigir a combinação, o índice deverá ser adicionado **com
teste de regressão** primeiro (lição do incidente histórico com `dietLogs`).

## 5. Identificação de IP atrás do Cloud Run — decisão e risco residual

- **Comportamento mantido (herdado da V1)**: `clientIP()` usa o **primeiro
  elemento de `X-Forwarded-For`**, com fallback para o host de `RemoteAddr`.
- **Contexto Cloud Run (pesquisa documentada)**: o primeiro endereço do XFF é
  tipicamente o IP do cliente, e o GCP **anexa** os IPs dos proxies/LBs por
  onde a requisição passou (o cliente não consegue remover o IP real da cadeia
  em conexões através do LB/Ingress).
- **Risco residual**: um cliente HTTP pode **forjar** um valor no início do
  XFF; se todos os clientes fazem isso, o rate limit por IP pode ser
  contornado (bom = cliente vira atacante de si mesmo se usar o próprio IP
  real; o ataque limita-se a rotacionar o cabeçalho). A troca pela política
  "último IP confiável antes do proxy GCP" é uma decisão de produto/segurança
  que **não foi feita nesta execução** para preservar a paridade com o
  comportamento já deployado. **Mitigação barata disponível no futuro**:
  restringir XFF a uma faixa de proxies confiáveis ou usar o `Forwarded`
  padronizado — avaliar se o fator-limitante do rate limit se tornar real.

## 6. Validações executadas

| Gate | Resultado |
|---|---|
| `go test -count=1 ./...` (backend) | ✅ **112 testes** (91 antigos + 21 novos) |
| `go vet ./...` | ✅ limpo |
| `go build .` | ✅ compila |
| `npm test` (firestore-tests, emulador) | ✅ **53 testes** (35 antigos + 18 novos) |
| Cadeia de middleware | ✅ ordem preservada (Recover → MaxBody → RateLimit → CORS → SecurityHeaders → mux) |

## 7. Cenários de segurança comprovados (resumo)

1. Boot em produção sem `ALLOWED_ORIGIN` → **recusa subir** (sem fallback `*`).
2. `ALLOWED_ORIGIN=*` → **rejeitado em qualquer ambiente**.
3. Origem não confiável → **403 sem `Access-Control-Allow-Origin`** (navegador
   não expõe a resposta); preflight também bloqueado.
4. Diferença de política de CORS por origem sincronizada com caches (`Vary:
   Origin`) → sem vazamento cross-origin por cache compartilhado.
5. Rate limit **ligado por default em todos os ambientes**; produção rejeita
   `0`/inválido — "off" só é possível explícito e fora de produção.
6. 429 informa **quando** tentar de novo (`Retry-After`).
7. `createdAt`, `authProvider` e demais campos de controle do perfil →
   **imunes a update via SDK** (anti-regressão com teste dedicado).
8. Combinação "dado legítimo + campo sensível" no mesmo update → **update
   inteiro negado** (`affectedKeys().hasOnly`).

## 8. Comandos úteis

```powershell
# Backend
cd backend
go test ./...
go vet ./...

# Rules (sobe emulador, roda e derruba)
cd firestore-tests
npm test
```

## 9. Próximos passos recomendados (fora deste escopo)

- [ ] Frontend: setup Vitest/Playwright + primeiros testes (risco alto — único
      front sem testes do projeto).
- [ ] Deploy: definir `GO_ENV=production`, `ALLOWED_ORIGIN=<domínio exato>` e
      `RATE_LIMIT` no Cloud Run (sem isso, a produção usa os defaults dev).
- [ ] Harmonizar pergunta em aberto do status `blocked` vs `paused/inactive`
      (achado A10) — regras seguem whitelist.
- [ ] Reavaliar a política de `X-Forwarded-For` se o rate limit por IP virar
      fator-limitante real (seção 5).