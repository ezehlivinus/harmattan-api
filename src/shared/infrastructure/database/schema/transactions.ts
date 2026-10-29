import { sql } from 'drizzle-orm';
import { check, index, pgTable, uuid } from 'drizzle-orm/pg-core';
import { amount, rate, timestampMs } from './columns.js';
import { currencyEnum, rateSourceEnum, transactionTypeEnum } from './enums.js';
import { wallets } from './wallets.js';

/**
 * One row per money movement. `source_*` is what left the sender, `destination_*` what arrived.
 * DEPOSIT: no source wallet, same currency and amount. SWAP: one wallet, two currencies.
 * TRANSFER: two different wallets.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid().primaryKey(),
    type: transactionTypeEnum().notNull(),
    sourceWalletId: uuid().references(() => wallets.id),
    destinationWalletId: uuid()
      .notNull()
      .references(() => wallets.id),
    sourceAmount: amount().notNull(),
    sourceCurrency: currencyEnum().notNull(),
    destinationAmount: amount().notNull(),
    destinationCurrency: currencyEnum().notNull(),
    /** Units of destination per unit of source; exactly 1 when the currencies match. */
    rate: rate().notNull(),
    /** Set exactly when the currencies differ. */
    rateSource: rateSourceEnum(),
    rateFetchedAt: timestampMs(),
    createdAt: timestampMs().notNull().defaultNow(),
  },
  (t) => [
    check('transactions_source_amount_positive', sql`${t.sourceAmount} > 0`),
    check('transactions_destination_amount_positive', sql`${t.destinationAmount} > 0`),
    check('transactions_rate_positive', sql`${t.rate} > 0`),
    // A CHECK passes when it evaluates to NULL, so every branch tests NULLs explicitly.
    check(
      'transactions_shape_check',
      sql`(${t.type} = 'DEPOSIT' AND ${t.sourceWalletId} IS NULL
            AND ${t.sourceCurrency} = ${t.destinationCurrency}
            AND ${t.sourceAmount} = ${t.destinationAmount})
       OR (${t.type} = 'SWAP' AND ${t.sourceWalletId} IS NOT NULL
            AND ${t.sourceWalletId} = ${t.destinationWalletId}
            AND ${t.sourceCurrency} <> ${t.destinationCurrency})
       OR (${t.type} = 'TRANSFER' AND ${t.sourceWalletId} IS NOT NULL
            AND ${t.sourceWalletId} <> ${t.destinationWalletId})`,
    ),
    check(
      'transactions_rate_check',
      sql`(${t.sourceCurrency} = ${t.destinationCurrency} AND ${t.rate} = 1
            AND ${t.rateSource} IS NULL AND ${t.rateFetchedAt} IS NULL)
       OR (${t.sourceCurrency} <> ${t.destinationCurrency}
            AND ${t.rateSource} IS NOT NULL AND ${t.rateFetchedAt} IS NOT NULL)`,
    ),
    // Wallet history, newest first, keyset pagination on (created_at, id). NULLS FIRST matches a
    // plain `ORDER BY ... DESC`, so the planner can use the index for sorting.
    index('transactions_source_wallet_history_idx').on(
      t.sourceWalletId,
      t.createdAt.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
    index('transactions_destination_wallet_history_idx').on(
      t.destinationWalletId,
      t.createdAt.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
  ],
);
