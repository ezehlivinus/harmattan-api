import type { RateTable } from '../domain/rate-table.js';

/** Current exchange rates for other modules (swaps, transfers, wallet totals). */
export interface FxRatesPort {
  /** Never fails: falls back to stored or built-in rates, labelled by `source`. */
  current(): Promise<RateTable>;
}

export const FX_RATES = Symbol('FxRates');
