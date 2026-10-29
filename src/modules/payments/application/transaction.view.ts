import type { Currency } from '../../../shared/domain/currency.js';

/** A money movement as returned by the API (also used by history in Phase 5). */
export interface TransactionView {
  id: string;
  type: 'DEPOSIT' | 'SWAP' | 'TRANSFER';
  sourceWalletId: string | null;
  destinationWalletId: string;
  sourceAmount: string;
  sourceCurrency: Currency;
  destinationAmount: string;
  destinationCurrency: Currency;
  /** Units of destination per unit of source, 18 decimals. */
  rate: string;
  rateSource: 'LIVE' | 'CACHED' | 'FALLBACK' | null;
  rateFetchedAt: string | null;
  createdAt: string;
}

export interface BalanceView {
  currency: Currency;
  amount: string;
}
