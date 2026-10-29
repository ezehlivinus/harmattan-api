import { Money } from '../../../shared/domain/money.js';
import type { BalanceChange } from './balance-change.js';
import { AmountLimitExceededError } from './errors.js';
import { type Posting, credit, debit } from './posting.js';

/** Sanity cap per deposit request (FR-2). */
const MAX_DEPOSIT = '1000000000000';

/**
 * Simulated deposit: money arrives from outside the platform, so the wallet is credited and the
 * external settlement account debited by the same amount.
 */
export class Deposit {
  private constructor(
    readonly walletId: string,
    readonly amount: Money,
    readonly postings: Posting[],
  ) {}

  static create(walletId: string, amount: Money): Deposit {
    if (amount.isGreaterThan(Money.of(MAX_DEPOSIT, amount.currency))) {
      throw new AmountLimitExceededError('A single deposit cannot exceed 1,000,000,000,000', {
        amount: amount.toString(),
        max: MAX_DEPOSIT,
      });
    }
    return new Deposit(walletId, amount, [
      credit({ type: 'WALLET', walletId }, amount),
      debit({ type: 'EXTERNAL_SETTLEMENT' }, amount),
    ]);
  }

  get balanceChanges(): BalanceChange[] {
    return [{ walletId: this.walletId, direction: 'CREDIT', amount: this.amount }];
  }
}
