import { sql } from 'drizzle-orm';
import { check, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { amount, timestampMs } from './columns.js';
import { currencyEnum } from './enums.js';
import { wallets } from './wallets.js';

/** Materialized balance per wallet and currency, updated in the same DB transaction as the ledger. */
export const balances = pgTable(
  'balances',
  {
    walletId: uuid()
      .notNull()
      .references(() => wallets.id),
    currency: currencyEnum().notNull(),
    amount: amount().notNull().default('0'),
    updatedAt: timestampMs().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'balances_pkey', columns: [t.walletId, t.currency] }),
    check('balances_amount_non_negative', sql`${t.amount} >= 0`),
  ],
);
