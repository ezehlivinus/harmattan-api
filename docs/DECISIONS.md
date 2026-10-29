# DECISIONS: Architecture Decision Records

One ADR per significant or non-obvious choice. Status: Proposed → Accepted → Superseded.
Never delete; supersede instead. These feed the README "why" sections.

Template:
```
## ADR-NNN: Title
Status · Date
Context · Decision · Consequences
```

---

## ADR-001: Node.js 24 LTS
Accepted · 2026-10-29
Context: Brief requires Node LTS. Node 26 entered Active LTS on 2026-10-28; Node 24 is LTS with a mature ecosystem.
Decision: Node 24 LTS (`node:24-alpine`, verify tag).
Consequences: Corepack still ships with 24 (removed in 25+), so `corepack enable` gives Yarn 4 directly. Avoids adopting an LTS line that is one day old.

## ADR-002: PostgreSQL over MongoDB/MySQL
Accepted · 2026-10-29
Context: Money needs multi-row atomic transactions, conditional updates, CHECK constraints, exact decimals.
Decision: PostgreSQL 17.
Consequences: Balances, ledger and idempotency rows commit together; `numeric` is exact; invariants are enforced by the DB (`CHECK`, unique), not only by code. Mongo would need a replica set for transactions and Decimal128 handling for no gain.

## ADR-003: Drizzle ORM via official `@nestjs/drizzle`
Accepted · 2026-10-29
Context: Need typed SQL, migrations, transactions, `RETURNING`, and SQL expressions for atomic conditional decrements. NestJS now publishes an official `@nestjs/drizzle` (v0.0.2, Sep 2026, peers `@nestjs/core ^11 || ^12`, `drizzle-orm >=0.35`).
Decision: `drizzle-orm` 0.45.x (stable `latest` tag; skip 1.0 rc) + `drizzle-kit` for SQL migrations + `@nestjs/drizzle` for module wiring. `numeric` columns in string mode.
Consequences: SQL stays visible and reviewable; the conditional update is a one-liner (`set amount = amount - x where amount >= x returning`). **Fallback:** `@nestjs/drizzle` is very young. If its API is missing something or blocks for more than 30 min, replace it with a 20-line custom provider (`DRIZZLE` token from `drizzle(pool)`) and note it here. The domain never depends on either.
**Update 2026-10-29:** 0.0.2 verified against Postgres 17 (`forRootAsync` + `ConfigService`, insert `.returning()`, pool closed on shutdown); fallback not needed. Column naming: TS camelCase ↔ SQL snake_case via Drizzle `casing: 'snake_case'`, set in both the runtime client and `drizzle.config.ts`.

## ADR-004: FX via live provider with layered fallback
Accepted · 2026-10-29
Context: Brief prefers live rates with fallback when the provider fails.
Decision: `open.er-api.com` USD base (no key; NGN/GHS/XAF/EUR), verify shape. Chain: memory (TTL 60s) → live (2s timeout) → last-good `fx_rates` (`CACHED`) → seeded table (`FALLBACK`). Units-per-USD stored; cross rate derived at 18 dp. 1 stablecoin = 1 unit of its fiat.
Consequences: The API keeps working when the provider is down; each rate exposes `source` and `fetchedAt`. Seed values can drift from market (documented limitation).

## ADR-005: Idempotency inside the money transaction
Accepted · 2026-10-29
Context: "Never process the same request twice", including concurrent duplicates.
Decision: Required `Idempotency-Key`. `(key, scope)` unique row with `requestHash` and stored response, inserted in the same tx as the movement. A concurrent duplicate blocks on the unique index, then gets a violation and replays the stored response. Hash mismatch → 422.
Consequences: Exactly-once effect with no Redis or locks. Business failures roll back, so the key is not stored and a retry re-evaluates (documented). Keys kept indefinitely in the sandbox.
**Update 2026-10-29:** implemented as `IdempotencyService.execute({ scope, key, payload }, status, work)`. Scope is the operation plus its target (`deposit:<walletId>`), so the same key may be used on two wallets. The hash covers the *normalized* payload (`"100"` and `"100.0"` are the same request). Lookup first (replay or 422); otherwise the work and the key row commit together; a concurrent loser gets the primary-key violation, its whole transaction rolls back, and it replays the winner. The stored body is `json`, not `jsonb`, because `jsonb` reorders object keys and replays must be byte-identical. Key format: 1-255 visible ASCII characters.

## ADR-006: Validation via Zod 4 / Standard Schema
Accepted · 2026-10-29
Context: NestJS 12 accepts Standard Schema in `@Body/@Query/@Param`; Swagger generation from Zod may need glue.
Decision: Zod schemas are the source of truth (shared `DecimalString`, `CurrencyCode`). Verify OpenAPI emission (Nest docs → Zod 4 `toJSONSchema` → `nestjs-zod`).
Consequences: If the OpenAPI glue costs more than 1h, use class-validator DTOs for request bodies and supersede.
**Update 2026-10-29:** output side verified with no glue: `@nestjs/swagger` 12 converts Zod 4 schemas natively (`@ApiOkResponse({ standardSchema })`, via Zod's `~standard.jsonSchema`); literals → `enum`, `required` and `additionalProperties: false` emitted. Request side verified too: Nest 12's built-in `StandardSchemaValidationPipe` (global via `APP_PIPE`) validates `@Body/@Query/@Param({ schema })` and returns the parsed value, and Swagger documents a Zod `@Body` schema as the `requestBody` with no glue. No `nestjs-zod`, no class-validator.

## ADR-007: Money representation
Accepted · 2026-10-29
Context: Three common options for storing money:
- Binary floats (`real`, `double precision`, JS `number`): `0.1 + 0.2 = 0.30000000000000004`, and JS `number` is only exact up to 2^53. Rejected.
- Integer smallest units (`BIGINT`, e.g. `1500.25` stored as `1500250000` micro-units): exact and fast, and it mirrors on-chain token amounts. It requires `BigInt` everywhere in JS, scaling at every API edge, and still a separate scale for FX rates (18 dp).
- Fixed-scale decimal (`NUMERIC(p,s)`): exact base-10. With a fixed scale it is effectively an integer count of smallest units, with the scale enforced by Postgres. Slower arithmetic than integers, which is irrelevant at this volume.

Postgres' `money` type is also rejected: its precision depends on the `lc_monetary` locale.
Decision: Decimal strings in JSON (`"1500.25"`); `NUMERIC(38,6)` amounts, `NUMERIC(38,18)` rates; Drizzle `numeric` in string mode; `decimal.js` for arithmetic. Every amount column has a currency column beside it. Round **down** on conversion; reject input with more than 6 dp instead of rounding it.
Consequences: No float anywhere; SQL and stored values stay human-readable; the DB rejects out-of-scale values. Rounding dust stays with the platform's FX pool (documented).
**Update 2026-10-29:** amounts are returned with a fixed 6 decimals (`"1500.250000"`), the same text Postgres returns for `numeric(38,6)`, so every amount in the API has one canonical form. Input accepts 0–6 decimals. `Money` is non-negative (signs live in ledger postings); 32 integer digits max. Ids are UUIDv7 from Node's built-in `crypto.randomUUIDv7()` (Node ≥ 24.16), so no `uuid` dependency.

## ADR-008: Double-entry ledger + transactions + materialized balances
Accepted · 2026-10-29
Decision: `transactions` (one row per operation) + `ledger_entries` (signed postings per account and currency) + `balances` (running total per wallet and currency, updated in the same tx). Postings for one transaction sum to zero **per currency**, using system accounts that are not wallets: `EXTERNAL_SETTLEMENT` (counterparty for deposits) and `FX_POOL` per currency (counterparty for swaps and cross-currency transfers). Example, swap 1000 cNGN → USDx: wallet cNGN −1000, FX_POOL cNGN +1000, FX_POOL USDx −0.625, wallet USDx +0.625.
Consequences: O(1) balance reads; auditable history; the FX pool shows platform exposure and rounding dust. Invariant tests: Σ ledger per (wallet, currency) == balance, and Σ per (transaction, currency) == 0. `CHECK (amount <> 0)` on postings; system accounts have no non-negative constraint.
**Update 2026-10-29:** system accounts are not rows. A posting names its account as `(account_type, wallet_id, currency)`: `(WALLET, <id>, ccy)`, `(EXTERNAL_SETTLEMENT, NULL, ccy)` or `(FX_POOL, NULL, ccy)`, enforced by `CHECK ((account_type = 'WALLET') = (wallet_id IS NOT NULL))`. No accounts table and no seed; an FX pool's position is `SUM(amount)` over its postings. Transactions carry `source_*`/`destination_*` columns with DB CHECKs for each type's shape (DEPOSIT: no sender, same currency and amount; SWAP: one wallet, two currencies; TRANSFER: two wallets) and for the FX fields (rate = 1 and no source iff same currency).

## ADR-009: Testcontainers for e2e
Accepted · 2026-10-29
Decision: `@testcontainers/postgresql` starts Postgres once per run; migrations applied; tables truncated between tests.
Consequences: `yarn test` needs Docker (documented). Fallback: `TEST_DATABASE_URL` → `docker compose up db`.

## ADR-010: Clean Architecture + CQRS-lite
Accepted · 2026-10-29
Context: Clear boundaries make money rules easy to find and test. Writes (strict invariants) and reads (history, filters, USD totals) have different shapes.
Decision: Per-module `domain / application / infrastructure / presentation`. Domain is framework-free. `@nestjs/cqrs` `CommandBus` for deposits, swaps, transfers, wallet creation; `QueryBus` for reads that go straight to Drizzle read models. `UnitOfWork` port wraps `db.transaction`. **No** event sourcing, sagas or separate read DB.
Consequences: Business rules are unit-testable without a DB; money mutation has exactly one path. Costs some boilerplate, kept proportional (no repository for read-only queries, no domain events unless needed).
**Update 2026-10-29 (transactions):** checked alternatives first. NestJS has no official transaction package; `nestjs-cls` + `@nestjs-cls/transactional` (Drizzle adapter available) is third-party (the Nest docs call `nestjs-cls` "not managed by the NestJS core team") and propagates the transaction implicitly through AsyncLocalStorage with a `@Transactional()` decorator. Kept the explicit port: `UnitOfWork.run(tx => ...)` with an opaque `TransactionContext` keeps the application layer free of framework decorators, makes the transaction boundary visible in every money handler, and owns the deadlock/serialization retry (once), which neither alternative provides.

## ADR-011: No Redis or queue initially
Proposed · 2026-10-29
Context: The brief allows Redis/BullMQ/RabbitMQ only where they earn their place. Money movements must be synchronous ("balance updates immediately") and atomic in Postgres; idempotency already lives in the same transaction (ADR-005), so a queue or Redis adds nothing to correctness.
Decision: Start without Redis or a queue. Candidates that could justify one: a BullMQ repeatable job that refreshes FX rates so requests never wait on the provider; a shared cache and rate limiting once there are several API replicas; webhook or settlement delivery. Revisit while building FX (Phase 3).
Consequences: One fewer service in `docker compose`. The in-memory FX cache is per process, which is fine for a single instance (documented).
