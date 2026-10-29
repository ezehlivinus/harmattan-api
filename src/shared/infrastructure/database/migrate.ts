// Applies pending SQL migrations at container start (drizzle-kit is a dev dependency).
// Run with: node dist/shared/infrastructure/database/migrate.js
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { envSchema } from '../config/env.schema.js';
import { DB_CASING } from './database.js';

const { DATABASE_URL } = envSchema.pick({ DATABASE_URL: true }).parse(process.env);
const db = drizzle({ connection: DATABASE_URL, casing: DB_CASING });

try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('migrations', import.meta.url)) });
  console.log('Database migrations applied');
} finally {
  await db.$client.end();
}
