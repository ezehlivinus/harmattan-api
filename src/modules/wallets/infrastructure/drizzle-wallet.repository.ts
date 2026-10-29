import { Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../shared/application/unit-of-work.js';
import { drizzleTx } from '../../../shared/infrastructure/database/drizzle-unit-of-work.js';
import { PgErrorCode, pgErrorOf } from '../../../shared/infrastructure/database/pg-error.js';
import { balances, wallets } from '../../../shared/infrastructure/database/schema/index.js';
import { WalletAlreadyExistsError } from '../domain/errors.js';
import type { Wallet } from '../domain/wallet.js';
import type { WalletRepository } from '../application/ports/wallet.repository.js';

const UNIQUE_FIELD_BY_CONSTRAINT: Record<string, 'email' | 'phone'> = {
  wallets_email_unique: 'email',
  wallets_phone_unique: 'phone',
};

@Injectable()
export class DrizzleWalletRepository implements WalletRepository {
  async create(wallet: Wallet, ctx: TransactionContext): Promise<void> {
    const tx = drizzleTx(ctx);
    try {
      await tx.insert(wallets).values({
        id: wallet.id,
        email: wallet.email?.value ?? null,
        phone: wallet.phone?.value ?? null,
        createdAt: wallet.createdAt,
      });
    } catch (error) {
      const pg = pgErrorOf(error);
      const field =
        pg?.constraint === undefined ? undefined : UNIQUE_FIELD_BY_CONSTRAINT[pg.constraint];
      if (pg?.code === PgErrorCode.UNIQUE_VIOLATION && field !== undefined) {
        throw new WalletAlreadyExistsError(field);
      }
      throw error;
    }
    await tx.insert(balances).values(
      wallet.openingBalances().map((money) => ({
        walletId: wallet.id,
        currency: money.currency,
        amount: money.toString(),
        updatedAt: wallet.createdAt,
      })),
    );
  }
}
