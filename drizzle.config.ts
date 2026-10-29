import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read .env; load it when present (Node >= 20.12).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the process environment.
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set (see .env.example)');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/infrastructure/database/schema/index.ts',
  out: './src/shared/infrastructure/database/migrations',
  casing: 'snake_case',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
