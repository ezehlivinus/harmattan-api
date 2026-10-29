import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../domain/domain-error.js';
import { ErrorCode } from '../domain/error-code.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyRecord,
  type IdempotencyStore,
  IdempotencyKeyTakenError,
  hashRequest,
} from './idempotency.js';
import { type TransactionContext, UNIT_OF_WORK, type UnitOfWork } from './unit-of-work.js';

export class IdempotencyKeyReusedError extends DomainError {
  readonly code = ErrorCode.IDEMPOTENCY_KEY_REUSED;

  constructor(key: string) {
    super('This Idempotency-Key was already used with a different request', { key });
  }
}

export interface IdempotentResult<T> {
  status: number;
  body: T;
  /** True when the stored response of an earlier request was returned. */
  replayed: boolean;
}

/**
 * Exactly-once execution of a money command (ADR-005): the stored response is replayed for a
 * repeated key; otherwise the work and the stored response commit in one transaction. If a
 * concurrent duplicate commits first, this attempt rolls back entirely and replays the winner.
 * Failed work stores nothing, so a retry is evaluated again.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore,
  ) {}

  async execute<T>(
    request: { scope: string; key: string; payload: unknown },
    status: number,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    const { scope, key } = request;
    const requestHash = hashRequest(request.payload);

    const existing = await this.store.find(scope, key);
    if (existing !== undefined) {
      return this.replay<T>(existing, requestHash);
    }
    try {
      const body = await this.uow.run(async (tx) => {
        const result = await work(tx);
        await this.store.save({ scope, key, requestHash, status, body: result }, tx);
        return result;
      });
      return { status, body, replayed: false };
    } catch (error) {
      if (!(error instanceof IdempotencyKeyTakenError)) throw error;
      const winner = await this.store.find(scope, key);
      if (winner === undefined) throw error;
      return this.replay<T>(winner, requestHash);
    }
  }

  private replay<T>(record: IdempotencyRecord, requestHash: string): IdempotentResult<T> {
    if (record.requestHash !== requestHash) {
      throw new IdempotencyKeyReusedError(record.key);
    }
    // The body was produced by the same command for the same request, so it has type T.
    return { status: record.status, body: record.body as T, replayed: true };
  }
}
