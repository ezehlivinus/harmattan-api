import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { Database } from './database.js';
import { DrizzleUnitOfWork, drizzleTx } from './drizzle-unit-of-work.js';

const pgError = (code: string) => Object.assign(new Error(`pg ${code}`), { code });
const wrapped = (code: string) => new DrizzleQueryError('update ...', [], pgError(code));

/** A fake `db` whose `transaction` runs the callback with `tx`, failing first with `errors`. */
function fakeDb(errors: Error[] = []) {
  const tx = { fake: 'tx' };
  const calls = { count: 0 };
  const db = {
    transaction: async (fn: (t: unknown) => Promise<unknown>) => {
      calls.count += 1;
      const error = errors.shift();
      if (error !== undefined) throw error;
      return await fn(tx);
    },
  } as unknown as Database;
  return { db, tx, calls };
}

describe('DrizzleUnitOfWork', () => {
  it('returns the result of the work and exposes the transaction to infrastructure', async () => {
    const { db, tx } = fakeDb();
    const uow = new DrizzleUnitOfWork(db);

    const result = await uow.run(async (ctx) => await Promise.resolve(drizzleTx(ctx)));

    expect(result).toBe(tx);
  });

  it.each([
    ['a deadlock (40P01) wrapped by Drizzle', wrapped('40P01')],
    ['a serialization failure (40001) wrapped by Drizzle', wrapped('40001')],
    ['an unwrapped deadlock error from the pg driver', pgError('40P01')],
  ])('retries once after %s', async (_name, error) => {
    const { db, calls } = fakeDb([error]);

    await expect(
      new DrizzleUnitOfWork(db).run(async () => await Promise.resolve('ok')),
    ).resolves.toBe('ok');
    expect(calls.count).toBe(2);
  });

  it('gives up after the second retryable failure', async () => {
    const second = wrapped('40P01');
    const { db, calls } = fakeDb([wrapped('40P01'), second]);

    await expect(
      new DrizzleUnitOfWork(db).run(async () => await Promise.resolve('ok')),
    ).rejects.toBe(second);
    expect(calls.count).toBe(2);
  });

  it.each([
    ['a unique violation', wrapped('23505')],
    ['a check violation', wrapped('23514')],
    ['a business error', new Error('INSUFFICIENT_FUNDS')],
  ])('does not retry %s', async (_name, error) => {
    const { db, calls } = fakeDb([error]);

    await expect(
      new DrizzleUnitOfWork(db).run(async () => await Promise.resolve('ok')),
    ).rejects.toBe(error);
    expect(calls.count).toBe(1);
  });

  it('refuses a transaction context it did not create', () => {
    expect(() => drizzleTx({} as never)).toThrow(/DrizzleUnitOfWork/);
  });
});
