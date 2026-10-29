# Harmattan

A stablecoin-powered cross-border payment sandbox API: multi-currency wallets (cNGN, cGHS, cXAF, USDx, EURx),
deposits, FX swaps and cross-currency transfers with exact money math, idempotency and concurrency safety.

<!--
README checklist (docs/REQUIREMENTS.md D6). Remove this comment when complete.
[ ] cool name                        [ ] stack + why                  [ ] DB choice justified
[ ] setup + run (docker compose up)  [ ] how to run tests             [ ] endpoint walkthrough w/ real req/res
[ ] data model                       [ ] money precision              [ ] idempotency
[ ] concurrency                      [ ] FX failure handling          [ ] assumptions / limitations / more time
-->

## Quick start
```bash
docker compose up --build
# API:     http://localhost:3000/v1
# Swagger: http://localhost:3000/docs   (spec committed as openapi.json)
```
Migrations and seed data run automatically on startup.

## Running tests
```bash
corepack enable && yarn install
yarn test          # unit + e2e; requires Docker (Testcontainers starts Postgres)
```

## Tech stack & why
| | Choice | Why |
|---|---|---|
| Runtime | Node 24 LTS, TypeScript strict | |
| Framework | NestJS 12 + `@nestjs/cqrs` | |
| Architecture | Clean Architecture, CQRS-lite | |
| Database | PostgreSQL 17 | see below |
| ORM | Drizzle (`@nestjs/drizzle`) | |
| Validation | Zod 4 (Standard Schema) | |
| Tests | Vitest + Supertest + Testcontainers | |
| Cache/queue | None (ADR-011) | |

### Why PostgreSQL
<!-- ADR-002 -->

## Architecture
<!-- layers diagram (mermaid) + command/query flow; ADR-010 -->

## API walkthrough
<!-- REAL responses from the running container -->
### Create a wallet
### Get wallet balances (+ total in USD)
### Deposit
### Swap
### Transfer
### Transaction history
### Get a transaction
### FX rates

## Data model
<!-- ER diagram (mermaid) + table notes; ADR-008 -->

## How we handle…
### Money precision
### Idempotency
### Concurrency
### FX rate failures

## Assumptions
## Known limitations
## What I'd do with more time
