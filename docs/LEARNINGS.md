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
- 2026-10-29 · `@nestjs/cqrs` 12.1.2: register once with `CqrsModule.forRoot()` in `AppModule`; its buses are `global: true`, and `@CommandHandler`/`@QueryHandler` classes are discovered when listed as `providers` in **any** feature module (no per-module `CqrsModule` import). Extend `Command<TResult>` / `Query<TResult>` so `commandBus.execute(cmd)` returns `Promise<TResult>` without casts. Missing handler throws `No handler found for the command: "X"` at execute time, not at boot · `node_modules/@nestjs/cqrs/dist/{cqrs.module.js,classes/command.d.ts,command-bus.d.ts}`, `test/unit/cqrs-wiring.spec.ts`
- 2026-10-29 · CLI 12.0.11 scaffold: `"type": "module"`, `module/moduleResolution: nodenext`, relative imports with `.js`, top-level `await bootstrap()`, `experimentalDecorators` + `emitDecoratorMetadata`, `strictPropertyInitialization: false`. Also emits `AGENTS.md` (Nest Observe ad) and a `deploy` script + `@nestjs/mau`: dropped all three. Flag `--no-observe` skips the observability prompt · scaffold output
- 2026-10-29 · Scaffold pins `vitest ^4.1.2`, `@vitest/coverage-v8 ^4`, `typescript ^6.0.2`, deps `^12.0.1`. Bumped to vitest/coverage `5.0.5` (exact, coverage peers `vitest: 5.0.5`), `typescript ~6.0.3`, nest `^12.3.2`. Vitest 5 needs `vite ^6.4 || ^7 || ^8` (scaffold has vite 8 for `resolve.tsconfigPaths`). Unit + e2e sample green on Vitest 5 with no config change · `npm view vitest@5.0.5 peerDependencies`

## Drizzle / @nestjs/drizzle
- 2026-10-29 · `@nestjs/drizzle` 0.0.2 (README only links to docs.nestjs.com/data/drizzle; the `.d.ts` is the reference): `DrizzleModule.forRootAsync({ inject: [ConfigService], useFactory: c => ({ drizzle, connection: url, schema, casing }) })`; the module calls `drizzle()` itself, registers globally, injects with `@InjectDrizzle()` (token `getDrizzleToken()` = `'default'`). It closes `db.$client` on shutdown (`autoCloseConnection` default true) and attaches an `error` listener so a dropped idle pg connection doesn't crash the process. Passing both `db` and `drizzle` throws · `node_modules/@nestjs/drizzle/dist/{drizzle-core.module.js,interfaces/drizzle-options.interface.d.ts}`
- 2026-10-29 · Factory options are typed against `DrizzleConfig`: a `casing` constant widened to `string` fails typecheck; declare it `as const` · tsc error
- 2026-10-29 · Verified on Postgres 17: drizzle-kit 0.31 resolves ESM `.js` specifiers between schema files; `casing: 'snake_case'` turns `displayName` into `display_name`; `numeric({ precision: 38, scale: 6, mode: 'string' })` → `numeric(38, 6)` and returns exact strings (`'1500.250001'`) from `.returning()`; migrations are tracked in `drizzle.__drizzle_migrations`. Empty schema → `No schema changes` but still writes `meta/_journal.json` · temp container run
- 2026-10-29 · drizzle-kit does **not** load `.env`; `drizzle.config.ts` calls `process.loadEnvFile()` (Node ≥ 20.12, throws if no file) · drizzle-kit run
- 2026-10-29 · node-postgres `Pool` connects lazily, so the app boots and non-DB e2e tests pass with an unreachable `DATABASE_URL` · e2e run

## Validation / Swagger
- 2026-10-29 · Zod 4 `z.url({ protocol: /^postgres(ql)?$/ })`: the regex is matched **without** the trailing colon (`/^postgres:$/` rejects everything) · node probe
- 2026-10-29 · `@nestjs/config` 12 takes a Standard Schema directly: `ConfigModule.forRoot({ validationSchema: zodSchema })`; no custom `validate()` glue. The parsed output (coerced numbers, defaults) becomes the validated config; undeclared env vars are merged back in. All issues are reported in one boot error: `Config validation error: NODE_ENV: … \n PORT: …`. `forRoot` is `async` (returns `Promise<DynamicModule>`, fine in `imports`). Typed read: `app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true })` → `number` · `node_modules/@nestjs/config/dist/{config.module.js,utils/validate-with-schema.util.js}`, boot test

## Testing (Vitest / Supertest / Testcontainers)
- 2026-10-29 · Vitest sets `NODE_ENV=test` when unset, so `envSchema` must accept `test`; removing it makes every e2e boot fail with `Config validation error: NODE_ENV` · local run
- 2026-10-29 · Scaffold has two configs: `vitest.config.ts` (`**/*.spec.ts`, globals) and `vitest.config.e2e.ts` (`**/*.e2e-spec.ts`); `.spec.ts` glob does not catch `.e2e-spec.ts`. Decorator metadata works out of the box (no SWC plugin needed for the sample) · local run

## Docker / Yarn / tooling
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
- 2026-10-29 · Exact `NUMERIC` and integer minor units (`BIGINT`) are both standard; floats and Postgres `money` (locale-dependent) are not. Integer math is faster, irrelevant at sandbox volume. Chose `NUMERIC(38,6)` (ADR-007) · crunchydata.com/developers/playground/working-with-money-in-postgres, medium.com/xendit-engineering/benchmarking-pg-numeric-integer-9c593d7af67e

## FX provider
-

## Things we tried that didn't work
-
