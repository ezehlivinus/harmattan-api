import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { newId } from '../../src/shared/domain/id.js';
import { balances, transactions } from '../../src/shared/infrastructure/database/schema/index.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDatabase, truncateAll } from '../helpers/database.js';
import { PROVIDER_FETCHED_AT, providerUp } from '../helpers/fx.js';
import { expectLedgerBalanced } from '../helpers/ledger.js';

describe('POST /v1/wallets/:walletId/swaps (e2e)', () => {
  let app: INestApplication<App>;
  const db = createTestDatabase();
  let walletId: string;

  const http = () => request(app.getHttpServer());
  const deposit = async (currency: string, amount: string) => {
    await http()
      .post(`/v1/wallets/${walletId}/deposits`)
      .set('Idempotency-Key', newId())
      .send({ currency, amount })
      .expect(201);
  };
  const swap = (body: unknown, key = newId(), wallet = walletId) =>
    http()
      .post(`/v1/wallets/${wallet}/swaps`)
      .set('Idempotency-Key', key)
      .send(body as object);
  const balance = async (currency: string) => {
    const rows = await db.select().from(balances).where(eq(balances.walletId, walletId));
    return rows.find((r) => r.currency === currency)?.amount;
  };

  beforeAll(async () => {
    app = await createTestApp({ fetch: providerUp });
  });

  afterAll(async () => {
    await app.close();
    await db.$client.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
    const res = await http().post('/v1/wallets').send({ email: 'ada@example.com' }).expect(201);
    walletId = (res.body as { id: string }).id;
  });

  afterEach(async () => {
    await expectLedgerBalanced(db);
  });

  it('converts at the current rate and records the rate used', async () => {
    await deposit('cNGN', '1600');

    const res = await swap({ fromCurrency: 'cNGN', toCurrency: 'USDx', amount: '1000' }).expect(
      201,
    );

    expect(res.body).toEqual({
      transaction: {
        id: expect.any(String) as unknown,
        type: 'SWAP',
        sourceWalletId: walletId,
        destinationWalletId: walletId,
        sourceAmount: '1000.000000',
        sourceCurrency: 'cNGN',
        destinationAmount: '0.625000',
        destinationCurrency: 'USDx',
        rate: '0.000625000000000000',
        rateSource: 'LIVE',
        rateFetchedAt: PROVIDER_FETCHED_AT,
        createdAt: expect.any(String) as unknown,
      },
      balances: [
        { currency: 'cNGN', amount: '600.000000' },
        { currency: 'USDx', amount: '0.625000' },
      ],
    });
    expect(await balance('cNGN')).toBe('600.000000');
    expect(await balance('USDx')).toBe('0.625000');
  });

  it('rounds the destination down', async () => {
    await deposit('cXAF', '100');

    const res = await swap({ fromCurrency: 'cXAF', toCurrency: 'cGHS', amount: '100' }).expect(201);

    expect(res.body).toHaveProperty(['transaction', 'destinationAmount'], '2.083333');
  });

  it('allows spending the whole balance', async () => {
    await deposit('USDx', '5');

    await swap({ fromCurrency: 'USDx', toCurrency: 'EURx', amount: '5' }).expect(201);

    expect(await balance('USDx')).toBe('0.000000');
    expect(await balance('EURx')).toBe('4.500000');
  });

  it('rejects a swap that would make the balance negative, changing nothing', async () => {
    await deposit('USDx', '5');

    const res = await swap({ fromCurrency: 'USDx', toCurrency: 'EURx', amount: '5.000001' }).expect(
      422,
    );

    expect(res.body).toMatchObject({ error: { code: 'INSUFFICIENT_FUNDS' } });
    expect(await balance('USDx')).toBe('5.000000');
    expect(await balance('EURx')).toBe('0.000000');
    expect(await db.$count(transactions)).toBe(1); // the deposit only
  });

  it('rejects a swap to the same currency', async () => {
    const res = await swap({ fromCurrency: 'USDx', toCurrency: 'USDx', amount: '1' }).expect(422);

    expect(res.body).toMatchObject({ error: { code: 'SAME_CURRENCY' } });
  });

  it('rejects an amount too small to convert to anything', async () => {
    await deposit('cNGN', '1');

    const res = await swap({ fromCurrency: 'cNGN', toCurrency: 'USDx', amount: '0.000001' }).expect(
      422,
    );

    expect(res.body).toMatchObject({ error: { code: 'AMOUNT_TOO_SMALL' } });
    expect(await balance('cNGN')).toBe('1.000000');
  });

  it('returns 404 for an unknown wallet', async () => {
    const res = await swap(
      { fromCurrency: 'USDx', toCurrency: 'EURx', amount: '1' },
      newId(),
      newId(),
    ).expect(404);

    expect(res.body).toMatchObject({ error: { code: 'WALLET_NOT_FOUND' } });
  });

  it.each([
    ['a missing Idempotency-Key', null, { fromCurrency: 'USDx', toCurrency: 'EURx', amount: '1' }],
    ['a JSON number amount', 'k', { fromCurrency: 'USDx', toCurrency: 'EURx', amount: 1 }],
    ['an unsupported currency', 'k', { fromCurrency: 'USD', toCurrency: 'EURx', amount: '1' }],
  ])('rejects %s with 400', async (_name, key, body) => {
    const req = http().post(`/v1/wallets/${walletId}/swaps`);
    await (key === null ? req : req.set('Idempotency-Key', key)).send(body).expect(400);
  });

  it('replays a repeated request without converting twice', async () => {
    await deposit('USDx', '10');
    const body = { fromCurrency: 'USDx', toCurrency: 'EURx', amount: '1' };

    const first = await swap(body, 'swap-1').expect(201);
    const second = await swap(body, 'swap-1').expect(201);

    expect(second.body).toEqual(first.body);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(await balance('USDx')).toBe('9.000000');
  });

  describe('concurrency', () => {
    it('lets exactly 10 of 50 parallel swaps through when the balance covers 10', async () => {
      await deposit('USDx', '10');

      const responses = await Promise.all(
        Array.from(
          { length: 50 },
          async () => await swap({ fromCurrency: 'USDx', toCurrency: 'EURx', amount: '1' }),
        ),
      );

      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(10);
      expect(statuses.filter((s) => s === 422)).toHaveLength(40);
      expect(await balance('USDx')).toBe('0.000000');
      expect(await balance('EURx')).toBe('9.000000');
    });

    it('runs opposite swaps on one wallet in parallel without deadlocks', async () => {
      await deposit('cNGN', '32000');
      await deposit('USDx', '20');

      const responses = await Promise.all([
        ...Array.from(
          { length: 20 },
          async () => await swap({ fromCurrency: 'cNGN', toCurrency: 'USDx', amount: '1600' }),
        ),
        ...Array.from(
          { length: 20 },
          async () => await swap({ fromCurrency: 'USDx', toCurrency: 'cNGN', amount: '1' }),
        ),
      ]);

      expect(responses.map((r) => r.status)).toEqual(Array<number>(40).fill(201));
      expect(await balance('cNGN')).toBe('32000.000000');
      expect(await balance('USDx')).toBe('20.000000');
    });
  });
});
