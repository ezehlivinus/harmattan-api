import type { Currency } from '../../../shared/domain/currency.js';

/**
 * Last-resort rates, used when the provider is down and nothing is stored yet. Taken from
 * open.er-api.com on 2026-10-29 (provider refresh 00:02:31 UTC); they drift from the market
 * over time (README: known limitations). Also seeded into `fx_rates` at container start.
 */
export const FALLBACK_UNITS_PER_USD: Readonly<Record<Currency, string>> = {
  USDx: '1',
  cNGN: '1346.236888',
  cGHS: '11.639916',
  cXAF: '588.52908',
  EURx: '0.897215',
};

export const FALLBACK_FETCHED_AT = new Date('2026-10-29T00:02:31.000Z');
