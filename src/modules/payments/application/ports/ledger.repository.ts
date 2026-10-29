import type { TransactionContext } from '../../../../shared/application/unit-of-work.js';
import type { Money } from '../../../../shared/domain/money.js';
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
  /** Adds `amount` to the wallet's balance atomically; returns the new balance. Throws `WalletNotFoundError`. */
  credit(walletId: string, amount: Money, tx: TransactionContext): Promise<Money>;
  /** Stores the transaction row and its postings (which must sum to zero per currency). */
  record(
    transaction: NewTransaction,
    postings: Posting[],
    tx: TransactionContext,
  ): Promise<TransactionView>;
}

export const LEDGER_REPOSITORY = Symbol('LedgerRepository');
