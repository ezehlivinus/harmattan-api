// Applies pending SQL migrations at container start (drizzle-kit is a dev dependency).
// Run with: node dist/shared/infrastructure/database/migrate.js
import { envSchema } from '../config/env.schema.js';
import { runMigrations } from './migrator.js';

const { DATABASE_URL } = envSchema.pick({ DATABASE_URL: true }).parse(process.env);
await runMigrations(DATABASE_URL);
console.log('Database migrations applied');
