import { Injectable, Logger } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { TransactionContext, type UnitOfWork } from '../../application/unit-of-work.js';
import type { Database, DatabaseTransaction } from './database.js';
import { PgErrorCode, pgErrorOf } from './pg-error.js';

/** First attempt plus one retry. */
const MAX_ATTEMPTS = 2;
const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  PgErrorCode.DEADLOCK_DETECTED,
  PgErrorCode.SERIALIZATION_FAILURE,
]);

class DrizzleTransactionContext extends TransactionContext {
  constructor(readonly tx: DatabaseTransaction) {
    super();
  }
}

/** The Drizzle transaction inside a context created by `DrizzleUnitOfWork`. */
export function drizzleTx(ctx: TransactionContext): DatabaseTransaction {
  if (!(ctx instanceof DrizzleTransactionContext)) {
    throw new TypeError('Transaction context was not created by DrizzleUnitOfWork');
  }
  return ctx.tx;
}

@Injectable()
export class DrizzleUnitOfWork implements UnitOfWork {
  private readonly logger = new Logger(DrizzleUnitOfWork.name);

  constructor(@InjectDrizzle() private readonly db: Database) {}

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.db.transaction(
          async (tx) => await work(new DrizzleTransactionContext(tx)),
        );
      } catch (error) {
        const code = pgErrorOf(error)?.code;
        if (attempt >= MAX_ATTEMPTS || code === undefined || !RETRYABLE_CODES.has(code)) {
          throw error;
        }
        this.logger.warn(`Transaction failed with ${code}; retrying (attempt ${attempt + 1})`);
      }
    }
  }
}
