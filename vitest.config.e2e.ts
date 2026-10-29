import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      // Placeholder until e2e runs against a Testcontainers database.
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://harmattan:harmattan@localhost:5432/harmattan',
    },
  },
});
