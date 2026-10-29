import { FxProviderError } from '../application/ports/fx-rate.provider.js';
import { ErApiFxProvider } from './er-api-fx.provider.js';

const URL = 'https://open.er-api.com/v6/latest/USD';
/** A provider-like body; numbers are written as raw JSON text, exactly as the provider does. */
const body = (rates: string, extra = '') =>
  `{"result":"success","base_code":"USD","time_last_update_unix":1793232151,` +
  `"time_next_update_unix":1793320461${extra},"rates":{${rates}}}`;
const RATES =
  '"USD":1,"NGN":1346.236888,"GHS":11.639916,"XAF":588.52908,"EUR":0.897215,"JPY":152.3';

const respond =
  (text: string, status = 200): typeof fetch =>
  async () =>
    await Promise.resolve(new Response(text, { status }));

const provider = (fetchFn: typeof fetch, timeoutMs = 2000) =>
  new ErApiFxProvider(fetchFn, { url: URL, timeoutMs });

describe('ErApiFxProvider', () => {
  it('maps the stablecoins to fiat codes, keeping the exact decimal text', async () => {
    const rates = await provider(respond(body(RATES))).fetchUsdRates();

    expect(rates).toEqual({
      unitsPerUsd: {
        USDx: '1',
        cNGN: '1346.236888',
        cGHS: '11.639916',
        cXAF: '588.52908',
        EURx: '0.897215',
      },
      fetchedAt: new Date(1793232151 * 1000),
      nextRefreshAt: new Date(1793320461 * 1000),
    });
  });

  it('never goes through a float: 18+ significant digits survive', async () => {
    const precise = RATES.replace('0.897215', '0.8972150000000000055511151231257827');

    const rates = await provider(respond(body(precise))).fetchUsdRates();

    expect(rates.unitsPerUsd.EURx).toBe('0.8972150000000000055511151231257827');
  });

  it('expands exponent notation into a plain decimal', async () => {
    const rates = await provider(
      respond(body(RATES.replace('588.52908', '5.8852908e2'))),
    ).fetchUsdRates();

    expect(rates.unitsPerUsd.cXAF).toBe('588.52908');
  });

  it('requests the configured URL with a timeout signal', async () => {
    const calls: { url: string; signal: unknown }[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({
        url: input instanceof Request ? input.url : input.toString(),
        signal: init?.signal,
      });
      return await Promise.resolve(new Response(body(RATES)));
    };

    await provider(fetchFn).fetchUsdRates();

    expect(calls[0]?.url).toBe(URL);
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [
      'an error body sent with HTTP 200',
      respond('{"result":"error","error-type":"unsupported-code"}'),
      /unsupported-code/,
    ],
    ['HTTP 429 (rate limited)', respond('{"result":"error"}', 429), /429/],
    ['HTTP 500', respond('oops', 500), /500/],
    ['a non-JSON body', respond('<html>maintenance</html>'), /JSON/],
    [
      'a base other than USD',
      respond(body(RATES).replace('"base_code":"USD"', '"base_code":"EUR"')),
      /base/i,
    ],
    ['a missing currency', respond(body(RATES.replace('"GHS":11.639916,', ''))), /GHS/],
    ['a zero rate', respond(body(RATES.replace('11.639916', '0'))), /GHS/],
    [
      'a network failure',
      async () => await Promise.reject(new TypeError('fetch failed')),
      /fetch failed/,
    ],
  ])('fails with FxProviderError on %s', async (_name, fetchFn, message) => {
    const error = await provider(fetchFn)
      .fetchUsdRates()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FxProviderError);
    expect((error as Error).message).toMatch(message);
  });

  it('gives up after the timeout', async () => {
    const hang: typeof fetch = async (_input, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      });
    const started = Date.now();

    const error = await provider(hang, 50)
      .fetchUsdRates()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FxProviderError);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
