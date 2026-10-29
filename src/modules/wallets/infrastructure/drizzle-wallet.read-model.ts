import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import { CURRENCIES } from '../../../shared/domain/currency.js';
import type { Database } from '../../../shared/infrastructure/database/database.js';
import { balances, wallets } from '../../../shared/infrastructure/database/schema/index.js';
import type { WalletReadModel, WalletRecord } from '../application/ports/wallet.read-model.js';

@Injectable()
export class DrizzleWalletReadModel implements WalletReadModel {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async findById(walletId: string): Promise<WalletRecord | undefined> {
    const [wallet] = await this.db.select().from(wallets).where(eq(wallets.id, walletId));
    if (wallet === undefined) {
      return undefined;
    }
    const rows = await this.db.select().from(balances).where(eq(balances.walletId, walletId));
    return {
      id: wallet.id,
      email: wallet.email,
      phone: wallet.phone,
      createdAt: wallet.createdAt,
      balances: rows
        .sort((a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency))
        .map((row) => ({ currency: row.currency, amount: row.amount })),
    };
  }
}
