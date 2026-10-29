# LEARNINGS

Append-only log of surprises, gotchas and verified facts. Format: `date · expected → actual · source`.
An item that bites twice gets promoted to a project convention and marked `(promoted)`.

## Versions verified
| Package | Version (npm, 2026-10-29) | Note |
|---|---|---|
| @nestjs/core | 12.3.2 | ESM-first major |
| @nestjs/cli | 12.0.11 | |
| @nestjs/cqrs | 12.1.2 | |
| @nestjs/swagger | 12.0.5 | |
| @nestjs/drizzle | 0.0.2 | official (nestjs org), created 2026-09-23, very young |
| drizzle-orm | 0.45.4 | `latest`; 1.0.0-rc.5 on `rc` tag; **don't use rc** |
| drizzle-kit | 0.31.11 | |
| zod | 4.6.7 | |
| vitest | 5.0.5 | |
| @testcontainers/postgresql | 12.2.1 | |

- 2026-10-29 · NestJS 12: ESM, Vitest default, oxlint default, Standard Schema in route decorators · github.com/nestjs/nest/pull/16391
- 2026-10-29 · Node 26 Active LTS since 2026-10-28; corepack not bundled from Node 25 · nodejs.org schedule
- 2026-10-29 · Reported: TypeScript 7 (native) may not work with Nest CLI; use the TS version the scaffold pins · nest PR #16391 thread

## NestJS 12 / CQRS
-

## Drizzle / @nestjs/drizzle
-

## Validation / Swagger
-

## Testing (Vitest / Supertest / Testcontainers)
-

## Docker / Yarn / tooling
-

## Money storage
- 2026-10-29 · Exact `NUMERIC` and integer minor units (`BIGINT`) are both standard; floats and Postgres `money` (locale-dependent) are not. Integer math is faster, irrelevant at sandbox volume. Chose `NUMERIC(38,6)` (ADR-007) · crunchydata.com/developers/playground/working-with-money-in-postgres, medium.com/xendit-engineering/benchmarking-pg-numeric-integer-9c593d7af67e

## FX provider
-

## Things we tried that didn't work
-
