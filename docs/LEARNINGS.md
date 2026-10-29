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

## Runtime (Node)
- 2026-10-29 · Node has `crypto.randomUUIDv7()` since **v24.16.0** (stable, RFC 9562); the `uuid` package is unnecessary. Timestamp is millisecond-precision and **not monotonic** within a millisecond, so order by `(created_at, id)`. `engines.node` set to `>=24.16.0`. Postgres 17 has only `gen_random_uuid()` (v4); `uuidv7()` arrives in Postgres 18 · nodejs.org/docs/latest-v24.x/api/crypto.json, `pg_proc` query
- 2026-10-29 · Checked before building (official-first rule): UUIDv7 → Node built-in; decimal math → `decimal.js` (stack choice) · npm/docs

## NestJS 12 / CQRS
- 2026-10-29 · Health checks: use the official `@nestjs/terminus` 12.1.0 (Nest ^11 || ^12, ESM), not a hand-written controller. It has no Drizzle indicator (only TypeORM, Mongoose, Sequelize, Prisma, MikroORM), so the documented custom-indicator recipe is used: `healthIndicatorService.check(key).attempt(async () => …).withTimeout(ms)` (thenable; `down` on throw or timeout; adds `responseTime`). `HealthCheckService.check([...])` throws `ServiceUnavailableException(result)` → 503 with `{ status, info, error, details }`; `@HealthCheck()` adds Swagger 200/503 schemas and `Cache-Control: no-cache` (loads swagger via `createRequire`, ESM-safe). With Postgres stopped, a pg query hangs: the 1 s timeout turns that into a fast 503 · docs.nestjs.com/recipes/terminus, `node_modules/@nestjs/terminus/dist/{health-indicator/health-indicator.service.d.ts,health-check/health-check.service.js,health-check/health-check.decorator.js}`, compose run
- 2026-10-29 · `@nestjs/cqrs` 12.1.2: register once with `CqrsModule.forRoot()` in `AppModule`; its buses are `global: true`, and `@CommandHandler`/`@QueryHandler` classes are discovered when listed as `providers` in **any** feature module (no per-module `CqrsModule` import). Extend `Command<TResult>` / `Query<TResult>` so `commandBus.execute(cmd)` returns `Promise<TResult>` without casts. Missing handler throws `No handler found for the command: "X"` at execute time, not at boot · `node_modules/@nestjs/cqrs/dist/{cqrs.module.js,classes/command.d.ts,command-bus.d.ts}`, `test/unit/cqrs-wiring.spec.ts`
- 2026-10-29 · CLI 12.0.11 scaffold: `"type": "module"`, `module/moduleResolution: nodenext`, relative imports with `.js`, top-level `await bootstrap()`, `experimentalDecorators` + `emitDecoratorMetadata`, `strictPropertyInitialization: false`. Also emits `AGENTS.md` (Nest Observe ad) and a `deploy` script + `@nestjs/mau`: dropped all three. Flag `--no-observe` skips the observability prompt · scaffold output
- 2026-10-29 · Scaffold pins `vitest ^4.1.2`, `@vitest/coverage-v8 ^4`, `typescript ^6.0.2`, deps `^12.0.1`. Bumped to vitest/coverage `5.0.5` (exact, coverage peers `vitest: 5.0.5`), `typescript ~6.0.3`, nest `^12.3.2`. Vitest 5 needs `vite ^6.4 || ^7 || ^8` (scaffold has vite 8 for `resolve.tsconfigPaths`). Unit + e2e sample green on Vitest 5 with no config change · `npm view vitest@5.0.5 peerDependencies`

## Drizzle / @nestjs/drizzle
- 2026-10-29 · node-postgres `db.transaction()` checks out one pool client and runs `begin`, your callback, then `commit` (or `rollback` on throw) all through `tx.execute`, so **COMMIT failures are also `DrizzleQueryError`** with the pg error in `.cause`. `PgTransactionConfig`: `isolationLevel`, `accessMode`, `deferrable`. Default READ COMMITTED is enough with conditional updates · `node_modules/drizzle-orm/node-postgres/session.js`, `pg-core/session.d.ts`
- 2026-10-29 · Drizzle 0.45 wraps every driver error in `DrizzleQueryError` (`query`, `params`); the pg error with SQLSTATE `code` and `constraint` is on **`.cause`**. Idempotency (23505) and deadlock retry (40P01/40001) must read `error.cause.code` · `node_modules/drizzle-orm/{errors.d.ts,pg-core/session.js}`
- 2026-10-29 · `.desc()` in an index emits `DESC NULLS LAST`, but a plain SQL `ORDER BY x DESC` means `NULLS FIRST`, and the planner only uses an index for ordering when null order matches (verified with EXPLAIN: mismatch forces a Sort even with `enable_sort=off`). Use `.desc().nullsFirst()` · generated SQL + EXPLAIN on Postgres 17
- 2026-10-29 · Backslashes in `sql\`...\`` template literals are consumed by JS: `'^\+…'` reached Postgres as `'^+…'`. Use character classes (`[+]`) in regexes inside `sql` · review of `0000_init.sql`
- 2026-10-29 · Table API: third `pgTable` argument is an **array** (object form deprecated); `primaryKey({ name, columns })` (default name is `<table>_<cols>_pk`, so pass `<table>_pkey` to get Postgres' usual name); `check(name, sql)`; `uniqueIndex(name).on(...)`; `is(value, PgTable)` + `getTableName()` list tables from a schema module; `timestamp({ withTimezone: true, precision: 3, mode: 'date' })` · `node_modules/drizzle-orm/pg-core/*.d.ts`
- 2026-10-29 · `@nestjs/drizzle` 0.0.2 (README only links to docs.nestjs.com/data/drizzle; the `.d.ts` is the reference): `DrizzleModule.forRootAsync({ inject: [ConfigService], useFactory: c => ({ drizzle, connection: url, schema, casing }) })`; the module calls `drizzle()` itself, registers globally, injects with `@InjectDrizzle()` (token `getDrizzleToken()` = `'default'`). It closes `db.$client` on shutdown (`autoCloseConnection` default true) and attaches an `error` listener so a dropped idle pg connection doesn't crash the process. Passing both `db` and `drizzle` throws · `node_modules/@nestjs/drizzle/dist/{drizzle-core.module.js,interfaces/drizzle-options.interface.d.ts}`
- 2026-10-29 · Factory options are typed against `DrizzleConfig`: a `casing` constant widened to `string` fails typecheck; declare it `as const` · tsc error
- 2026-10-29 · Verified on Postgres 17: drizzle-kit 0.31 resolves ESM `.js` specifiers between schema files; `casing: 'snake_case'` turns `displayName` into `display_name`; `numeric({ precision: 38, scale: 6, mode: 'string' })` → `numeric(38, 6)` and returns exact strings (`'1500.250001'`) from `.returning()`; migrations are tracked in `drizzle.__drizzle_migrations`. Empty schema → `No schema changes` but still writes `meta/_journal.json` · temp container run
- 2026-10-29 · drizzle-kit does **not** load `.env`; `drizzle.config.ts` calls `process.loadEnvFile()` (Node ≥ 20.12, throws if no file) · drizzle-kit run
- 2026-10-29 · node-postgres `Pool` connects lazily, so the app boots and non-DB e2e tests pass with an unreachable `DATABASE_URL` · e2e run

## Validation / Swagger
- 2026-10-29 · NestJS 12 validates Standard Schema natively: `@Body({ schema })`, `@Query({ schema })`, `@Param('id', { schema })` / `@Param({ schema })` attach a schema, and the built-in `StandardSchemaValidationPipe` (`transform` default true, `exceptionFactory(issues)`, `validateCustomDecorators`) validates it; register once with `APP_PIPE`. Also ships `StandardSchemaSerializerInterceptor` for responses. Swagger 12 turns a `@Body({ schema })` Zod schema into `requestBody` · `node_modules/@nestjs/common/{pipes/standard-schema-validation.pipe.d.ts,decorators/http/route-params.decorator.d.ts}`, `test/e2e/http-errors.e2e-spec.ts`
- 2026-10-29 · Use **object** schemas for params and query (`@Param({ schema: z.object({ id: z.uuid() }) })`): `exceptionFactory` only receives issues, so a single-value schema reports an empty path instead of the field name · e2e test
- 2026-10-29 · Zod `.meta({ example, description })` flows into `~standard.jsonSchema` and so into OpenAPI · node probe
- 2026-10-29 · `HttpException.getResponse()` is the string or object passed in; for `new NotFoundException('x')` Nest builds `{ statusCode, message, error }`, for `new ServiceUnavailableException(obj)` it is `obj` itself. The filter keeps custom objects as `details` and names codes from the `HttpStatus` enum (`HttpStatus[404] === 'NOT_FOUND'`). Malformed JSON arrives as a 400 `HttpException` (`Unexpected end of JSON input`). Exception filters must check `httpAdapter.isHeadersSent()` and `end()` instead of replying · `node_modules/@nestjs/common/{exceptions/http.exception.d.ts,interfaces/http/http-server.interface.d.ts}`, compose run
- 2026-10-29 · `@nestjs/swagger` 12 converts Standard Schema natively: `@ApiOkResponse({ standardSchema: zodSchema, example })` (also a `standardSchemaConverter` document option). Zod 4.6 exposes `~standard.jsonSchema`, so no `nestjs-zod` / `zod-to-openapi` needed for responses · `node_modules/@nestjs/swagger/dist/{decorators/api-response.decorator.d.ts,services/standard-schema-openapi.converter.d.ts}`, generated `openapi.json`
- 2026-10-29 · `SwaggerModule.setup(path, app, () => doc, { jsonDocumentUrl, raw: ['json'] })` accepts a document factory. `createDocument` works on a non-listening app, so `yarn openapi` boots `AppModule` with a dummy `DATABASE_URL` (lazy pool, no query) and writes the file; `AppModule` must be imported dynamically **after** setting the env, because `ConfigModule.forRoot` validates at import time · `src/openapi.ts`
- 2026-10-29 · Zod 4 `z.url({ protocol: /^postgres(ql)?$/ })`: the regex is matched **without** the trailing colon (`/^postgres:$/` rejects everything) · node probe
- 2026-10-29 · `@nestjs/config` 12 takes a Standard Schema directly: `ConfigModule.forRoot({ validationSchema: zodSchema })`; no custom `validate()` glue. The parsed output (coerced numbers, defaults) becomes the validated config; undeclared env vars are merged back in. All issues are reported in one boot error: `Config validation error: NODE_ENV: … \n PORT: …`. `forRoot` is `async` (returns `Promise<DynamicModule>`, fine in `imports`). Typed read: `app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true })` → `number` · `node_modules/@nestjs/config/dist/{config.module.js,utils/validate-with-schema.util.js}`, boot test

## Testing (Vitest / Supertest / Testcontainers)
- 2026-10-29 · e2e files share one Postgres and `truncateAll` between tests; Vitest runs files in parallel by default, so one file's TRUNCATE wiped another's rows mid-test (FK violation on an insert right after its parent). Fixed with `fileParallelism: false` on the e2e project (tests inside a file were already sequential). If e2e gets slow, give each file its own database from a migrated template (Testcontainers `snapshot()`/`restoreSnapshot()`) · flaky run, `node_modules/vitest/dist/chunks/plugin.d.*.d.ts`
- 2026-10-29 · A real deadlock can be produced deterministically: two transactions each lock one row, wait on a shared barrier, then update the other's row. Postgres detects it after `deadlock_timeout` (1 s) and aborts one with 40P01. Mutation check: with retries disabled the test fails with `deadlock detected` · `test/e2e/unit-of-work.e2e-spec.ts`
- 2026-10-29 · Vitest 5 projects: `test.projects: [{ extends: true, test: { name, include, globalSetup, setupFiles } }]`; run one with `--project e2e`. `globalSetup` exports `setup(project: TestProject)` / `teardown()`; pass values with `project.provide('key', v)` and read with `inject('key')` (import from `vitest`, not a global; type via `declare module 'vitest' { interface ProvidedContext }`). Setting `process.env` in globalSetup is not reliable for workers; set it in a `setupFiles` entry instead, which runs before each test file's imports · `node_modules/vitest/dist/chunks/plugin.d.*.d.ts`
- 2026-10-29 · `@testcontainers/postgresql` 12: `new PostgreSqlContainer('postgres:17-alpine')` (image is **required**), `.start()`, `.getConnectionUri()`; also offers `snapshot()` / `restoreSnapshot()` for fast DB resets. Ryuk reaper container lingers a few seconds after the run, then exits. Full suite with container ≈ 9 s · local run
- 2026-10-29 · `expect.any(String)` returns `any`, which `no-unsafe-assignment` rejects under `strictTypeChecked`; use `toHaveProperty([...path])` or typed matchers · eslint
- 2026-10-29 · Vitest sets `NODE_ENV=test` when unset, so `envSchema` must accept `test`; removing it makes every e2e boot fail with `Config validation error: NODE_ENV` · local run
- 2026-10-29 · Scaffold has two configs: `vitest.config.ts` (`**/*.spec.ts`, globals) and `vitest.config.e2e.ts` (`**/*.e2e-spec.ts`); `.spec.ts` glob does not catch `.e2e-spec.ts`. Decorator metadata works out of the box (no SWC plugin needed for the sample) · local run

## Docker / Yarn / tooling
- 2026-10-29 · Convention: every promise is awaited explicitly, enforced by `@typescript-eslint/promise-function-async` (promise-returning functions must be `async`) and `@typescript-eslint/return-await: ['error', 'always']`. Gap: `promise-function-async` only sees real `Promise` types, not thenables such as Terminus's `HealthCheckAttempt`; declare those functions `async` with an explicit `Promise<…>` return type by hand. `require-await` (in strictTypeChecked) still flags an `async` function with no `await`: write `return await …` · eslint run
- 2026-10-29 · Node as container PID 1 ignores SIGTERM unless something handles it: `docker compose stop` took 10.3 s (killed). `app.enableShutdownHooks()` in `main.ts` → 0.23 s, and Nest's shutdown hooks close the Drizzle pool · compose run
- 2026-10-29 · `drizzle-orm` runtime `migrate()` throws `Can't find meta/_journal.json` when the folder is missing, so the empty journal from `drizzle-kit generate` (`entries: []`) is committed. `nest build` copies the SQL via `nest-cli.json` `compilerOptions.assets` (`include` is relative to `sourceRoot`), and `migrate.js` resolves `new URL('migrations', import.meta.url)` · `node_modules/drizzle-orm/migrator.js`, build output
- 2026-10-29 · Prod deps in Docker: `yarn workspaces focus --production` is built into Yarn 4 (no plugin). The root `postinstall: husky` would fail there (husky is a devDep), so the stage runs `npm pkg delete scripts.postinstall` first; the build stage uses `HUSKY=0`. Runtime image (node:24-alpine, prod deps only, user `node`) is 203 MB · docker build
- 2026-10-29 · **Yarn 4 does not run a root `prepare` script** on `yarn install`, so `husky init` (which writes `"prepare": "husky"`) leaves hooks uninstalled. Use `"postinstall": "husky"`; verified `core.hooksPath=.husky/_` after install. Also skipped `husky init` because it writes a `pre-commit` running `yarn test` · local test, `node_modules/husky/bin.js`
- 2026-10-29 · husky 9 hook files are plain shell, no shebang/`husky.sh` line (those are deprecated and fail in v10). `HUSKY=0` skips both install and hooks · `node_modules/husky/index.js`, `husky`
- 2026-10-29 · commitlint 21 `trailer-exists` is case-sensitive (`startsWith(value)` on `git interpret-trailers --parse`, which keeps original case), so `[2,'never','Co-Authored-By:']` lets GitHub's `Co-authored-by:` through. Replaced with an inline plugin rule using `/^co-authored-by:/im` · `node_modules/@commitlint/rules/lib/trailer-exists.js`
- 2026-10-29 · `tseslint.config()` is **deprecated** in typescript-eslint 8.72; use `defineConfig` / `globalIgnores` from `eslint/config` (ESLint 10) with `extends: [tseslint.configs.strictTypeChecked, ...]`. Type-aware linting via `parserOptions.projectService: true` + `tsconfigRootDir: import.meta.dirname`. Prettier compat import is `eslint-config-prettier/flat`; `globals.vitest` exists in globals 17 · `node_modules/typescript-eslint/dist/config-helper.d.ts`, `eslint/lib/types/config-api.d.ts`
- 2026-10-29 · `strictTypeChecked` flags Nest's empty decorated module classes (`no-extraneous-class`): use `{ allowWithDecorator: true }`. `consistent-type-imports` left off: `import type` on a constructor-injected class erases the runtime reference that `emitDecoratorMetadata` needs for DI · eslint run + Nest DI docs
- 2026-10-29 · Prettier/format scripts use explicit globs (`"{src,test}/**/*.ts" "*.{ts,mjs,json,yml}"`) instead of `.` so private/untracked folders are never touched or listed in a committed ignore file · design choice
- 2026-10-29 · `yarn -v` printed 1.22.22, but `yarn` was already the corepack shim; that is just corepack's fallback when no `packageManager` field exists. With `"packageManager": "yarn@4.18.1"` it runs Yarn 4 (set `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` in non-interactive shells) · `ls -l $(dirname $(which node))`
- 2026-10-29 · Yarn 4 refuses to install if a parent directory holds a `package.json` ("doesn't seem to be part of the project declared in …"). An empty `yarn.lock` in the repo root marks it as a separate project · yarn error text
- 2026-10-29 · `nest new . ` style scaffolding (`--directory .`) aborts on existing files ("A merge conflicted on path /README.md"), even with `--dry-run`. Scaffold into a temp dir and copy files in · nest CLI 12.0.11
- 2026-10-29 · `nest new --skip-git` writes **no** `.gitignore`; the template lives in `@nestjs/cli/lib/configuration/defaults.js` (`defaultGitIgnore`), written only during git init · CLI source

## Money storage
- 2026-10-29 · Postgres CHECK semantics: a CHECK **passes when it evaluates to NULL**, so `a = b` with a NULL operand silently accepts; write explicit `IS NOT NULL` in every branch. Multiple failing CHECKs report the first in **alphabetical order of constraint name**, so constraint tests must break exactly one rule · postgresql.org/docs/17/ddl-constraints.html, schema e2e run
- 2026-10-29 · `timestamptz` defaults to microseconds, JS `Date` holds milliseconds: a cursor read back from JS would not equal the stored value. All timestamps are `timestamp(3)` · design check + e2e round-trip test
- 2026-10-29 · `decimal.js` 10.6 ships one CJS-style `decimal.d.ts` for both `import` and `require`; under `module: nodenext` the **default** import types as the module object (`Property 'clone' does not exist`, `Cannot use namespace 'Decimal' as a type`) although it works at runtime. Use the named import `import { Decimal } from 'decimal.js'` (exported by `decimal.mjs` and the `.d.ts`) · tsc error, `node_modules/decimal.js/{package.json,decimal.mjs}`
- 2026-10-29 · Use `Decimal.clone({ precision: 100, rounding: ROUND_DOWN })` instead of mutating the global config; 100 significant digits keeps numeric(38,6) × numeric(38,18) exact before `toDecimalPlaces(6, ROUND_DOWN)` · decimal.d.ts
- 2026-10-29 · Compute expected values in money tests with an independent tool (Python `decimal`, prec 200), not by hand: a hand-computed 22-digit product in the first draft of `money.spec.ts` was wrong · python check
- 2026-10-29 · Exact `NUMERIC` and integer minor units (`BIGINT`) are both standard; floats and Postgres `money` (locale-dependent) are not. Integer math is faster, irrelevant at sandbox volume. Chose `NUMERIC(38,6)` (ADR-007) · crunchydata.com/developers/playground/working-with-money-in-postgres, medium.com/xendit-engineering/benchmarking-pg-numeric-integer-9c593d7af67e

## FX provider
-

## Things we tried that didn't work
- 2026-10-29 · Hand-written `/health` controller (`select 1`, custom body): replaced by `@nestjs/terminus` before commit. It had no timeout (a hung DB would hang `/health`), no standard response shape, and duplicated what the framework ships. Lesson: check docs.nestjs.com recipes and npm for an official package before building · review feedback
