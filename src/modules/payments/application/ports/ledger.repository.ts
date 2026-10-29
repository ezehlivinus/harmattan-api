import type { TransactionContext } from '../../../../shared/application/unit-of-work.js';
import type { Money } from '../../../../shared/domain/money.js';
import type { BalanceChange } from '../../domain/balance-change.js';
import type { Posting } from '../../domain/posting.js';
import type { TransactionView } from '../transaction.view.js';

export interface NewTransaction {
  id: string;
  type: TransactionView['type'];
  sourceWalletId: string | null;
  destinationWalletId: string;
  source: Money;
  destination: Money;
  rate: string;
  rateSource: TransactionView['rateSource'];
  rateFetchedAt: Date | null;
  createdAt: Date;
}

export interface LedgerRepository {
  /**
   * Applies all changes atomically, in (walletId, currency) order; returns the new balances in
   * the order given. A debit never takes a balance below zero: throws `InsufficientFundsError`
   * (or `WalletNotFoundError` when the wallet does not exist).
   */
  applyBalanceChanges(changes: BalanceChange[], tx: TransactionContext): Promise<Money[]>;
  /** Stores the transaction row and its postings (which must sum to zero per currency). */
  record(
    transaction: NewTransaction,
    postings: Posting[],
    tx: TransactionContext,
  ): Promise<TransactionView>;
}

export const LEDGER_REPOSITORY = Symbol('LedgerRepository');
