import { DomainError } from '../domain/domain-error.js';
import {
  type IdempotencyRecord,
  type IdempotencyStore,
  IdempotencyKeyTakenError,
  hashRequest,
} from './idempotency.js';
import { IdempotencyKeyReusedError, IdempotencyService } from './idempotency.service.js';
import type { TransactionContext, UnitOfWork } from './unit-of-work.js';

const ctx = {} as TransactionContext;

function setup(initial: IdempotencyRecord[] = []) {
  const records = [...initial];
  const saved: IdempotencyRecord[] = [];
  const store: IdempotencyStore = {
    find: async (scope, key) =>
      await Promise.resolve(records.find((r) => r.scope === scope && r.key === key)),
    save: async (record) => {
      saved.push(record);
      await Promise.resolve();
    },
  };
  const uow: UnitOfWork = { run: async (work) => await work(ctx) };
  return { service: new IdempotencyService(uow, store), records, saved, store };
}

const request = { scope: 'deposit:w1', key: 'k1', payload: { currency: 'cNGN', amount: '5' } };

describe('hashRequest', () => {
  it('is a SHA-256 hex digest that ignores key order', () => {
    const a = hashRequest({ amount: '5', currency: 'cNGN', nested: { b: 1, a: 2 } });
    const b = hashRequest({ nested: { a: 2, b: 1 }, currency: 'cNGN', amount: '5' });

    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(hashRequest({ amount: '6', currency: 'cNGN' })).not.toBe(a);
  });
});

describe('IdempotencyService', () => {
  it('runs the work once and stores the response in the same transaction', async () => {
    const { service, saved } = setup();
    const contexts: TransactionContext[] = [];

    const result = await service.execute(request, 201, async (tx) => {
      contexts.push(tx);
      return await Promise.resolve({ id: 't1' });
    });

    expect(result).toEqual({ status: 201, body: { id: 't1' }, replayed: false });
    expect(contexts).toEqual([ctx]);
    expect(saved).toEqual([
      {
        scope: 'deposit:w1',
        key: 'k1',
        requestHash: hashRequest(request.payload),
        status: 201,
        body: { id: 't1' },
      },
    ]);
  });

  it('replays a stored response without running the work again', async () => {
    const stored = {
      scope: 'deposit:w1',
      key: 'k1',
      requestHash: hashRequest(request.payload),
      status: 201,
      body: { id: 't1' },
    };
    const { service, saved } = setup([stored]);
    let ran = false;

    const result = await service.execute(request, 201, async () => {
      ran = true;
      return await Promise.resolve({ id: 'other' });
    });

    expect(result).toEqual({ status: 201, body: { id: 't1' }, replayed: true });
    expect(ran).toBe(false);
    expect(saved).toEqual([]);
  });

  it('rejects the same key with a different request body', async () => {
    const stored = {
      scope: 'deposit:w1',
      key: 'k1',
      requestHash: hashRequest({ other: true }),
      status: 201,
      body: {},
    };
    const { service } = setup([stored]);

    const error = await service
      .execute(request, 201, async () => await Promise.resolve({}))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(IdempotencyKeyReusedError);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('does not store anything when the work fails (a retry re-evaluates)', async () => {
    const { service, saved } = setup();
    const failure = new Error('INSUFFICIENT_FUNDS');

    await expect(
      service.execute(request, 201, async () => await Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(saved).toEqual([]);
  });

  it('replays the winner when a concurrent duplicate stored the key first', async () => {
    const { service, records, store } = setup();
    store.save = async () => {
      // The concurrent request committed between our lookup and our insert.
      records.push({
        scope: 'deposit:w1',
        key: 'k1',
        requestHash: hashRequest(request.payload),
        status: 201,
        body: { id: 'winner' },
      });
      await Promise.reject(new IdempotencyKeyTakenError());
    };

    const result = await service.execute(
      request,
      201,
      async () => await Promise.resolve({ id: 'loser' }),
    );

    expect(result).toEqual({ status: 201, body: { id: 'winner' }, replayed: true });
  });
});
