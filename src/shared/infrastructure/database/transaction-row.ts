import type { TransactionView } from '../../application/transaction.view.js';
import type { transactions } from './schema/index.js';

/** Maps a stored `transactions` row to the API view (one mapping for writes and reads). */
export function toTransactionView(row: typeof transactions.$inferSelect): TransactionView {
  return {
    id: row.id,
    type: row.type,
    sourceWalletId: row.sourceWalletId,
    destinationWalletId: row.destinationWalletId,
    sourceAmount: row.sourceAmount,
    sourceCurrency: row.sourceCurrency,
    destinationAmount: row.destinationAmount,
    destinationCurrency: row.destinationCurrency,
    rate: row.rate,
    rateSource: row.rateSource,
    rateFetchedAt: row.rateFetchedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
