import { Query } from '@nestjs/cqrs';
import type { Currency } from '../../../../../shared/domain/currency.js';
import type { RateSource } from '../../../domain/rate-table.js';

export interface RateView {
  from: Currency;
  to: Currency;
  /** Units of `to` per one unit of `from`, 18 decimals. */
  rate: string;
  source: RateSource;
  fetchedAt: string;
}

export interface RatesView {
  source: RateSource;
  fetchedAt: string;
  attribution: { text: string; url: string };
  rates: RateView[];
}

export class GetRatesQuery extends Query<RatesView> {}
