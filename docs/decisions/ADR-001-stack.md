# ADR-001 — Manter Go + Next.js + Firestore no V2

- Status: **Aceito (Fase 0 — proposto, validação no checkpoint)**
- Data: 2026-09-20

## Contexto

O V2 poderia trocar de stack. Avaliamos Go vs Node.js (backend) e Firestore vs
PostgreSQL (banco), conforme `docs/architecture/technology-decision.md`.

## Decisão

Manter a stack V1: **Go 1.23** (API), **Next.js 16** (front) e **Firestore**
(banco), com corte do login Google (ADR-002).

## Consequências

- Vantagens: reuso dos 77 testes Go, menor risco, cadência rápida, custo zero.
- Custos: manter índices/regras do Firestore sob controle (Emulator no V2),
  e reconstruir o front com design system + testes (que hoje não existem).

## Alternativas rejeitadas

Node/Fastify, Vite SPA estático, Supabase/Postgres, auth própria — ver
tabela de rejeição no documento de decisão tecnológica.