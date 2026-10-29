import type { Money } from '../../../shared/domain/money.js';

/**
 * One wallet balance to move. Debits are conditional (never below zero); all changes of one
 * operation are applied in (walletId, currency) order so concurrent operations cannot deadlock.
 */
export interface BalanceChange {
  walletId: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: Money;
}
