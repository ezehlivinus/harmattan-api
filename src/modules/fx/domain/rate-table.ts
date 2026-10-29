import { CURRENCIES, CURRENCY_SCALE, type Currency } from '../../../shared/domain/currency.js';
import { Dec, type Decimal, ROUND_DOWN } from '../../../shared/domain/decimal.js';
import { Money } from '../../../shared/domain/money.js';

/** Where a rate came from (ADR-004). */
export type RateSource = 'LIVE' | 'CACHED' | 'FALLBACK';

/** Exchange rates are stored and applied with 18 decimal places (numeric(38,18)). */
const RATE_SCALE = 18;

/**
 * A complete set of rates, kept as units of each currency per 1 USD; every pair is derived as
 * `A→B = perUsd[B] / perUsd[A]`, truncated to 18 decimals (never rounded up).
 */
export class RateTable {
  private constructor(
    private readonly perUsd: ReadonlyMap<Currency, Decimal>,
    readonly source: RateSource,
    /** When the provider last refreshed these rates. */
    readonly fetchedAt: Date,
  ) {}

  static create(
    unitsPerUsd: Readonly<Record<Currency, string>>,
    source: RateSource,
    fetchedAt: Date,
  ): RateTable {
    const perUsd = new Map<Currency, Decimal>();
    for (const currency of CURRENCIES) {
      const raw = unitsPerUsd[currency];
      const value = /^\d+(\.\d+)?$/.test(raw) ? new Dec(raw) : undefined;
      if (value === undefined || value.isZero()) {
        throw new Error(`Invalid units per USD for ${currency}: ${raw}`);
      }
      perUsd.set(currency, value);
    }
    return new RateTable(perUsd, source, fetchedAt);
  }

  /** Units of `to` per one unit of `from`, as a decimal string with 18 decimal places. */
  rate(from: Currency, to: Currency): string {
    if (from === to) {
      return new Dec(1).toFixed(RATE_SCALE);
    }
    return this.unitsPerUsd(to).div(this.unitsPerUsd(from)).toFixed(RATE_SCALE, ROUND_DOWN);
  }

  /**
   * USD value of `money` for display: `amount ÷ unitsPerUsd`, rounded down once. Exact division
   * rather than the truncated cross rate, so 9 EURx at 0.9 per USD is 10, not 9.999999.
   */
  valueInUsd(money: Money): Money {
    const usd = new Dec(money.toString())
      .div(this.unitsPerUsd(money.currency))
      .toFixed(CURRENCY_SCALE, ROUND_DOWN);
    return Money.of(usd, 'USDx');
  }

  withSource(source: RateSource): RateTable {
    return new RateTable(this.perUsd, source, this.fetchedAt);
  }

  private unitsPerUsd(currency: Currency): Decimal {
    const value = this.perUsd.get(currency);
    if (value === undefined) {
      throw new Error(`No rate for ${currency}`);
    }
    return value;
  }
}
