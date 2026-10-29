import { Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { TransactionContext } from '../../../shared/application/unit-of-work.js';
import { WalletNotFoundError } from '../../../shared/domain/errors.js';
import { newId } from '../../../shared/domain/id.js';
import { Money } from '../../../shared/domain/money.js';
import type { DatabaseTransaction } from '../../../shared/infrastructure/database/database.js';
import { drizzleTx } from '../../../shared/infrastructure/database/drizzle-unit-of-work.js';
import {
  balances,
  ledgerEntries,
  transactions,
} from '../../../shared/infrastructure/database/schema/index.js';
import type { LedgerRepository, NewTransaction } from '../application/ports/ledger.repository.js';
import type { TransactionView } from '../application/transaction.view.js';
import type { BalanceChange } from '../domain/balance-change.js';
import { InsufficientFundsError } from '../domain/errors.js';
import type { Posting } from '../domain/posting.js';

@Injectable()
export class DrizzleLedgerRepository implements LedgerRepository {
  async applyBalanceChanges(changes: BalanceChange[], ctx: TransactionContext): Promise<Money[]> {
    const tx = drizzleTx(ctx);
    // Lock rows in one global order so two operations never wait on each other in a cycle.
    const ordered = changes
      .map((change, index) => ({ change, index }))
      .sort(
        (a, b) =>
          compare(a.change.walletId, b.change.walletId) ||
          compare(a.change.amount.currency, b.change.amount.currency),
      );
    const results: Money[] = new Array<Money>(changes.length);
    for (const { change, index } of ordered) {
      results[index] =
        change.direction === 'CREDIT'
          ? await this.credit(tx, change.walletId, change.amount)
          : await this.debit(tx, change.walletId, change.amount);
    }
    return results;
  }

  private async credit(tx: DatabaseTransaction, walletId: string, amount: Money): Promise<Money> {
    const [row] = await tx
      .update(balances)
      .set({
        amount: sql`${balances.amount} + ${amount.toString()}::numeric`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(balances.walletId, walletId), eq(balances.currency, amount.currency)))
      .returning({ amount: balances.amount });
    if (row === undefined) {
      // Every wallet has a balance row per currency, so no row means no wallet.
      throw new WalletNotFoundError(walletId);
    }
    return Money.of(row.amount, amount.currency);
  }

  /** Conditional decrement: only succeeds if the balance covers the amount (no negative balance). */
  private async debit(tx: DatabaseTransaction, walletId: string, amount: Money): Promise<Money> {
    const value = amount.toString();
    const [row] = await tx
      .update(balances)
      .set({ amount: sql`${balances.amount} - ${value}::numeric`, updatedAt: sql`now()` })
      .where(
        and(
          eq(balances.walletId, walletId),
          eq(balances.currency, amount.currency),
          gte(balances.amount, sql`${value}::numeric`),
        ),
      )
      .returning({ amount: balances.amount });
    if (row !== undefined) {
      return Money.of(row.amount, amount.currency);
    }
    const exists = await tx
      .select({ walletId: balances.walletId })
      .from(balances)
      .where(and(eq(balances.walletId, walletId), eq(balances.currency, amount.currency)));
    throw exists.length === 0
      ? new WalletNotFoundError(walletId)
      : new InsufficientFundsError(amount.currency, value);
  }

  async record(
    transaction: NewTransaction,
    postings: Posting[],
    ctx: TransactionContext,
  ): Promise<TransactionView> {
    const tx = drizzleTx(ctx);
    const [row] = await tx
      .insert(transactions)
      .values({
        id: transaction.id,
        type: transaction.type,
        sourceWalletId: transaction.sourceWalletId,
        destinationWalletId: transaction.destinationWalletId,
        sourceAmount: transaction.source.toString(),
        sourceCurrency: transaction.source.currency,
        destinationAmount: transaction.destination.toString(),
        destinationCurrency: transaction.destination.currency,
        rate: transaction.rate,
        rateSource: transaction.rateSource,
        rateFetchedAt: transaction.rateFetchedAt,
        createdAt: transaction.createdAt,
      })
      .returning();
    if (row === undefined) {
      throw new Error('Insert into transactions returned no row');
    }
    await tx.insert(ledgerEntries).values(
      postings.map((posting) => ({
        id: newId(),
        transactionId: transaction.id,
        accountType: posting.account.type,
        walletId: posting.account.type === 'WALLET' ? posting.account.walletId : null,
        currency: posting.currency,
        amount: posting.amount,
        createdAt: transaction.createdAt,
      })),
    );
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
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
