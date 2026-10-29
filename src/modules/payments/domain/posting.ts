import type { Currency } from '../../../shared/domain/currency.js';
import type { Money } from '../../../shared/domain/money.js';

/** A ledger account (ADR-008). System accounts exist once per currency, not as rows. */
export type Account =
  { type: 'WALLET'; walletId: string } | { type: 'EXTERNAL_SETTLEMENT' } | { type: 'FX_POOL' };

/** A signed ledger posting: positive credits the account, negative debits it. */
export interface Posting {
  account: Account;
  currency: Currency;
  /** Signed decimal string with 6 decimals, e.g. `"-1500.250000"`. */
  amount: string;
}

export const credit = (account: Account, money: Money): Posting => ({
  account,
  currency: money.currency,
  amount: money.toString(),
});

export const debit = (account: Account, money: Money): Posting => ({
  account,
  currency: money.currency,
  amount: `-${money.toString()}`,
});
