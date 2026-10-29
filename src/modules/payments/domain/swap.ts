import type { Currency } from '../../../shared/domain/currency.js';
import type { Money } from '../../../shared/domain/money.js';
import type { AppliedRate } from './applied-rate.js';
import type { BalanceChange } from './balance-change.js';
import { AmountTooSmallError, SameCurrencyError } from './errors.js';
import { type Posting, credit, debit } from './posting.js';

/**
 * Converts money between two currencies of one wallet at `rate`, rounding the destination down
 * (the remainder stays in the FX pool). The FX pool is the counterparty in both currencies.
 */
export class Swap {
  private constructor(
    readonly walletId: string,
    readonly source: Money,
    readonly destination: Money,
    readonly rate: AppliedRate,
  ) {}

  static create(walletId: string, source: Money, to: Currency, rate: AppliedRate): Swap {
    if (source.currency === to) {
      throw new SameCurrencyError(to);
    }
    const destination = source.convert(rate.rate, to);
    if (destination.isZero()) {
      throw new AmountTooSmallError(
        `${source.toString()} ${source.currency} converts to less than 0.000001 ${to}`,
        { amount: source.toString(), currency: source.currency, toCurrency: to },
      );
    }
    return new Swap(walletId, source, destination, rate);
  }

  get balanceChanges(): BalanceChange[] {
    return [
      { walletId: this.walletId, direction: 'DEBIT', amount: this.source },
      { walletId: this.walletId, direction: 'CREDIT', amount: this.destination },
    ];
  }

  get postings(): Posting[] {
    const wallet = { type: 'WALLET' as const, walletId: this.walletId };
    const pool = { type: 'FX_POOL' as const };
    return [
      debit(wallet, this.source),
      credit(pool, this.source),
      debit(pool, this.destination),
      credit(wallet, this.destination),
    ];
  }
}
