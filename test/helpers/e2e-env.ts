import { inject } from 'vitest';

// Runs before each e2e file is imported, so ConfigModule sees the container's URL.
process.env.DATABASE_URL = inject('databaseUrl');
