import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { newId } from '../../src/shared/domain/id.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDatabase, truncateAll } from '../helpers/database.js';
import { providerUp } from '../helpers/fx.js';

interface Item {
  id: string;
  entryType: string;
  type: string;
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmount: string;
  createdAt: string;
}
interface Page {
  items: Item[];
  nextCursor: string | null;
}

describe('transaction history (e2e)', () => {
  let app: INestApplication<App>;
  const db = createTestDatabase();
  let alice: string;
  let bob: string;

  const http = () => request(app.getHttpServer());
  const createWallet = async (email: string) => {
    const res = await http().post('/v1/wallets').send({ email }).expect(201);
    return (res.body as { id: string }).id;
  };
  const post = async (path: string, body: object) => {
    const res = await http().post(path).set('Idempotency-Key', newId()).send(body).expect(201);
    return (res.body as { transaction: { id: string } }).transaction.id;
  };
  const deposit = async (walletId: string, currency: string, amount: string) =>
    await post(`/v1/wallets/${walletId}/deposits`, { currency, amount });
  const list = async (walletId: string, query: Record<string, string | number> = {}) => {
    const res = await http().get(`/v1/wallets/${walletId}/transactions`).query(query).expect(200);
    return res.body as Page;
  };
  const newestFirst = (items: Item[]) =>
    [...items].sort((a, b) =>
      a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1,
    );

  beforeAll(async () => {
    app = await createTestApp({ fetch: providerUp });
  });

  afterAll(async () => {
    await app.close();
    await db.$client.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
    alice = await createWallet('alice@example.com');
    bob = await createWallet('bob@example.com');
  });

  /** Alice: deposit, swap, transfer out to Bob; Bob: transfer in, then a transfer back. */
  const scenario = async () => {
    const depositId = await deposit(alice, 'cNGN', '3200');
    const swapId = await post(`/v1/wallets/${alice}/swaps`, {
      fromCurrency: 'cNGN',
      toCurrency: 'USDx',
      amount: '1600',
    });
    const outId = await post('/v1/transfers', {
      fromWalletId: alice,
      toWalletId: bob,
      sourceCurrency: 'cNGN',
      destinationCurrency: 'EURx',
      amount: '800',
    });
    await deposit(bob, 'USDx', '5');
    const inId = await post('/v1/transfers', {
      fromWalletId: bob,
      toWalletId: alice,
      sourceCurrency: 'USDx',
      destinationCurrency: 'USDx',
      amount: '2',
    });
    return { depositId, swapId, outId, inId };
  };

  describe('GET /v1/wallets/:walletId/transactions', () => {
    it("lists a wallet's deposits, swaps and transfers both ways, newest first", async () => {
      const ids = await scenario();

      const page = await list(alice);

      expect(page.items.map((i) => [i.id, i.entryType])).toEqual([
        [ids.inId, 'TRANSFER_IN'],
        [ids.outId, 'TRANSFER_OUT'],
        [ids.swapId, 'SWAP'],
        [ids.depositId, 'DEPOSIT'],
      ]);
      expect(page.items).toEqual(newestFirst(page.items));
      expect(page.nextCursor).toBeNull();
    });

    it('shows a transfer to both sides with opposite entry types', async () => {
      const { outId } = await scenario();

      const bobs = await list(bob);

      expect(bobs.items.find((i) => i.id === outId)).toMatchObject({
        entryType: 'TRANSFER_IN',
        type: 'TRANSFER',
      });
      expect(bobs.items.map((i) => i.entryType)).toEqual([
        'TRANSFER_OUT',
        'DEPOSIT',
        'TRANSFER_IN',
      ]);
    });

    it.each([
      ['DEPOSIT', ['DEPOSIT']],
      ['SWAP', ['SWAP']],
      ['TRANSFER_OUT', ['TRANSFER_OUT']],
      ['TRANSFER_IN', ['TRANSFER_IN']],
    ])('filters by type=%s', async (type, expected) => {
      await scenario();

      expect((await list(alice, { type })).items.map((i) => i.entryType)).toEqual(expected);
    });

    it('filters by currency on either side of the transaction', async () => {
      const ids = await scenario();

      const usd = await list(alice, { currency: 'USDx' });
      const eur = await list(alice, { currency: 'EURx' });
      const ghs = await list(alice, { currency: 'cGHS' });

      expect(usd.items.map((i) => i.id)).toEqual([ids.inId, ids.swapId]);
      expect(eur.items.map((i) => i.id)).toEqual([ids.outId]);
      expect(ghs.items).toEqual([]);
    });

    it('combines type and currency filters', async () => {
      const ids = await scenario();

      const page = await list(alice, { type: 'SWAP', currency: 'cNGN' });

      expect(page.items.map((i) => i.id)).toEqual([ids.swapId]);
      expect((await list(alice, { type: 'DEPOSIT', currency: 'USDx' })).items).toEqual([]);
    });

    it('pages through 25 transactions as 10 + 10 + 5 without gaps or repeats', async () => {
      for (let i = 1; i <= 25; i += 1) {
        await deposit(alice, 'USDx', String(i));
      }

      const first = await list(alice, { limit: 10 });
      if (first.nextCursor === null) throw new Error('expected a second page');
      const second = await list(alice, { limit: 10, cursor: first.nextCursor });
      if (second.nextCursor === null) throw new Error('expected a third page');
      const third = await list(alice, { limit: 10, cursor: second.nextCursor });

      expect([first.items.length, second.items.length, third.items.length]).toEqual([10, 10, 5]);
      expect(third.nextCursor).toBeNull();
      const all = [...first.items, ...second.items, ...third.items];
      expect(new Set(all.map((i) => i.id)).size).toBe(25);
      expect(all).toEqual(newestFirst(all));
      expect(all.map((i) => i.sourceAmount).at(-1)).toBe('1.000000');
    });

    it('stays stable when new transactions arrive between pages', async () => {
      for (let i = 1; i <= 6; i += 1) {
        await deposit(alice, 'USDx', String(i));
      }
      const first = await list(alice, { limit: 3 });

      await deposit(alice, 'USDx', '99');
      if (first.nextCursor === null) throw new Error('expected a second page');
      const second = await list(alice, { limit: 3, cursor: first.nextCursor });

      expect(second.items.map((i) => i.sourceAmount)).toEqual(['3.000000', '2.000000', '1.000000']);
    });

    it('defaults to 20 items per page', async () => {
      for (let i = 1; i <= 21; i += 1) {
        await deposit(alice, 'USDx', '1');
      }

      const page = await list(alice);

      expect(page.items).toHaveLength(20);
      expect(page.nextCursor).not.toBeNull();
    });

    it.each([
      ['limit=0', { limit: 0 }, 'limit'],
      ['limit=101', { limit: 101 }, 'limit'],
      ['limit=abc', { limit: 'abc' }, 'limit'],
      ['an unknown type', { type: 'TRANSFER' }, 'type'],
      ['an unknown currency', { currency: 'NGN' }, 'currency'],
      ['a malformed cursor', { cursor: 'nope' }, 'cursor'],
    ])('rejects %s with 400', async (_name, query, path) => {
      const res = await http().get(`/v1/wallets/${alice}/transactions`).query(query).expect(400);

      expect(res.body).toHaveProperty(['error', 'details', 'issues', 0, 'path'], path);
    });

    it('returns 404 for an unknown wallet', async () => {
      const res = await http().get(`/v1/wallets/${newId()}/transactions`).expect(404);

      expect(res.body).toMatchObject({ error: { code: 'WALLET_NOT_FOUND' } });
    });
  });

  describe('GET /v1/transactions/:transactionId', () => {
    it('returns the transaction with every recorded field', async () => {
      const { outId } = await scenario();

      const res = await http().get(`/v1/transactions/${outId}`).expect(200);

      expect(res.body).toEqual({
        id: outId,
        type: 'TRANSFER',
        sourceWalletId: alice,
        destinationWalletId: bob,
        sourceAmount: '800.000000',
        sourceCurrency: 'cNGN',
        destinationAmount: '0.450000',
        destinationCurrency: 'EURx',
        rate: '0.000562500000000000',
        rateSource: 'LIVE',
        rateFetchedAt: '2026-10-29T00:02:31.000Z',
        createdAt: expect.any(String) as unknown,
      });
    });

    it('returns 404 TRANSACTION_NOT_FOUND for an unknown id', async () => {
      const res = await http().get(`/v1/transactions/${newId()}`).expect(404);

      expect(res.body).toMatchObject({ error: { code: 'TRANSACTION_NOT_FOUND' } });
    });

    it('returns 400 for an id that is not a UUID', async () => {
      await http().get('/v1/transactions/nope').expect(400);
    });
  });
});
