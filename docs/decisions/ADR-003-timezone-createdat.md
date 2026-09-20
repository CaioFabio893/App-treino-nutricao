# ADR-003 — Timezone oficial America/Recife e createdAt imutável

- Status: **Aceito (Fase 0)** — confirma prática já existente na V1 +
  diretriz para o V2
- Data: 2026-09-20

## Contexto

A V1 introduziu `service/timezone.go` (`AppLoc = America/Recife`, `Now()`) e a
preservação de `createdAt` no perfil. A auditoria confirmou que isso funciona
e apontou dois furos: `PutDietLog` regrava `createdAt`, e a persistência
depende do caller para não zerar o campo.

## Decisão

1. **Time zone**: todas as datas de negócio usam `America/Recife` (string
   `YYYY-MM-DD`); `time.Now()` cru é proibido para datas de negócio.
2. **createdAt imutável**: nenhuma escrita de update pode sobrescrever
   `createdAt`. O padrão `userProfileData` (preservar se != zero, senão
   `ServerTimestamp` na criação) vira regra **para todas as entidades**.
3. `PutDietLog` deixa de regravar `createdAt` a cada save (Fase 1).

## Consequências

- Correção de dados históricos (day boundaries bater com o navegador do aluno).
- Refactor de `PutDietLog` e revisão de todos os `Set` de update para nunca
  incluir `createdAt`.
- Testes: adicionar cases de imutabilidade de `createdAt` para dietLogs.