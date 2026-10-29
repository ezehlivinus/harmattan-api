import { getTableName, is, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgTable } from 'drizzle-orm/pg-core';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { inject } from 'vitest';
import { type Database, DB_CASING } from '../../src/shared/infrastructure/database/database.js';
import * as schema from '../../src/shared/infrastructure/database/schema/index.js';

/** A Drizzle client on the Testcontainers database. Close it with `db.$client.end()`. */
export function createTestDatabase(): Database & { $client: { end: () => Promise<void> } } {
  return drizzle({ connection: inject('databaseUrl'), schema, casing: DB_CASING });
}

/** Empties every table in the schema (fast reset between tests). */
export async function truncateAll(db: Database): Promise<void> {
  const tables = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => `"${getTableName(table)}"`);
  await db.execute(sql.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`));
}

/** The Postgres error behind a failed Drizzle query: SQLSTATE `code` and `constraint` name. */
export function pgError(error: unknown): { code?: string; constraint?: string } {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return typeof cause === 'object' && cause !== null ? cause : {};
}

/** Runs `fn` expecting Postgres to reject it; returns the SQLSTATE code and constraint. */
export async function expectDbRejection(
  fn: () => Promise<unknown>,
): Promise<{ code?: string; constraint?: string }> {
  try {
    await fn();
  } catch (error) {
    return pgError(error);
  }
  throw new Error('Expected the database to reject the statement');
}
