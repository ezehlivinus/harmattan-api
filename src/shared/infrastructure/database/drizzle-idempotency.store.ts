import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq } from 'drizzle-orm';
import {
  type IdempotencyRecord,
  type IdempotencyStore,
  IdempotencyKeyTakenError,
} from '../../application/idempotency.js';
import type { TransactionContext } from '../../application/unit-of-work.js';
import type { Database } from './database.js';
import { drizzleTx } from './drizzle-unit-of-work.js';
import { PgErrorCode, pgErrorOf } from './pg-error.js';
import { idempotencyKeys } from './schema/index.js';

@Injectable()
export class DrizzleIdempotencyStore implements IdempotencyStore {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async find(scope: string, key: string): Promise<IdempotencyRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
    return row === undefined
      ? undefined
      : {
          scope: row.scope,
          key: row.key,
          requestHash: row.requestHash,
          status: row.responseStatus,
          body: row.responseBody,
        };
  }

  async save(record: IdempotencyRecord, ctx: TransactionContext): Promise<void> {
    try {
      await drizzleTx(ctx).insert(idempotencyKeys).values({
        scope: record.scope,
        key: record.key,
        requestHash: record.requestHash,
        responseStatus: record.status,
        responseBody: record.body,
      });
    } catch (error) {
      const pg = pgErrorOf(error);
      if (pg?.code === PgErrorCode.UNIQUE_VIOLATION && pg.constraint === 'idempotency_keys_pkey') {
        throw new IdempotencyKeyTakenError();
      }
      throw error;
    }
  }
}
