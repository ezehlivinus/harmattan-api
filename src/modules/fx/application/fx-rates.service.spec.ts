import type { Clock } from '../../../shared/application/clock.js';
import { FALLBACK_FETCHED_AT, FALLBACK_UNITS_PER_USD } from '../domain/fallback-rates.js';
import { RateTable } from '../domain/rate-table.js';
import { FxRatesService } from './fx-rates.service.js';
import { FxProviderError, type FxRateProvider, type LiveRates } from './ports/fx-rate.provider.js';
import type { FxRateStore, StoredRates } from './ports/fx-rate.store.js';

const HOUR = 3_600_000;
const T0 = new Date('2026-10-29T10:00:00.000Z');
const live = (cNGN: string, nextRefreshAt: Date | null = null): LiveRates => ({
  unitsPerUsd: { USDx: '1', cNGN, cGHS: '12', cXAF: '600', EURx: '0.9' },
  fetchedAt: new Date('2026-10-29T00:02:31.000Z'),
  nextRefreshAt,
});

function setup(options: { stored?: StoredRates; storeFails?: boolean } = {}) {
  let now = T0;
  const clock: Clock = { now: () => now };
  const responses: (LiveRates | Error)[] = [];
  const provider = { calls: 0 } as FxRateProvider & { calls: number };
  provider.fetchUsdRates = async () => {
    provider.calls += 1;
    const next = responses.shift() ?? new FxProviderError('no response configured');
    if (next instanceof Error) return await Promise.reject(next);
    return await Promise.resolve(next);
  };
  const saved: LiveRates[] = [];
  const store: FxRateStore = {
    load: async () =>
      options.storeFails === true
        ? await Promise.reject(new Error('db down'))
        : await Promise.resolve(options.stored),
    saveLive: async (rates) => {
      if (options.storeFails === true) {
        await Promise.reject(new Error('db down'));
      }
      saved.push(rates);
    },
  };
  const service = new FxRatesService(provider, store, clock, {
    ttlMs: HOUR,
    failureTtlMs: 5 * 60_000,
  });
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  return { service, provider, responses, saved, advance };
}

describe('FxRatesService', () => {
  it('serves live rates and persists them as the last good table', async () => {
    const { service, responses, saved } = setup();
    responses.push(live('1600'));

    const table = await service.current();

    expect(table.source).toBe('LIVE');
    expect(table.rate('USDx', 'cNGN')).toBe('1600.000000000000000000');
    expect(saved).toHaveLength(1);
  });

  it('caches for the TTL, then refreshes', async () => {
    const { service, provider, responses, advance } = setup();
    responses.push(live('1600'), live('1700'));

    await service.current();
    advance(HOUR - 1);
    expect((await service.current()).rate('USDx', 'cNGN')).toBe('1600.000000000000000000');
    advance(1);
    expect((await service.current()).rate('USDx', 'cNGN')).toBe('1700.000000000000000000');
    expect(provider.calls).toBe(2);
  });

  it("expires the cache at the provider's next update if that is sooner", async () => {
    const { service, provider, responses, advance } = setup();
    responses.push(live('1600', new Date(T0.getTime() + 10 * 60_000)), live('1700'));

    await service.current();
    advance(10 * 60_000);
    await service.current();

    expect(provider.calls).toBe(2);
  });

  it('shares one provider request between concurrent callers', async () => {
    const { service, provider, responses } = setup();
    responses.push(live('1600'));

    await Promise.all([service.current(), service.current(), service.current()]);

    expect(provider.calls).toBe(1);
  });

  it('falls back to the last good live table, labelled CACHED', async () => {
    const stored: StoredRates = { ...live('1500'), source: 'LIVE' };
    const { service } = setup({ stored });

    const table = await service.current();

    expect(table.source).toBe('CACHED');
    expect(table.rate('USDx', 'cNGN')).toBe('1500.000000000000000000');
    expect(table.fetchedAt).toEqual(stored.fetchedAt);
  });

  it('keeps a seeded table labelled FALLBACK', async () => {
    const stored: StoredRates = { ...live('1400'), source: 'FALLBACK' };

    expect((await setup({ stored }).service.current()).source).toBe('FALLBACK');
  });

  it('uses the built-in fallback table when the database has nothing (or fails)', async () => {
    for (const options of [{}, { storeFails: true }]) {
      const table = await setup(options).service.current();

      expect(table.source).toBe('FALLBACK');
      expect(table.fetchedAt).toEqual(FALLBACK_FETCHED_AT);
      expect(table.rate('USDx', 'cNGN')).toBe(
        RateTable.create(FALLBACK_UNITS_PER_USD, 'FALLBACK', FALLBACK_FETCHED_AT).rate(
          'USDx',
          'cNGN',
        ),
      );
    }
  });

  it('serves live rates even if saving them fails', async () => {
    const { service, responses } = setup({ storeFails: true });
    responses.push(live('1600'));

    expect((await service.current()).source).toBe('LIVE');
  });

  it('does not hammer a failing provider: retries only after the failure TTL', async () => {
    const { service, provider, responses, advance } = setup();

    await service.current();
    advance(5 * 60_000 - 1);
    await service.current();
    expect(provider.calls).toBe(1);

    responses.push(live('1600'));
    advance(1);
    expect((await service.current()).source).toBe('LIVE');
    expect(provider.calls).toBe(2);
  });
});
