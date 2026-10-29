import { UnsupportedCurrencyError } from './errors.js';

/** The sandbox stablecoins. Codes are case-sensitive. */
export const CURRENCIES = ['cNGN', 'cGHS', 'cXAF', 'USDx', 'EURx'] as const;

export type Currency = (typeof CURRENCIES)[number];

/** Every currency uses 6 decimal places (storage: numeric(38,6)). */
export const CURRENCY_SCALE = 6;

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function parseCurrency(value: string): Currency {
  if (!isCurrency(value)) {
    throw new UnsupportedCurrencyError(`Unsupported currency: ${value}`, {
      currency: value,
      supported: CURRENCIES,
    });
  }
  return value;
}
