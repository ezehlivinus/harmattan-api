import { createHash } from 'node:crypto';
import type { TransactionContext } from './unit-of-work.js';

/** A stored response for `Idempotency-Key` (ADR-005). */
export interface IdempotencyRecord {
  /** Operation and target, e.g. `deposit:<walletId>`; keys are unique within a scope. */
  scope: string;
  key: string;
  requestHash: string;
  status: number;
  body: unknown;
}

export interface IdempotencyStore {
  find(scope: string, key: string): Promise<IdempotencyRecord | undefined>;
  /** Saves inside the movement's transaction; throws `IdempotencyKeyTakenError` on a duplicate. */
  save(record: IdempotencyRecord, tx: TransactionContext): Promise<void>;
}

export const IDEMPOTENCY_STORE = Symbol('IdempotencyStore');

/** A concurrent request with the same scope and key committed first. */
export class IdempotencyKeyTakenError extends Error {
  constructor() {
    super('Idempotency key already stored by a concurrent request');
    this.name = 'IdempotencyKeyTakenError';
  }
}

/** SHA-256 (hex) of the request payload as canonical JSON (object keys sorted). */
export function hashRequest(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
