import type { RateSource } from '../../fx/domain/rate-table.js';

/** The exchange rate used for a conversion, recorded on the transaction. */
export interface AppliedRate {
  /** Units of destination per unit of source, up to 18 decimals. */
  rate: string;
  source: RateSource;
  /** When the provider last refreshed this rate. */
  fetchedAt: Date;
}
