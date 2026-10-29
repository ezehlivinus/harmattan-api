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
Migrations and seed data run automatically on startup. Ports can be changed with `API_PORT` and
`DB_PORT` (defaults 3000 and 5432), e.g. `API_PORT=8080 docker compose up --build`.

### Local development
```bash
corepack enable && yarn install
cp .env.example .env
docker compose up -d db          # Postgres only
yarn db:migrate
yarn start:dev
```

## Running tests
```bash
corepack enable && yarn install
yarn test          # unit + e2e; requires Docker (Testcontainers starts Postgres)
yarn test:unit     # domain and handler tests, no Docker needed
yarn test:e2e      # HTTP tests against a real Postgres container
```

The OpenAPI spec is committed as `openapi.json`; regenerate it with `yarn openapi` after changing an
endpoint (an e2e test fails when it is out of date). Health check: `GET /health`.

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
| Cache/queue | None (ADR-011) | Money moves synchronously in one Postgres transaction; FX uses a 1 h in-memory cache with DB fallback |

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
- FX: the free provider refreshes rates once a day, so rates are at most about 24 h old even when `source` is `LIVE`. The built-in fallback table (used only if the provider has never been reached) is a snapshot from 2026-10-29 and drifts from the market.
- FX: the rates cache is per process (single instance assumed, ADR-011); several replicas would each call the provider (still within its hourly guidance).

## What I'd do with more time

## Credits
Exchange rates: [Rates By Exchange Rate API](https://www.exchangerate-api.com) (open.er-api.com free endpoint; attribution required by its terms).
