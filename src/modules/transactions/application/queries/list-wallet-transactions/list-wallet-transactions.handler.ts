import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { TransactionView } from '../../../../../shared/application/transaction.view.js';
import { WalletNotFoundError } from '../../../../../shared/domain/errors.js';
import { encodeCursor } from '../../cursor.js';
import {
  type EntryType,
  TRANSACTION_READ_MODEL,
  type TransactionReadModel,
} from '../../ports/transaction.read-model.js';
import { type HistoryPage, ListWalletTransactionsQuery } from './list-wallet-transactions.query.js';

@QueryHandler(ListWalletTransactionsQuery)
export class ListWalletTransactionsHandler implements IQueryHandler<ListWalletTransactionsQuery> {
  constructor(@Inject(TRANSACTION_READ_MODEL) private readonly history: TransactionReadModel) {}

  async execute(query: ListWalletTransactionsQuery): Promise<HistoryPage> {
    const { walletId, filter } = query;
    if (!(await this.history.walletExists(walletId))) {
      throw new WalletNotFoundError(walletId);
    }
    // One extra row tells whether another page exists.
    const rows = await this.history.listForWallet({ walletId, ...filter, limit: filter.limit + 1 });
    const page = rows.slice(0, filter.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({ ...row, entryType: this.entryTypeFor(row, walletId) })),
      nextCursor:
        rows.length > filter.limit && last !== undefined
          ? encodeCursor({ createdAt: new Date(last.createdAt), id: last.id })
          : null,
    };
  }

  /** What the transaction was for this wallet: a transfer is OUT for the sender, IN for the receiver. */
  private entryTypeFor(transaction: TransactionView, walletId: string): EntryType {
    if (transaction.type !== 'TRANSFER') return transaction.type;
    return transaction.sourceWalletId === walletId ? 'TRANSFER_OUT' : 'TRANSFER_IN';
  }
}
