# API — Proposta profissional (V2)

Status: Proposta na Fase 0 (aprovação pendente). Base = rotas reais da V1
(`backend/main.go`, `backend/handlers/`). Endpoints NÃO implementados ainda —
só contrato.

## Princípios do contrato

1. **Auth**: toda rota (exceto `/health`) exige `Authorization: Bearer <idToken>`
   do Firebase Auth.
2. **JSON-to-JSON**: request e response sempre `application/json` (exceto 204).
3. **Erros consistentes** (não mais `http.Error` com texto solto):
   - 400 `{"error":{"code":"invalid_body","message":"..."}}` — payload mal formado;
   - 401 `{"error":{"code":"unauthorized","message":"token ausente/invalido"}}`;
   - 403 `{"error":{"code":"forbidden","message":"cadastro pendente" | "recurso nao incluido no plano" | "sem permissao"}}`;
   - 404 `{"error":{"code":"not_found","message":"..."}}`;
   - 409 `{"error":{"code":"plan_in_use","message":"plano em uso"}}` (exclusão);
   - 500 `{"error":{"code":"internal","message":"erro interno"}}`.
4. **Paginação**: listagens devolvem cursor/offset consistentes (padrão V1 já
   usado no feed: `cursor` `<milli>,<id>`; histórico: `offset/limit`). V2
   padroniza: respostas com `{ items, nextCursor }` ou `{ entries, total,
   offset, limit, hasMore }`.
5. **Timezone**: datas de negócio sempre `YYYY-MM-DD` (`America/Recife`);
   timestamps ISO-8601 com timezone.

## Rotas atuais da V1 (referência — base do contrato)

### Público
| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check |

### Modo original (preservado)
| Método | Rota | Descrição |
|---|---|---|
| GET/PUT | `/api/sessions/{week}/{day}` | Lê/salva treino original |
| GET/PUT | `/api/prs` | Recordes pessoais |
| GET/PUT | `/api/state` | Posição (semana/dia) |

### Perfil
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/me` | Perfil próprio (+cria se não existe, pending_approval) |
| PUT | `/api/me` | Atualiza dados de perfil (sem campos admin) |

### Usuários (admin)
| Método | Rota |
|---|---|
| GET/POST | `/api/users` |
| GET/PUT/DELETE | `/api/users/{id}` |
| GET | `/api/users/pending` |
| POST | `/api/users/{id}/approve` |
| POST | `/api/users/{id}/reject` |
| POST | `/api/users/{id}/assign-plan` |

### Planos (admin)
| Método | Rota |
|---|---|
| GET/POST | `/api/plans` |
| GET/PUT/DELETE | `/api/plans/{id}` |

### Alunos
| Método | Rota |
|---|---|
| GET | `/api/students` (nutri: os dele; admin: todos) |
| GET/PUT | `/api/students/{id}` |

### Treinos
| Método | Rota |
|---|---|
| GET/POST | `/api/workouts` |
| GET/PUT/DELETE | `/api/workouts/{id}` |
| POST | `/api/workouts/{id}/duplicate` |

### Dietas
| Método | Rota |
|---|---|
| GET/POST | `/api/diets` |
| GET/PUT/DELETE | `/api/diets/{id}` |
| POST | `/api/diets/{id}/duplicate` |

### Histórico
| Método | Rota |
|---|---|
| GET | `/api/workout-history` |
| POST | `/api/workouts/complete` |

### Rede social (feature community)
| Método | Rota |
|---|---|
| GET/POST | `/api/posts` |
| POST | `/api/posts/{id}/like` |
| POST | `/api/posts/{id}/comments` |
| DELETE | `/api/posts/{id}/comments/{cid}` |
| DELETE | `/api/posts/{id}` |

### Dieta diária (feature diet)
| Método | Rota |
|---|---|
| GET/PUT | `/api/diet-logs` |

### Ranking / pontuação (feature ranking)
| Método | Rota |
|---|---|
| GET | `/api/ranking` |
| GET | `/api/scores/history` |
| GET | `/api/public/profile/{id}` |

## Gate de autorização por rota (padrão V1)

- Rotas de negócio exigem `RequireApproved`; recursos por feature exigem
  `RequireFeature(diet|community|ranking)`; escrita de conteúdo (workouts,
  diets, plans, users, approve/reject/assign) exige `Allow(nutritionist,
  admin)` ou `Allow(admin)` conforme caso.
- **Ordem dos middlewares é crítica** (ver `system-architecture.md`):
  `Require` SEMPRE fora dos gates.
- Ownership: nutricionista acessa somente recursos onde é
  `nutritionistId`; aluno somente os próprios; admin tudo (funções puras em
  `service/access.go`).

## Payloads de referência (V1 — manter contrato)

`UserProfile`, `Plan`, `WorkoutDefine`, `Diet`, `WorkoutHistoryEntry`,
`Post`/`PostComment`, `DietDailyLog`, `ScoreRecord`, `RankingResponse`,
`PublicProfile` — ver `backend/models/types.go`. O V2 não muda nomes de campo
já consumidos pelo frontend (evita quebra de contrato) e documenta cada um
neste arquivo conforme a Fase 1 avança.

## Décisions de API para a Fase 1 (pendentes de definição)

1. **Versionamento**: manter sem versão no path (`/api/...`) ou prefixar
   `/api/v1/...`? Recomenda-se manter como está (V1 em produção) e versionar
   internamente; mudanças de contrato exigem bump explícito.
2. **Rate limit**: V1 deixa `RATE_LIMIT` desligado se vazio — V2 define
   default **rigoroso** em produção (ex.: 120/min/IP) e documenta.
3. **CORS**: V1 default `*` — V2 exige `ALLOWED_ORIGIN` explícito em produção.
4. **Logs** estruturados e **request IDs** no middleware (rastreabilidade).
5. **Transações**: likes/comentários com `RunTransaction` (corrige 3.5).

> Este documento evolui na Fase 1 conforme endpoints reais são definidos;
> na Fase 0 serve de contrato para o design do sistema.