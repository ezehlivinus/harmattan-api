import { Query } from '@nestjs/cqrs';
import type { TransactionView } from '../../../../../shared/application/transaction.view.js';
import type { Currency } from '../../../../../shared/domain/currency.js';
import type { HistoryPosition } from '../../cursor.js';
import type { EntryType } from '../../ports/transaction.read-model.js';

export interface HistoryItem extends TransactionView {
  /** What the transaction was for this wallet. */
  entryType: EntryType;
}

export interface HistoryPage {
  items: HistoryItem[];
  /** Pass as `cursor` to get the next (older) page; null on the last page. */
  nextCursor: string | null;
}

export class ListWalletTransactionsQuery extends Query<HistoryPage> {
  constructor(
    readonly walletId: string,
    readonly filter: {
      entryType?: EntryType;
      currency?: Currency;
      limit: number;
      after?: HistoryPosition;
    },
  ) {
    super();
  }
}
