/**
 * Opaque handle to the current database transaction. Application code only passes it to
 * repositories; infrastructure unwraps it.
 */
export abstract class TransactionContext {
  /** Nominal brand: a plain object is not a transaction context. */
  protected readonly kind = 'transaction';
}

export interface UnitOfWork {
  /**
   * Runs `work` in one database transaction: commits when it resolves, rolls back when it
   * throws. After a deadlock or serialization failure the whole `work` runs once more, so it
   * must not have side effects outside the database.
   */
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
