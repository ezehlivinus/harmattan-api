import type { TransactionView } from '../../../../shared/application/transaction.view.js';
import type { Currency } from '../../../../shared/domain/currency.js';
import type { HistoryPosition } from '../cursor.js';

/** A transaction as seen from one wallet. */
export type EntryType = 'DEPOSIT' | 'SWAP' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export interface HistoryFilter {
  walletId: string;
  entryType?: EntryType;
  /** Matches the source or the destination currency. */
  currency?: Currency;
  limit: number;
  after?: HistoryPosition;
}

export interface TransactionReadModel {
  walletExists(walletId: string): Promise<boolean>;
  /** Newest first by (createdAt, id), at most `limit` rows, strictly after `after`. */
  listForWallet(filter: HistoryFilter): Promise<TransactionView[]>;
  findById(transactionId: string): Promise<TransactionView | undefined>;
}

export const TRANSACTION_READ_MODEL = Symbol('TransactionReadModel');
