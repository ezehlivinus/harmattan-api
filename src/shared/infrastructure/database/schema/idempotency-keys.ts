import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { timestampMs } from './columns.js';

/**
 * Stored responses for `Idempotency-Key` (ADR-005), written in the same DB transaction as the
 * money movement. A concurrent duplicate hits the primary key and replays the stored response.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    /** The operation and target, e.g. `deposit:<walletId>`; keys are only unique within it. */
    scope: text().notNull(),
    key: text().notNull(),
    /** SHA-256 (hex) of the canonical request body; a different body with the same key is a 422. */
    requestHash: text().notNull(),
    responseStatus: integer().notNull(),
    responseBody: jsonb().$type<unknown>().notNull(),
    createdAt: timestampMs().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'idempotency_keys_pkey', columns: [t.scope, t.key] }),
    check('idempotency_keys_key_length', sql`char_length(${t.key}) BETWEEN 1 AND 255`),
    check('idempotency_keys_request_hash_format', sql`${t.requestHash} ~ '^[0-9a-f]{64}$'`),
  ],
);
