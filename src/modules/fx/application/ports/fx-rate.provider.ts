import type { Currency } from '../../../../shared/domain/currency.js';

export interface LiveRates {
  unitsPerUsd: Record<Currency, string>;
  /** When the provider last refreshed its data. */
  fetchedAt: Date;
  /** When the provider will publish new data, if it says. */
  nextRefreshAt: Date | null;
}

/** A live source of USD-based rates. */
export interface FxRateProvider {
  /** Throws `FxProviderError` when the provider is unreachable, slow or returns bad data. */
  fetchUsdRates(): Promise<LiveRates>;
}

export const FX_RATE_PROVIDER = Symbol('FxRateProvider');

export class FxProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FxProviderError';
  }
}
