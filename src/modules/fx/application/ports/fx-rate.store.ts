import type { Currency } from '../../../../shared/domain/currency.js';
import type { LiveRates } from './fx-rate.provider.js';

/** Rates kept in the database: the last good live table, or the seeded fallback. */
export interface StoredRates {
  unitsPerUsd: Record<Currency, string>;
  source: 'LIVE' | 'FALLBACK';
  fetchedAt: Date;
}

export interface FxRateStore {
  /** The complete stored table, or undefined if any currency is missing. */
  load(): Promise<StoredRates | undefined>;
  saveLive(rates: LiveRates): Promise<void>;
}

export const FX_RATE_STORE = Symbol('FxRateStore');
