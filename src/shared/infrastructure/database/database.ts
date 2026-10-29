import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema/index.js';

/** The Drizzle client injected with `@InjectDrizzle()`. Infrastructure layer only. */
export type Database = NodePgDatabase<typeof schema>;

/** TS camelCase properties map to snake_case columns; drizzle.config.ts must match. */
export const DB_CASING = 'snake_case' as const;
