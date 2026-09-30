# Area: INFRA, BANCO e DEPLOY

## Onde esta o codigo

**Ponto de entrada da API**
- `backend/main.go` — sobe o servidor, registra as rotas
- `backend/config.go` — **configuracao por variavel de ambiente**
- `backend/handlers/handlers.go` — registro de rotas
- `backend/middleware/http.go` — middleware de HTTP (CORS, log)

**Banco**
- `backend/repository/repository.go` — **toda leitura/escrita do Firestore**
- `backend/service/service.go` — ligacao entre service e repository

**Ajuda**
- `backend/service/errors.go` — erros padrao
- `backend/service/normalize.go` — normalizacao de dado
- `backend/service/timezone.go` — cuidado com data e fuso
- `backend/service/constants.go` — constantes

**Testes**
- `backend/config_test.go` — com `GO_ENV=production` o `ALLOWED_ORIGIN` e obrigatorio,
  `*` e recusado e `RATE_LIMIT=0` e rejeitado
- `backend/middleware/http_test.go` — CORS, Rate Limit, MaxBody e Recover
- `backend/repository/repository_test.go` — slice vazia como `[]`, `createdAt`
  preservado no update e cursor de paginacao
- `backend/main_test.go` e `backend/main_programs_test.go` — cadeia ponta a ponta das rotas
- `firestore-tests/rules.test.js` — regras contra o emulador (nunca contra producao)

**Deploy**
- `docs/` — relatorios de deploy
- `firestore-tests/` — testes de regra com emulador

## Conceitos

- Fluxo da API: `handlers` -> `service` -> `repository` -> Firestore.
  `handlers` nao fala com o banco direto. `repository` nao tem regra de negocio.
- `backend/config.go` le tudo de variavel de ambiente. Nada de valor fixo no codigo.

## Pendencias

<!-- escreva aqui -->
- [ ] `frontend/app/admin/timeline/page.tsx` nao tem nenhum teste
- [ ] nenhum `Benchmark` no `backend` (verificado hoje): nao ha medicao de custo de
      leitura do `backend/service/ranking.go`, apontado abaixo como o mais caro

## Cuidado

- **Deploy mexe em dado real.** Antes de qualquer deploy:
  1. rodar todos os testes
  2. conferir se tem migracao de regra do Firestore
  3. conferir se tem indice novo de query
- Firestore custa por leitura. `backend/service/ranking.go` e o mais caro do projeto
  (le muita coisa para todo aluno). Se ficar lento, comecar por ai.
- `cmd/e2eseed` popula o banco. NUNCA rodar em producao.
