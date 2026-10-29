import { sql } from 'drizzle-orm';
import type { Database } from '../../src/shared/infrastructure/database/database.js';

/**
 * Double-entry invariants (ADR-008), checked after every money e2e:
 * 1. every wallet balance equals the sum of its ledger postings, per currency;
 * 2. every transaction's postings sum to zero, per currency.
 */
export async function expectLedgerBalanced(db: Database): Promise<void> {
  const walletMismatches = await db.execute(sql`
    SELECT b.wallet_id, b.currency, b.amount, COALESCE(SUM(l.amount), 0) AS ledger
    FROM balances b
    LEFT JOIN ledger_entries l
      ON l.account_type = 'WALLET' AND l.wallet_id = b.wallet_id AND l.currency = b.currency
    GROUP BY b.wallet_id, b.currency, b.amount
    HAVING b.amount <> COALESCE(SUM(l.amount), 0)`);
  const unbalancedTransactions = await db.execute(sql`
    SELECT transaction_id, currency, SUM(amount) AS total
    FROM ledger_entries
    GROUP BY transaction_id, currency
    HAVING SUM(amount) <> 0`);

  expect(walletMismatches.rows).toEqual([]);
  expect(unbalancedTransactions.rows).toEqual([]);
}
