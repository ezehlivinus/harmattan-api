/**
 * A fake open.er-api.com for e2e tests (pass to `createTestApp({ fetch })`). Units per USD:
 * USD 1, NGN 1600, GHS 12.5, XAF 600, EUR 0.9, so cross rates are easy to check by hand:
 * cNGN→USDx 0.000625, USDx→EURx 0.9, cGHS→cXAF 48.
 */
export const PROVIDER_BODY =
  '{"result":"success","base_code":"USD","time_last_update_unix":1793232151,' +
  '"time_next_update_unix":1793320461,"rates":{"USD":1,"NGN":1600,"GHS":12.5,"XAF":600,"EUR":0.9}}';

/** `fetchedAt` of `PROVIDER_BODY` (time_last_update_unix 1793232151). */
export const PROVIDER_FETCHED_AT = '2026-10-29T00:02:31.000Z';

export const providerUp: typeof fetch = async () =>
  await Promise.resolve(new Response(PROVIDER_BODY));

export const providerDown: typeof fetch = async () =>
  await Promise.reject(new TypeError('fetch failed'));
