# PLAN: Harmattan

Living task list. Tick as you go; add what you discover. Owner tags (`@A`, `@B`) optional.
Requirement IDs (FR-x, D-x) refer to `docs/REQUIREMENTS.md`.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` cut (explain in README)

---

## Phase 0: Foundation (blocks everything)
- [x] Re-verify versions (`npm view`) for nest core/cli/cqrs/drizzle/swagger, drizzle-orm/kit, zod, vitest, testcontainers, node image → LEARNINGS
- [ ] `nest new` (ESM, Yarn); strict TS + `noUncheckedIndexedAccess`; pin `typescript ~6.0.3` (not 7, see LEARNINGS)
- [ ] `corepack enable` before `yarn` (global yarn here is 1.22)
- [ ] Merge the scaffold's `.gitignore` into the existing one (keep both sets of entries, drop duplicates); don't overwrite README/docs
- [ ] Yarn 4 (`.yarnrc.yml` `nodeLinker: node-modules`, `packageManager` field)
- [ ] Replace oxlint → ESLint flat config + Prettier; `lint`, `format`, `typecheck` scripts
- [ ] husky + commitlint (`@commitlint/config-conventional`, `trailer-exists: [2, 'never', 'Co-Authored-By:']`, `scope-enum`)
- [ ] Clean-arch folder skeleton (`shared/`, `modules/*/{domain,application,infrastructure,presentation}`), `CqrsModule`
- [ ] `@nestjs/config` with Zod-validated env
- [ ] `@nestjs/drizzle` module + `drizzle.config.ts`; `db:generate` / `db:migrate` scripts (fallback per ADR-003)
- [ ] Dockerfile (multi-stage) + `docker-compose.yml` (api, postgres + healthcheck); entrypoint: migrate → seed → start
- [ ] Vitest (unit + e2e projects) + Supertest + Testcontainers; e2e `GET /health` green
- [ ] Swagger at `/docs`; `yarn openapi` writes `openapi.json`

## Phase 1: Shared kernel + schema
- [ ] `shared/domain`: `Currency`, `Money` (parse string, scale 6, roundDown, add/sub/mul, compare), `DomainError`, UUIDv7
- [ ] Unit tests: `"0"`, `"-1"`, `"1e3"`, `"1.0000001"`, `" 5"`, huge values, rounding
- [ ] Drizzle schema: `wallets`, `balances`, `transactions`, `ledger_entries`, `fx_rates`, `idempotency_keys` + CHECK/unique/indexes (cursor index on `(wallet_id, created_at desc, id desc)`)
- [ ] CHECKs: `balances.amount >= 0`, `ledger_entries.amount <> 0`, `transactions` amounts `> 0`; currency column next to every amount (ADR-007)
- [ ] System accounts seeded: `EXTERNAL_SETTLEMENT` and one `FX_POOL` per currency (ADR-008)
- [ ] First migration generated + reviewed by hand
- [ ] `UnitOfWork` port + `DrizzleUnitOfWork` (retry once on 40P01/40001)
- [ ] Error code enum + global exception filter + Zod/Standard Schema pipe; shared `DecimalString`

## Phase 2: Wallets + Deposits + Idempotency (FR-1, FR-2)
- [ ] `CreateWalletCommand` (normalize email/E.164; 409 duplicate; 5 zero balances) → E1
- [ ] `GetWalletQuery` (balances + `totalUsd` + `ratesAsOf`) → E2
- [ ] Idempotency: interceptor (header, hash) + store inside UoW + replay + 422 on reuse
- [ ] `DepositCommand` → E3
- [ ] e2e: wallet duplicate (email, phone formats), deposit happy path, invalid amounts, replay, key reuse

## Phase 3: FX (FR-3, FR-5), parallel track `@B`
- [ ] Verify `open.er-api.com` response shape → LEARNINGS
- [ ] `FxRatesPort` + `ErApiFxProvider` (2s timeout) + cache + fallback chain + persist last-good
- [ ] Seed fallback table
- [ ] `GetRatesQuery` → E8 (5×5 matrix, `source`, `fetchedAt`)
- [ ] Unit: provider down, timeout, malformed body, stale cache, cross-rate math
- [ ] Decide on Redis + BullMQ FX refresher (ADR-011); confirm before adding dependencies

## Phase 4: Swaps + Transfers (FR-3, FR-4)
- [ ] `SwapCommand` → E4 (same-currency 422, insufficient funds 422)
- [ ] `TransferCommand` → E5 (cross-ccy, self-transfer 422, unknown wallet 404, lock order)
- [ ] Transaction stores sender, receiver, src amt/ccy, dst amt/ccy, rate, rate source, fetchedAt, createdAt
- [ ] e2e: happy paths + error cases + exact cross-currency math
- [ ] **Concurrency:** 50 parallel debits vs balance covering 10 → exactly 10 succeed, balance 0
- [ ] **Concurrency:** A→B and B→A in parallel → no deadlock, totals conserved
- [ ] **Idempotency:** 10 parallel identical requests, same key → 1 movement, identical responses
- [ ] Ledger invariant helper runs after every money e2e: Σ ledger per (wallet, currency) == balance, and Σ per (transaction, currency) == 0

## Phase 5: History (FR-5)
- [ ] `ListWalletTransactionsQuery` → E6 (newest first, cursor, `type`, `currency`, IN/OUT direction)
- [ ] `GetTransactionQuery` → E7
- [ ] e2e: page boundaries, combined filters, transfer visible to both sides

## Phase 6: Ship (D1 to D6)
- [ ] `openapi.json` final, examples on every endpoint
- [ ] README complete (checklist in README), walkthrough with real curl output
- [ ] Traceability matrix in REQUIREMENTS.md all ☑
- [ ] Fresh clone → `docker compose up` → walkthrough works → `yarn test` passes
- [ ] Lint/format/typecheck clean; TODOs resolved or moved to README "more time"
- [ ] `git log` review: clean Conventional Commit history
- [ ] Repo public

## Stretch (only after Phase 6)
- [ ] FX quote with `quoteId` + expiry, pinnable by swap/transfer
- [ ] pino structured logs + `X-Request-Id`
- [ ] Rate limiting on money endpoints
- [ ] GitHub Actions: lint + test

## Out of scope
Auth/KYC, fees/spreads, real chain, fiat withdrawals, event sourcing. Redis/queues pending ADR-011.
