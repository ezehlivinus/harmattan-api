# REQUIREMENTS: Harmattan

The complete brief, restated so the original PDF is not needed, plus our decisions where the brief
leaves room and a traceability matrix. **Must** = stated in the brief. **Decision** = our choice
(ADR in DECISIONS.md where it matters).

## 1. Mission

Build the backend for a stablecoin-powered cross-border payment sandbox: a REST API simulating an
FX and remittance platform with mock stablecoins, FX rates, multi-currency wallets and swaps.
No frontend. Evaluation focus: the API, the data model, the tests.
Guidance from the brief: scope it well. A focused API with correct money handling and solid tests
beats a sprawling one with gaps; say in the README what was left out and why.

Supported stablecoins: **cNGN, cGHS, cXAF, USDx, EURx**.

## 2. Required stack

| Area | Must | Our pick |
|---|---|---|
| Language | Node.js LTS + TypeScript, strict mode on | Node 24 LTS, strict |
| Framework | Express or NestJS | NestJS 12 |
| Database | PostgreSQL/MySQL or MongoDB, **justified in README** | PostgreSQL 17 (ADR-002) |
| Cache/queue | Optional; Redis/BullMQ/RabbitMQ only where it earns its place | None initially; revisit in Phase 3 (ADR-011) |
| Tests | Jest or Vitest + Supertest (or equivalent) API tests | Vitest + Supertest + Testcontainers |
| Tooling | Yarn, ESLint, Prettier | Yarn 4, ESLint flat, Prettier |
| Runtime | Docker + docker compose starting API and dependencies with one command | `docker compose up` |

## 3. Functional requirements

### FR-1 Wallets
- **Must** create a wallet with an email address or a mobile number. No full auth required.
- **Must** reject a second wallet for the same email or the same number.
- **Must** hold a balance per supported stablecoin.
- **Must** return all balances plus the total equivalent in USD.
- Decision: email lowercased + trimmed; phone normalized to E.164 (`libphonenumber-js`, default region NG);
  at least one required, both allowed, each unique (DB unique index). Duplicate → 409 `WALLET_ALREADY_EXISTS`.
- Decision: all 5 balances created at `0.000000` on wallet creation. USD total uses current rates; response includes `ratesAsOf`.

### FR-2 Deposits (simulated)
- **Must** accept currency + amount; balance updates immediately; a transaction record is created.
- Decision: requires `Idempotency-Key`. Amount > 0, ≤ 6 dp, ≤ 1,000,000,000,000 per request (sanity cap).

### FR-3 Cross-currency swaps
- **Must** swap an amount of one stablecoin for another inside the same wallet.
- **Must** use FX rates from a live public API or a fixed rate table; **live preferred, with fallback when the provider fails**.
- **Must** reject swaps that would make a balance negative.
- **Must** never process the same request twice.
- Decision: same-currency swap → 422 `SAME_CURRENCY`. `amount` is the source amount debited.
  Destination rounded down to 6 dp. Rate, rate source and `fetchedAt` stored on the transaction.

### FR-4 Transfers
- **Must** send from one wallet to another, same or different currency.
- **Must** auto-convert at the current FX rate when currencies differ.
- **Must** record: sender, receiver, source amount + currency, destination amount + currency, rate applied, timestamp.
- Decision: idempotent like swaps; self-transfer → 422 `SELF_TRANSFER`; unknown wallet → 404;
  `amount` is the source amount debited from the sender; same-currency rate = 1.

### FR-5 History, balances and rates
- **Must** list a wallet's transactions (deposits, swaps, transfers sent and received), **newest first**,
  **paginated**, **filterable by type and currency**.
- **Must** fetch a single transaction by id.
- **Must** return current conversion rates between **all** supported stablecoins with **when each rate was last refreshed**.
- Decision: cursor pagination (stable under inserts); `type ∈ DEPOSIT | SWAP | TRANSFER_IN | TRANSFER_OUT`;
  `currency` matches source **or** destination currency; `limit` 1–100, default 20.

## 4. Endpoints (decision)

| # | Method + path | Purpose | Req |
|---|---|---|---|
| E1 | `POST /v1/wallets` | create wallet `{ email?, phone? }` | FR-1 |
| E2 | `GET /v1/wallets/:walletId` | wallet + balances + `totalUsd` | FR-1 |
| E3 | `POST /v1/wallets/:walletId/deposits` | `{ currency, amount }` + `Idempotency-Key` | FR-2 |
| E4 | `POST /v1/wallets/:walletId/swaps` | `{ fromCurrency, toCurrency, amount }` + key | FR-3 |
| E5 | `POST /v1/transfers` | `{ fromWalletId, toWalletId, sourceCurrency, destinationCurrency, amount }` + key | FR-4 |
| E6 | `GET /v1/wallets/:walletId/transactions` | `?type&currency&limit&cursor` | FR-5 |
| E7 | `GET /v1/transactions/:transactionId` | single transaction | FR-5 |
| E8 | `GET /v1/fx/rates` | full 5×5 matrix, `source` + `fetchedAt` per rate | FR-3, FR-5 |
| E9 | `GET /health` | liveness + DB check | ops |

## 5. Deliverables (all Must)

- D1 One **public GitHub repo**. Deployed URL not required.
- D2 Source with a **clear commit history**; Conventional Commits are a plus.
- D3 `docker compose up` starts API + dependencies; migrations/seed run **automatically or with one documented command**.
- D4 `yarn test` runs the **full suite and passes**.
- D5 API docs: **OpenAPI/Swagger spec or Postman collection committed to the repo**.
- D6 `README.md` containing:
  - a cool name for the prototype
  - tech stack used and why
  - why this database
  - setup and run instructions
  - how to run the tests
  - walkthrough of main endpoints with example requests and responses
  - the data model
  - how money precision, idempotency, concurrency and FX rate failures are handled
  - assumptions, known limitations, what you would do with more time

## 6. Traceability matrix (kept updated as features land)

| Req | Implemented by | Tested by | Status |
|---|---|---|---|
| FR-1 create wallet, email/phone, unique | E1 · `CreateWalletHandler`, unique indexes + CHECKs | `wallets-create.e2e-spec.ts` (incl. 10-way race), `wallet.spec.ts`, `schema.e2e-spec.ts` | ☑ |
| FR-1 balances + USD total | E2 · `GetWalletHandler` + `RateTable.valueInUsd` | `wallets-get.e2e-spec.ts` (LIVE + provider down), `get-wallet.handler.spec.ts`, `rate-table.spec.ts` | ☑ |
| FR-2 deposit + tx record | E3 · `DepositHandler`, `DrizzleLedgerRepository` | `deposits.e2e-spec.ts` (+ ledger invariants), `deposit.spec.ts` | ☑ |
| FR-3 swap via FX | E4 · `SwapHandler`, `Swap` (FX pool postings, rate recorded) | `swaps.e2e-spec.ts` (+ ledger invariants), `swap.spec.ts` | ☑ |
| FR-3 live FX + fallback | `FxRatesService` (cache → `ErApiFxProvider` → stored → built-in) | `fx-rates.service.spec.ts`, `er-api-fx.provider.spec.ts`, `fx-rates.e2e-spec.ts` | ☑ |
| FR-3 no negative balance | conditional `UPDATE … WHERE amount >= x` + `CHECK (amount >= 0)` | `swaps.e2e-spec.ts` 50 parallel vs balance for 10 (mutation-checked) | ☑ |
| FR-3 no double processing | `IdempotencyService` (key row in the movement's tx) | `deposits.e2e-spec.ts` 10 parallel identical, `swaps.e2e-spec.ts` replay, `idempotency.service.spec.ts` | ☑ |
| FR-4 transfer same/cross ccy | E5 · `TransferHandler`, `Transfer` | `transfers.e2e-spec.ts` (+ ledger invariants, A↔B parallel), `transfer.spec.ts` | ☑ |
| FR-4 recorded fields | `transactions` columns + shape/rate CHECKs | `transfers.e2e-spec.ts` (every field), `schema.e2e-spec.ts` | ☑ |
| FR-5 history newest-first, paged, filtered | E6 · `ListWalletTransactionsHandler`, `DrizzleTransactionReadModel` (keyset on created_at, id) | `history.e2e-spec.ts`, `cursor.spec.ts` | ☑ |
| FR-5 get by id | E7 · `GetTransactionHandler` | `history.e2e-spec.ts` | ☑ |
| FR-5 rates matrix + refreshed time | E8 · `GetRatesHandler` (25 pairs, `source`, `fetchedAt` = provider refresh) | `fx-rates.e2e-spec.ts`, `rate-table.spec.ts` | ☑ |
| D3 one-command start | compose + entrypoint | fresh-clone check | ☐ |
| D4 yarn test passes | Vitest config | CI/local | ☐ |
| D5 OpenAPI committed | `openapi.json` (`yarn openapi`) | `openapi.e2e-spec.ts` drift check | ◐ (grows per endpoint) |
| D6 README sections | README (name, stack + why, why Postgres, setup, tests, walkthrough with real output, data model, money/idempotency/concurrency/FX failures, assumptions/limitations/more time) | section checklist, link check | ☑ |
