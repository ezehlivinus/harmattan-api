import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { fxRates } from '../../src/shared/infrastructure/database/schema/index.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDatabase, truncateAll } from '../helpers/database.js';

const CURRENCIES = ['cNGN', 'cGHS', 'cXAF', 'USDx', 'EURx'];
const PROVIDER_BODY =
  '{"result":"success","base_code":"USD","time_last_update_unix":1793232151,' +
  '"time_next_update_unix":1793320461,"rates":{"USD":1,"NGN":1600,"GHS":12.5,"XAF":600,"EUR":0.9}}';

const providerUp: typeof fetch = async () => await Promise.resolve(new Response(PROVIDER_BODY));
const providerDown: typeof fetch = async () => await Promise.reject(new TypeError('fetch failed'));

interface RateEntry {
  from: string;
  to: string;
  rate: string;
  source: string;
  fetchedAt: string;
}
interface RatesBody {
  source: string;
  fetchedAt: string;
  attribution: { text: string; url: string };
  rates: RateEntry[];
}

describe('GET /v1/fx/rates (e2e)', () => {
  const db = createTestDatabase();
  const apps: INestApplication<App>[] = [];

  const getRates = async (fetchFn: typeof fetch): Promise<RatesBody> => {
    // A new app per call: each has its own in-memory cache, like a fresh process.
    const app = await createTestApp({ fetch: fetchFn });
    apps.push(app);
    const res = await request(app.getHttpServer()).get('/v1/fx/rates').expect(200);
    return res.body as RatesBody;
  };
  const rate = (body: RatesBody, from: string, to: string) =>
    body.rates.find((r) => r.from === from && r.to === to)?.rate;

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await Promise.all(
      apps.map(async (app) => {
        await app.close();
      }),
    );
    await db.$client.end();
  });

  it('returns the full 5×5 matrix of live rates with when they were refreshed', async () => {
    const body = await getRates(providerUp);

    expect(body.source).toBe('LIVE');
    expect(body.fetchedAt).toBe('2026-10-29T00:02:31.000Z');
    expect(body.attribution).toEqual({
      text: 'Rates By Exchange Rate API',
      url: 'https://www.exchangerate-api.com',
    });
    expect(body.rates).toHaveLength(25);
    for (const from of CURRENCIES) {
      for (const to of CURRENCIES) {
        expect(body.rates).toContainEqual(
          expect.objectContaining({
            from,
            to,
            source: 'LIVE',
            fetchedAt: body.fetchedAt,
          }) as unknown,
        );
      }
    }
    expect(rate(body, 'USDx', 'cNGN')).toBe('1600.000000000000000000');
    expect(rate(body, 'cNGN', 'cGHS')).toBe('0.007812500000000000');
    expect(rate(body, 'EURx', 'EURx')).toBe('1.000000000000000000');
  });

  it('persists live rates, then serves them as CACHED when the provider is down', async () => {
    await getRates(providerUp);
    expect(await db.$count(fxRates)).toBe(5);

    const body = await getRates(providerDown);

    expect(body.source).toBe('CACHED');
    expect(body.fetchedAt).toBe('2026-10-29T00:02:31.000Z');
    expect(rate(body, 'USDx', 'cNGN')).toBe('1600.000000000000000000');
  });

  it('serves the built-in FALLBACK table when the provider is down and nothing is stored', async () => {
    const body = await getRates(providerDown);

    expect(body.source).toBe('FALLBACK');
    expect(body.rates).toHaveLength(25);
    expect(body.rates.every((r) => r.source === 'FALLBACK')).toBe(true);
  });
});
