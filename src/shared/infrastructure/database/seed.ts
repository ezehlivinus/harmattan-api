// Seeds reference data at container start, after migrations. Idempotent: safe on every start.
// Run with: node dist/shared/infrastructure/database/seed.js
import { drizzle } from 'drizzle-orm/node-postgres';
import { seedFallbackRates } from '../../../modules/fx/infrastructure/drizzle-fx-rate.store.js';
import { envSchema } from '../config/env.schema.js';
import { DB_CASING } from './database.js';
import * as schema from './schema/index.js';

const { DATABASE_URL } = envSchema.pick({ DATABASE_URL: true }).parse(process.env);
const db = drizzle({ connection: DATABASE_URL, schema, casing: DB_CASING });
try {
  await seedFallbackRates(db);
  console.log('Seed data applied');
} finally {
  await db.$client.end();
}
