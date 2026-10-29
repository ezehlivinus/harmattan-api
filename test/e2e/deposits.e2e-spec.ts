import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { newId } from '../../src/shared/domain/id.js';
import {
  balances,
  idempotencyKeys,
  transactions,
} from '../../src/shared/infrastructure/database/schema/index.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDatabase, truncateAll } from '../helpers/database.js';
import { expectLedgerBalanced } from '../helpers/ledger.js';

describe('POST /v1/wallets/:walletId/deposits (e2e)', () => {
  let app: INestApplication<App>;
  const db = createTestDatabase();
  let walletId: string;

  // `null` sends no Idempotency-Key header (a default parameter would replace `undefined`).
  const deposit = (body: unknown, key: string | null = newId(), wallet = walletId) => {
    const req = request(app.getHttpServer()).post(`/v1/wallets/${wallet}/deposits`);
    return (key === null ? req : req.set('Idempotency-Key', key)).send(body as object);
  };
  const balance = async (currency: string) => {
    const rows = await db.select().from(balances).where(eq(balances.walletId, walletId));
    return rows.find((r) => r.currency === currency)?.amount;
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await db.$client.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
    const res = await request(app.getHttpServer())
      .post('/v1/wallets')
      .send({ email: 'ada@example.com' })
      .expect(201);
    walletId = (res.body as { id: string }).id;
  });

  afterEach(async () => {
    await expectLedgerBalanced(db);
  });

  it('credits the balance immediately and records the transaction', async () => {
    const res = await deposit({ currency: 'cNGN', amount: '1500.25' }).expect(201);

    expect(res.headers['idempotent-replayed']).toBeUndefined();
    expect(res.body).toEqual({
      transaction: {
        id: expect.any(String) as unknown,
        type: 'DEPOSIT',
        sourceWalletId: null,
        destinationWalletId: walletId,
        sourceAmount: '1500.250000',
        sourceCurrency: 'cNGN',
        destinationAmount: '1500.250000',
        destinationCurrency: 'cNGN',
        rate: '1.000000000000000000',
        rateSource: null,
        rateFetchedAt: null,
        createdAt: expect.any(String) as unknown,
      },
      balance: { currency: 'cNGN', amount: '1500.250000' },
    });
    expect(await balance('cNGN')).toBe('1500.250000');
    expect(await balance('USDx')).toBe('0.000000');
  });

  it('adds successive deposits exactly', async () => {
    await deposit({ currency: 'USDx', amount: '0.1' }).expect(201);
    const res = await deposit({ currency: 'USDx', amount: '0.2' }).expect(201);

    expect(res.body).toHaveProperty(['balance', 'amount'], '0.300000');
  });

  describe('idempotency', () => {
    it('requires an Idempotency-Key header', async () => {
      const res = await deposit({ currency: 'cNGN', amount: '1' }, null).expect(400);

      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(res.body).toHaveProperty(['error', 'details', 'issues', 0, 'path'], 'Idempotency-Key');
    });

    it('rejects an over-long key', async () => {
      await deposit({ currency: 'cNGN', amount: '1' }, 'k'.repeat(256)).expect(400);
    });

    it('replays the same response for the same key and body, moving money once', async () => {
      const first = await deposit({ currency: 'cNGN', amount: '100' }, 'key-1').expect(201);
      const second = await deposit({ currency: 'cNGN', amount: '100' }, 'key-1').expect(201);

      expect(second.body).toEqual(first.body);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(await balance('cNGN')).toBe('100.000000');
      expect(await db.$count(transactions)).toBe(1);
    });

    it('rejects the same key with a different body', async () => {
      await deposit({ currency: 'cNGN', amount: '100' }, 'key-1').expect(201);

      const res = await deposit({ currency: 'cNGN', amount: '200' }, 'key-1').expect(422);

      expect(res.body).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REUSED' } });
      expect(await balance('cNGN')).toBe('100.000000');
    });

    it('scopes keys to the wallet', async () => {
      const other = await request(app.getHttpServer())
        .post('/v1/wallets')
        .send({ email: 'bob@example.com' })
        .expect(201);

      await deposit({ currency: 'cNGN', amount: '1' }, 'shared-key').expect(201);
      const res = await deposit(
        { currency: 'cNGN', amount: '1' },
        'shared-key',
        (other.body as { id: string }).id,
      ).expect(201);

      expect(res.headers['idempotent-replayed']).toBeUndefined();
    });

    it('processes 10 concurrent identical requests exactly once', async () => {
      const responses = await Promise.all(
        Array.from(
          { length: 10 },
          async () => await deposit({ currency: 'EURx', amount: '42.5' }, 'same-key'),
        ),
      );

      expect(responses.map((r) => r.status)).toEqual(Array<number>(10).fill(201));
      const bodies = new Set(responses.map((r) => JSON.stringify(r.body)));
      expect(bodies.size).toBe(1);
      expect(responses.filter((r) => r.headers['idempotent-replayed'] === 'true')).toHaveLength(9);
      expect(await balance('EURx')).toBe('42.500000');
      expect(await db.$count(transactions)).toBe(1);
      expect(await db.$count(idempotencyKeys)).toBe(1);
    });

    it('does not store a key when the request fails, so a corrected retry succeeds', async () => {
      await deposit({ currency: 'cNGN', amount: '1' }, 'k', newId()).expect(404);

      expect(await db.$count(idempotencyKeys)).toBe(0);
    });
  });

  it('applies 20 concurrent distinct deposits exactly', async () => {
    await Promise.all(
      Array.from({ length: 20 }, async () => {
        await deposit({ currency: 'cGHS', amount: '0.000001' }).expect(201);
      }),
    );

    expect(await balance('cGHS')).toBe('0.000020');
  });

  it('returns 404 WALLET_NOT_FOUND for an unknown wallet', async () => {
    const res = await deposit({ currency: 'cNGN', amount: '1' }, null, newId());

    expect(res.status).toBe(400); // the key is checked before anything else
    const found = await deposit({ currency: 'cNGN', amount: '1' }, 'k', newId()).expect(404);
    expect(found.body).toMatchObject({ error: { code: 'WALLET_NOT_FOUND' } });
  });

  it.each([
    ['a JSON number', { currency: 'cNGN', amount: 5 }, 'amount'],
    ['a negative amount', { currency: 'cNGN', amount: '-5' }, 'amount'],
    ['more than 6 decimals', { currency: 'cNGN', amount: '1.0000001' }, 'amount'],
    ['an unsupported currency', { currency: 'NGN', amount: '5' }, 'currency'],
  ])('rejects %s with 400', async (_name, body, path) => {
    const res = await deposit(body).expect(400);

    expect(res.body).toHaveProperty(['error', 'details', 'issues', 0, 'path'], path);
  });

  it('rejects a non-UUID wallet id with 400', async () => {
    await deposit({ currency: 'cNGN', amount: '1' }, 'k', 'not-a-uuid').expect(400);
  });

  it('rejects more than 1,000,000,000,000 per request with 422', async () => {
    const res = await deposit({ currency: 'USDx', amount: '1000000000000.000001' }).expect(422);

    expect(res.body).toMatchObject({ error: { code: 'AMOUNT_LIMIT_EXCEEDED' } });
  });
});
