import { sql } from 'drizzle-orm';
import { check, index, pgTable, uuid } from 'drizzle-orm/pg-core';
import { amount, timestampMs } from './columns.js';
import { accountTypeEnum, currencyEnum } from './enums.js';
import { transactions } from './transactions.js';
import { wallets } from './wallets.js';

/**
 * Double-entry postings (ADR-008): signed amounts, positive = credit. For every transaction the
 * postings sum to zero per currency. System accounts may go negative; wallets never do (their
 * balance rows enforce it).
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid().primaryKey(),
    transactionId: uuid()
      .notNull()
      .references(() => transactions.id),
    accountType: accountTypeEnum().notNull(),
    walletId: uuid().references(() => wallets.id),
    currency: currencyEnum().notNull(),
    amount: amount().notNull(),
    createdAt: timestampMs().notNull().defaultNow(),
  },
  (t) => [
    check('ledger_entries_amount_non_zero', sql`${t.amount} <> 0`),
    check(
      'ledger_entries_account_check',
      sql`(${t.accountType} = 'WALLET') = (${t.walletId} IS NOT NULL)`,
    ),
    index('ledger_entries_transaction_idx').on(t.transactionId),
    index('ledger_entries_wallet_currency_idx').on(t.walletId, t.currency),
  ],
);
