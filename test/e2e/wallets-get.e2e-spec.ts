import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { newId } from '../../src/shared/domain/id.js';
import { createTestApp } from '../helpers/app.js';
import { providerUp } from '../helpers/fx.js';
import { createTestDatabase, truncateAll } from '../helpers/database.js';
import { expectLedgerBalanced } from '../helpers/ledger.js';

describe('GET /v1/wallets/:walletId (e2e)', () => {
  const db = createTestDatabase();
  const apps: INestApplication<App>[] = [];

  const boot = async (fetchFn?: typeof fetch) => {
    const app = await createTestApp(fetchFn === undefined ? {} : { fetch: fetchFn });
    apps.push(app);
    return request(app.getHttpServer());
  };
  const createWallet = async (http: Awaited<ReturnType<typeof boot>>) => {
    const res = await http.post('/v1/wallets').send({ email: 'ada@example.com' }).expect(201);
    return (res.body as { id: string }).id;
  };

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterEach(async () => {
    await expectLedgerBalanced(db);
  });

  afterAll(async () => {
    await Promise.all(
      apps.map(async (app) => {
        await app.close();
      }),
    );
    await db.$client.end();
  });

  it('returns balances, their USD values and the total at current rates', async () => {
    const http = await boot(providerUp);
    const id = await createWallet(http);
    for (const [currency, amount] of [
      ['cNGN', '1600'],
      ['cXAF', '1000'],
      ['USDx', '1.5'],
      ['EURx', '9'],
    ]) {
      await http
        .post(`/v1/wallets/${id}/deposits`)
        .set('Idempotency-Key', newId())
        .send({ currency, amount })
        .expect(201);
    }

    const res = await http.get(`/v1/wallets/${id}`).expect(200);

    expect(res.body).toMatchObject({
      id,
      email: 'ada@example.com',
      balances: [
        { currency: 'cNGN', amount: '1600.000000', usdValue: '1.000000' },
        { currency: 'cGHS', amount: '0.000000', usdValue: '0.000000' },
        { currency: 'cXAF', amount: '1000.000000', usdValue: '1.666666' },
        { currency: 'USDx', amount: '1.500000', usdValue: '1.500000' },
        { currency: 'EURx', amount: '9.000000', usdValue: '10.000000' },
      ],
      totalUsd: '14.166666',
      ratesAsOf: '2026-10-29T00:02:31.000Z',
      ratesSource: 'LIVE',
    });
  });

  it('still answers when the FX provider is down, saying which rates it used', async () => {
    const http = await boot();
    const id = await createWallet(http);

    const res = await http.get(`/v1/wallets/${id}`).expect(200);

    expect(res.body).toMatchObject({ totalUsd: '0.000000', ratesSource: 'FALLBACK' });
  });

  it('returns 404 WALLET_NOT_FOUND for an unknown id', async () => {
    const http = await boot();

    const res = await http.get(`/v1/wallets/${newId()}`).expect(404);

    expect(res.body).toMatchObject({ error: { code: 'WALLET_NOT_FOUND' } });
  });

  it('returns 400 for an id that is not a UUID', async () => {
    const http = await boot();

    const res = await http.get('/v1/wallets/not-a-uuid').expect(400);

    expect(res.body).toHaveProperty(['error', 'details', 'issues', 0, 'path'], 'walletId');
  });
});
