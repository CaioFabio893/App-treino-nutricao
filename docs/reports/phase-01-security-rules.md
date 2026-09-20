# Relatório — Fase 1 (2ª execução): Firestore Emulator + Security Rules

**Data:** 20 set 2026
**Escopo:** somente Firestore Emulator + Security Rules (sem frontend, sem deploy, sem commit/push).

---

## 1. Objetivo

Configurar o Firebase Emulator Suite e criar testes automatizados das
Security Rules do Firestore (TDD Red → Green → Refactor) que rodam
**exclusivamente contra o emulador**. O gatilho é de segurança: a configuração
pública do Firebase Web permite que qualquer um conecte o Firestore direto pelo
SDK cliente, então as regras precisam impedir contorno da API Go — que é o
único caminho autorizado (Admin SDK ignora regras).

## 2. O que mudou

### `firebase.json` (achado A5)
- Adicionado bloco `emulators.firestore` (host `127.0.0.1`, porta **8080**) e
  desativada a UI. O Emulator agora é configurável com `firebase emulators:exec`.

### `firestore.rules` (endurecimento + correção de bug)
1. **Bug corrigido**: `sensitiveChanged()` comparava os campos sem tratar a
   ausência deles no documento original — `update` de perfil sem `planID` etc.
   quebrava com `Property ... is undefined` no emulador (e possivelmente com
   erro de avaliação em produção). Novo `fieldChanged()` tolera pares
   existente/inexistente.
2. **Aprovação (status) espelha o backend**: nova `isApprovedUser()` reflete
   `middleware.IsApproved` (`""` | `active` | `paused`) + bypass de admin.
   `pending_approval`, `rejected` e `inactive` (bloqueado) ficam **fora** de
   todos os recursos de negócio: posts, dietLogs, plans, scores,
   scores_history e feeds. (A V1 não tem `blocked` — achado A10 — e a regra é
   whitelist: qualquer status fora de `["", active, paused]` é negado, o que
   cobre um eventual `blocked` no futuro.)
3. **Escrita administrativa pelo SDK cliente → negada**: `users`
   `update`/`delete` e `plans` `write` deixaram de aceitar `isAdmin()`; escrita
   de `posts`, `dietLogs`, `plans`, `scores`, `scores_history`, `workouts`,
   `diets`, `workoutHistory` passou a ser **só API Go** (`allow ... if false`).
   Admin continua podendo LER qualquer perfil via regras (leitura
   administrativa é compatível com o mecanismo autorizado).
4. `users/{uid}` `read` continua `isOwner || isAdmin`; `create` continua
   restrito a `isPendingSelfProfile()` (regra 3.1 mantida); subcoleções do modo
   original (`sessions`, `prs`, `state`) continuam dono-only.

### `firestore-tests/` (novo — achado A14)
- `package.json` com `@firebase/rules-unit-testing@3.0.4`, `firebase@10.14.1` e
  `mocha@10.8.2`; script `npm test` sobe o emulador e roda a suíte.
- `rules.test.js` — **35 testes** cobrindo os 8 cenários exigidos + regressão:
  1. Criar `users/{uid}` com `role: admin` / `status: active` / `planID` /
     `features` / `nutritionistID` → **NEGADO** (regressão explícita do
     auto-promote) e perfil pendente sem campos admin → permitido.
  2. Mudanças posteriores de `role`/`status`/`planID`/`features`/
     `nutritionistID` por conta livre → **NEGADO**; dados não administrativos
     do próprio perfil → permitido.
  3. Acesso ao próprio perfil (ativo e pendente) → permitido.
  4. Perfil/subcoleção de outro usuário → **NEGADO**; própria subcoleção →
     permitido.
  5. `inactive`/`rejected` (bloqueados) lendo posts, planos, scores ou criando
     post → **NEGADO**.
  6. `pending_approval` lendo posts/planos ou criando post → **NEGADO**.
  7. Nutricionista lendo dietLog/scores_history de aluno **de outro
     nutricionista** → **NEGADO**; do próprio aluno e admin → permitido.
  8. Admin escrevendo via SDK cliente (role de outro, plano, delete de usuário)
     → **NEGADO** (só API Go); admin lendo perfil alheio → permitido;
     não autenticado → **NEGADO**.

## 3. TDD (Red → Green)

- **Red**: com as regras antigas, 14 testes falharam — exatamente os que expõem
  as falhas de segurança: bloqueados/pendentes liam posts/planos/scores,
  admin escrevia via SDK, e o bug do `sensitiveChanged` quebrava o update de
  perfil.
- **Green**: após o endurecimento, **35/35 passam**.
- **Refactor**: `fieldChanged()`/`isApprovedUser()` extraídos; `meExists()`
  separado de `me()` (evita evaluation error em doc inexistente).

## 4. Validações executadas

| Gate | Resultado |
|---|---|
| `npm test` (firestore-tests) | ✅ 35 passing |
| `go test ./...` | ✅ 91 testes (backend intacto) |
| `go vet ./...` | ✅ limpo |
| `firebase emulators:exec --only firestore` | ✅ emulador sobe/derruba com sucesso |

## 5. Cenários de segurança comprovados (resumo)

1. Auto-proclamação de admin/plano/turma no cadastro → **impossível** (regressão).
2. Escalada posterior de privilégio via update do próprio perfil → **impossível**.
3. Perfil próprio lido conforme a política (inclusive pendente).
4. Dados de terceiros → **inacessíveis** sem vínculo autorizado.
5. Usuários bloqueados (`inactive`/`rejected`) → **sem acesso** a recursos de
   negócio (whitelist de status também cobre `pending_approval` → cenário 6).
6. Usuário pendente → sem operações de usuário ativo.
7. Nutricionista → somente alunos vinculados a ele (isolamento por
   `nutritionistID`); admin lê tudo.
8. Operação administrativa → funciona **somente** pela API Go (SDK cliente
   negado mesmo para role `admin`; leitura administrativa via regras é segura).

## 6. Decisões de segurança registradas

1. **Escrita = só API Go.** `firestore.rules` nega toda escrita de dados de
   negócio via SDK cliente; Admin SDK (API Go) ignora as regras e é o único
   caminho de escrita.(`users` create-only-pending e subcoleções do modo
   original são as únicas exceções legadas).
2. **Aprovação espelhada no backend**: `isApprovedUser()` = `"" | active |
   paused` (+ admin). Qualquer status fora disso (incluindo futuro `blocked`,
   achado A10) é negado automaticamente por whitelist.
3. **Admin lê, não escreve, via regras**: leitura administrativa permitida;
   escrita administrativa direta negada — mesmo `role: admin` não consegue
   update/delete de `users` nem write de `plans` pelo SDK.

## 7. Comandos úteis

```powershell
# Um comando: sobe o emulador, roda os testes e derruba
cd firestore-tests
npm test

# Backend (inalterado, só confirmação)
cd backend
go test ./...
go vet ./...
```

## 8. Próximos passos recomendados (fora deste escopo)

- [ ] Frontend: setup Vitest/Playwright + primeiros testes (risco alto).
- [x] ~~Índice versionado `users(role ASC, nutritionistID ASC)` (achado A3)~~ →
      **decisão: NÃO criar** (index-merge atende; ver
      `docs/reports/phase-01-hardening.md` seção 4).
- [ ] Harmonizar pergunta em aberto do status `blocked` vs `paused/inactive`
      (achado A10) — as regras já aceitam qualquer status fora da whitelist.
- [ ] Revisar se subcoleções do "modo original" continuam necessárias (única
      exceção de escrita cliente restante).
- [x] ~~Hardening de produção: ALLOWED_ORIGIN obrigatório, rate limit default~~ →
      **concluído** — CORS estrito, rate limit por ambiente + `Retry-After` e
      allowlist de `users` (relatório `docs/reports/phase-01-hardening.md`).