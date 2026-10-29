import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { type SQL, and, desc, eq, or, sql } from 'drizzle-orm';
import type { TransactionView } from '../../../shared/application/transaction.view.js';
import type { Database } from '../../../shared/infrastructure/database/database.js';
import { transactions, wallets } from '../../../shared/infrastructure/database/schema/index.js';
import { toTransactionView } from '../../../shared/infrastructure/database/transaction-row.js';
import type {
  EntryType,
  HistoryFilter,
  TransactionReadModel,
} from '../application/ports/transaction.read-model.js';

const t = transactions;

@Injectable()
export class DrizzleTransactionReadModel implements TransactionReadModel {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async walletExists(walletId: string): Promise<boolean> {
    return (await this.db.$count(wallets, eq(wallets.id, walletId))) > 0;
  }

  async listForWallet(filter: HistoryFilter): Promise<TransactionView[]> {
    const { walletId } = filter;
    const conditions: (SQL | undefined)[] = [
      or(eq(t.sourceWalletId, walletId), eq(t.destinationWalletId, walletId)),
      filter.entryType === undefined
        ? undefined
        : this.entryTypeCondition(filter.entryType, walletId),
      filter.currency === undefined
        ? undefined
        : or(eq(t.sourceCurrency, filter.currency), eq(t.destinationCurrency, filter.currency)),
      // Keyset: strictly older than the cursor row in (created_at, id) order.
      filter.after === undefined
        ? undefined
        : sql`(${t.createdAt}, ${t.id}) < (${filter.after.createdAt.toISOString()}::timestamptz, ${filter.after.id}::uuid)`,
    ];
    const rows = await this.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(desc(t.createdAt), desc(t.id))
      .limit(filter.limit);
    return rows.map(toTransactionView);
  }

  async findById(transactionId: string): Promise<TransactionView | undefined> {
    const [row] = await this.db.select().from(t).where(eq(t.id, transactionId));
    return row === undefined ? undefined : toTransactionView(row);
  }

  private entryTypeCondition(entryType: EntryType, walletId: string): SQL | undefined {
    switch (entryType) {
      case 'DEPOSIT':
        return eq(t.type, 'DEPOSIT');
      case 'SWAP':
        return eq(t.type, 'SWAP');
      case 'TRANSFER_OUT':
        return and(eq(t.type, 'TRANSFER'), eq(t.sourceWalletId, walletId));
      case 'TRANSFER_IN':
        return and(eq(t.type, 'TRANSFER'), eq(t.destinationWalletId, walletId));
    }
  }
}
