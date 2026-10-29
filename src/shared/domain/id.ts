import { randomUUIDv7 } from 'node:crypto';

/**
 * New entity id: RFC 9562 UUIDv7 (time-ordered across milliseconds, which keeps B-tree
 * inserts local). Not strictly monotonic within one millisecond, so ordering by time
 * uses `(created_at, id)`.
 */
export function newId(): string {
  return randomUUIDv7();
}
