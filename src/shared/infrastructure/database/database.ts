import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema/index.js';

/** The Drizzle client injected with `@InjectDrizzle()`. Infrastructure layer only. */
export type Database = NodePgDatabase<typeof schema>;

/** The `tx` handed to `db.transaction(async (tx) => ...)`. */
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** TS camelCase properties map to snake_case columns; drizzle.config.ts must match. */
export const DB_CASING = 'snake_case' as const;
