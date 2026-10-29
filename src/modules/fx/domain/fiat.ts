import type { Currency } from '../../../shared/domain/currency.js';

/** Each sandbox stablecoin is pegged 1:1 to a fiat currency (ADR-004). */
export const FIAT_CODE: Readonly<Record<Currency, string>> = {
  cNGN: 'NGN',
  cGHS: 'GHS',
  cXAF: 'XAF',
  USDx: 'USD',
  EURx: 'EUR',
};
