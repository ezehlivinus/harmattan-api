import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DB_CASING } from './database.js';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('migrations', import.meta.url));

/** Applies pending SQL migrations with a short-lived connection. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const db = drizzle({ connection: databaseUrl, casing: DB_CASING });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await db.$client.end();
  }
}
