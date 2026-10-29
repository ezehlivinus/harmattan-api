import { DrizzleQueryError } from 'drizzle-orm/errors';

/** Postgres SQLSTATE codes the application reacts to. */
export const PgErrorCode = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
} as const;

export interface PgErrorInfo {
  code: string;
  constraint: string | undefined;
}

/**
 * The Postgres error behind `error`, if any. Drizzle wraps every statement it runs (including
 * BEGIN/COMMIT) in `DrizzleQueryError` with the driver error as `cause`; direct use of the pg
 * client (`db.$client.query`) throws the driver error itself.
 */
export function pgErrorOf(error: unknown): PgErrorInfo | undefined {
  const source = error instanceof DrizzleQueryError ? error.cause : error;
  if (typeof source !== 'object' || source === null || !('code' in source)) {
    return undefined;
  }
  const { code } = source;
  if (typeof code !== 'string') {
    return undefined;
  }
  const constraint =
    'constraint' in source && typeof source.constraint === 'string' ? source.constraint : undefined;
  return { code, constraint };
}
