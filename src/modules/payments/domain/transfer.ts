import type { Currency } from '../../../shared/domain/currency.js';
import type { Money } from '../../../shared/domain/money.js';
import type { AppliedRate } from './applied-rate.js';
import type { BalanceChange } from './balance-change.js';
import { AmountTooSmallError, SelfTransferError } from './errors.js';
import { type Posting, credit, debit } from './posting.js';

/**
 * Money from one wallet to another. Same currency: moved as is (rate 1, no FX). Different
 * currencies: converted at `rate` through the FX pool, destination rounded down.
 */
export class Transfer {
  private constructor(
    readonly fromWalletId: string,
    readonly toWalletId: string,
    readonly source: Money,
    readonly destination: Money,
    /** Null when no conversion happens. */
    readonly rate: AppliedRate | null,
  ) {}

  static create(
    fromWalletId: string,
    toWalletId: string,
    source: Money,
    to: Currency,
    rate: AppliedRate | undefined,
  ): Transfer {
    if (fromWalletId === toWalletId) {
      throw new SelfTransferError(fromWalletId);
    }
    if (source.currency === to) {
      return new Transfer(fromWalletId, toWalletId, source, source, null);
    }
    if (rate === undefined) {
      throw new Error(`A rate is required to transfer ${source.currency} as ${to}`);
    }
    const destination = source.convert(rate.rate, to);
    if (destination.isZero()) {
      throw new AmountTooSmallError(
        `${source.toString()} ${source.currency} converts to less than 0.000001 ${to}`,
        { amount: source.toString(), currency: source.currency, toCurrency: to },
      );
    }
    return new Transfer(fromWalletId, toWalletId, source, destination, rate);
  }

  get balanceChanges(): BalanceChange[] {
    return [
      { walletId: this.fromWalletId, direction: 'DEBIT', amount: this.source },
      { walletId: this.toWalletId, direction: 'CREDIT', amount: this.destination },
    ];
  }

  get postings(): Posting[] {
    const sender = { type: 'WALLET' as const, walletId: this.fromWalletId };
    const receiver = { type: 'WALLET' as const, walletId: this.toWalletId };
    if (this.rate === null) {
      return [debit(sender, this.source), credit(receiver, this.destination)];
    }
    const pool = { type: 'FX_POOL' as const };
    return [
      debit(sender, this.source),
      credit(pool, this.source),
      debit(pool, this.destination),
      credit(receiver, this.destination),
    ];
  }
}
