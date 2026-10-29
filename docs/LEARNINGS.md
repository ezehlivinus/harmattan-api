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
| @testcontainers/postgresql | 12.2.1 | `testcontainers` core also 12.2.1 |
| @nestjs/config | 12.0.1 | |
| @nestjs/testing, platform-express, common | 12.3.2 | same as core |
| typescript | **6.0.3** | `latest` is 7.0.2: **don't use** (see below) |
| eslint / typescript-eslint | 10.13.0 / 8.72.1 | |
| prettier | 3.9.10 | |
| husky / @commitlint/* | 9.1.7 / 21.2.4 | |
| decimal.js | 10.6.0 | |
| pg / @types/pg | 8.23.1 | |
| supertest | 7.3.1 | |
| Yarn (`@yarnpkg/cli-dist`) | 4.18.1 | via corepack |
| Docker `node:24-alpine` | tag exists, updated 2026-10-28 | |
| Docker `postgres:17-alpine` | tag exists, updated 2026-10-26 | |

- 2026-10-29 · NestJS 12: ESM, Vitest default, oxlint default, Standard Schema in route decorators · github.com/nestjs/nest/pull/16391
- 2026-10-29 · Node 26 Active LTS since 2026-10-28; corepack not bundled from Node 25 · nodejs.org schedule
- 2026-10-29 · Reported: TypeScript 7 (native) may not work with Nest CLI; use the TS version the scaffold pins · nest PR #16391 thread
- 2026-10-29 · Confirmed: pin TypeScript `~6.0.3`. `@nestjs/cli` depends on `typescript ~6.0.2` and `typescript-eslint` peers `typescript >=4.8.4 <6.1.0`; TS 7.0.2 (`latest`) breaks lint · `npm view @nestjs/cli dependencies.typescript`, `npm view typescript-eslint peerDependencies`
- 2026-10-29 · `@nestjs/drizzle` 0.0.2 peers: `drizzle-orm >=0.35.0 || >=1.0.0-0`, `@nestjs/core ^11 || ^12`, `reflect-metadata ^0.1.13 || ^0.2.0` · `npm view @nestjs/drizzle peerDependencies`
- 2026-10-29 · Engines: vitest 5 needs Node `^22.12 || ^24 || >=26`; `@nestjs/core` `>=20`. Node 24.18.0 OK · `npm view <pkg> engines`

## NestJS 12 / CQRS
-

## Drizzle / @nestjs/drizzle
-

## Validation / Swagger
-

## Testing (Vitest / Supertest / Testcontainers)
-

## Docker / Yarn / tooling
- 2026-10-29 · Global `yarn` on the dev machine is classic 1.22.22; run `corepack enable` (corepack 0.35.0 ships with Node 24) so the `packageManager` field selects Yarn 4.18.1 · `yarn -v`, `corepack --version`

## Money storage
- 2026-10-29 · Exact `NUMERIC` and integer minor units (`BIGINT`) are both standard; floats and Postgres `money` (locale-dependent) are not. Integer math is faster, irrelevant at sandbox volume. Chose `NUMERIC(38,6)` (ADR-007) · crunchydata.com/developers/playground/working-with-money-in-postgres, medium.com/xendit-engineering/benchmarking-pg-numeric-integer-9c593d7af67e

## FX provider
-

## Things we tried that didn't work
-
