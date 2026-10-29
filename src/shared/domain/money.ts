import { CURRENCY_SCALE, type Currency } from './currency.js';
import { Dec, type Decimal, ROUND_DOWN } from './decimal.js';
import { CurrencyMismatchError, InvalidAmountError } from './errors.js';

/** Plain decimal, no sign, no exponent, no leading zeros, at most 6 decimals. */
const AMOUNT_PATTERN = /^(0|[1-9]\d*)(\.\d{1,6})?$/;
/** Exchange rates are stored as numeric(38,18). */
const RATE_PATTERN = /^(0|[1-9]\d*)(\.\d{1,18})?$/;
/** numeric(38,6): 32 integer digits. */
const MAX_AMOUNT = new Dec('99999999999999999999999999999999.999999');
const MAX_RATE = new Dec('99999999999999999999.999999999999999999');

/**
 * Non-negative amount of one currency, exact to 6 decimal places. Immutable.
 * Input and output are decimal strings; JS numbers are never used for money.
 */
export class Money {
  private constructor(
    readonly currency: Currency,
    private readonly value: Decimal,
  ) {}

  /** Parses a decimal string such as `"1500.25"`. Zero is allowed (e.g. balances). */
  static of(amount: unknown, currency: Currency): Money {
    if (typeof amount !== 'string' || !AMOUNT_PATTERN.test(amount)) {
      throw new InvalidAmountError(
        'Amount must be a decimal string with at most 6 decimal places, e.g. "1500.25"',
        { amount },
      );
    }
    return Money.checked(new Dec(amount), currency);
  }

  /** Like `of`, but the amount must be greater than zero (request amounts). */
  static positive(amount: unknown, currency: Currency): Money {
    const money = Money.of(amount, currency);
    if (money.isZero()) {
      throw new InvalidAmountError('Amount must be greater than zero', { amount });
    }
    return money;
  }

  static zero(currency: Currency): Money {
    return new Money(currency, new Dec(0));
  }

  private static checked(value: Decimal, currency: Currency): Money {
    if (value.isNegative()) {
      throw new InvalidAmountError('Amount cannot be negative', { amount: value.toFixed() });
    }
    if (value.greaterThan(MAX_AMOUNT)) {
      throw new InvalidAmountError('Amount exceeds the supported range', {
        amount: value.toFixed(),
      });
    }
    return new Money(currency, value);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.checked(this.value.plus(other.value), this.currency);
  }

  /** Throws if the result would be negative; balances never go below zero. */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.checked(this.value.minus(other.value), this.currency);
  }

  /**
   * Converts at `rate` (units of `to` per unit of this currency, up to 18 decimals):
   * `roundDown(amount × rate, 6)`. The rounding remainder stays with the platform.
   */
  convert(rate: string, to: Currency): Money {
    if (!RATE_PATTERN.test(rate)) {
      throw new InvalidAmountError('Rate must be a decimal string with at most 18 decimals', {
        rate,
      });
    }
    const rateValue = new Dec(rate);
    if (rateValue.isZero() || rateValue.greaterThan(MAX_RATE)) {
      throw new InvalidAmountError('Rate must be greater than zero and within range', { rate });
    }
    const converted = this.value.times(rateValue).toDecimalPlaces(CURRENCY_SCALE, ROUND_DOWN);
    return Money.checked(converted, to);
  }

  compareTo(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    const result = this.value.comparedTo(other.value);
    return result < 0 ? -1 : result > 0 ? 1 : 0;
  }

  isGreaterThan(other: Money): boolean {
    return this.compareTo(other) === 1;
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.value.equals(other.value);
  }

  /** Fixed 6 decimal places, e.g. `"1500.250000"`; same text as Postgres numeric(38,6). */
  toString(): string {
    return this.value.toFixed(CURRENCY_SCALE, ROUND_DOWN);
  }

  toJSON(): string {
    return this.toString();
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new CurrencyMismatchError(
        `Cannot combine ${this.currency} and ${other.currency} amounts`,
        { currencies: [this.currency, other.currency] },
      );
    }
  }
}
