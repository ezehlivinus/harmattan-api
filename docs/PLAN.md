# PLAN: Harmattan

Living task list. Tick as you go; add what you discover. Owner tags (`@A`, `@B`) optional.
Requirement IDs (FR-x, D-x) refer to `docs/REQUIREMENTS.md`.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` cut (explain in README)

---

## Phase 0: Foundation (blocks everything)
- [x] Re-verify versions (`npm view`) for nest core/cli/cqrs/drizzle/swagger, drizzle-orm/kit, zod, vitest, testcontainers, node image → LEARNINGS
- [x] `nest new` (ESM, Yarn); strict TS + `noUncheckedIndexedAccess`; pin `typescript ~6.0.3` (not 7, see LEARNINGS)
- [x] Merge the scaffold's `.gitignore` into the existing one (keep both sets of entries, drop duplicates); don't overwrite README/docs
- [x] Yarn 4 (`.yarnrc.yml` `nodeLinker: node-modules`, `packageManager` field)
- [x] Replace oxlint → ESLint flat config + Prettier; `lint`, `format`, `typecheck` scripts (+ lint rule: `domain/` may not import Nest/Drizzle/HTTP or outer layers)
- [x] husky + commitlint (`@commitlint/config-conventional`, case-insensitive `no-co-author-trailer` local rule, `scope-enum`)
- [x] Clean-arch folder skeleton (`shared/`, `modules/*/{domain,application,infrastructure,presentation}`), `CqrsModule` (`.gitkeep` placeholders: delete each as real files land)
- [x] `@nestjs/config` with Zod-validated env (`NODE_ENV`, `PORT`; `.env.example`)
- [x] `@nestjs/drizzle` module + `drizzle.config.ts` (add `DATABASE_URL` to `envSchema` + `.env.example`); `db:generate` / `db:migrate` scripts (fallback per ADR-003: not needed)
- [x] Dockerfile (multi-stage) + `docker-compose.yml` (api, postgres + healthcheck); container start: migrate → start (`HUSKY=0`, postinstall stripped in prod-deps stage, runtime migrator, migrations copied as Nest assets, graceful SIGTERM)
- [x] Vitest (unit + e2e projects) + Supertest + Testcontainers; e2e `GET /health` green (one container per run via `globalSetup`, migrated, URL passed with `provide`/`inject`; `/health` via `@nestjs/terminus` + custom Drizzle indicator; compose api healthcheck)
- [x] Swagger at `/docs` (+ `/docs/openapi.json`); `yarn openapi` writes `openapi.json`; e2e fails if the committed spec is stale

## Phase 1: Shared kernel + schema
- [x] `shared/domain`: `Currency`, `Money` (parse string, scale 6, roundDown, add/sub/convert, compare), `DomainError` + `ErrorCode`, UUIDv7 (Node built-in `crypto.randomUUIDv7`)
- [x] Unit tests: `"0"`, `"-1"`, `"1e3"`, `"1.0000001"`, `" 5"`, huge values, rounding
- [x] e2e helper: truncate tables between tests (`test/helpers/database.ts`: `truncateAll`, `expectDbRejection`)
- [x] Drizzle schema: `wallets`, `balances`, `transactions`, `ledger_entries`, `fx_rates`, `idempotency_keys` + CHECK/unique/indexes (history indexes on `(source|destination_wallet_id, created_at DESC, id DESC)`, NULLS FIRST so a plain `ORDER BY … DESC` uses them)
- [x] CHECKs: `balances.amount >= 0`, `ledger_entries.amount <> 0`, `transactions` amounts `> 0`; currency column next to every amount (ADR-007); plus transaction shape/rate rules, normalized email, E.164 phone, idempotency key/hash format (35 constraint e2e tests)
- [-] System accounts seeded: not needed. System accounts are identified by `(account_type, currency)` on postings, not rows (ADR-008 update). The container seed step moves to Phase 3 (FX fallback table)
- [x] First migration generated + reviewed by hand (`0000_init.sql`; review fixed the phone regex escaping and the index null ordering)
- [ ] `UnitOfWork` port + `DrizzleUnitOfWork` (retry once on 40P01/40001)
- [ ] Error code enum + global exception filter (also wraps Nest's built-in HttpExceptions, e.g. health 503, in the error envelope) + Zod/Standard Schema pipe; shared `DecimalString`

## Phase 2: Wallets + Deposits + Idempotency (FR-1, FR-2)
- [ ] `CreateWalletCommand` (normalize email/E.164; 409 duplicate; 5 zero balances) → E1
- [ ] `GetWalletQuery` (balances + `totalUsd` + `ratesAsOf`) → E2
- [ ] Idempotency: interceptor (header, hash) + store inside UoW + replay + 422 on reuse
- [ ] `DepositCommand` → E3
- [ ] e2e: wallet duplicate (email, phone formats), deposit happy path, invalid amounts, replay, key reuse

## Phase 3: FX (FR-3, FR-5), parallel track `@B`
- [ ] Verify `open.er-api.com` response shape → LEARNINGS
- [ ] `FxRatesPort` + `ErApiFxProvider` (2s timeout) + cache + fallback chain + persist last-good
- [ ] Seed fallback table; add the idempotent seed step to the container start (`migrate.js && seed.js && main.js`)
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
