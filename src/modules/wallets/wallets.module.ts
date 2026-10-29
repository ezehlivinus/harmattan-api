import { Module } from '@nestjs/common';
import { CreateWalletHandler } from './application/commands/create-wallet/create-wallet.handler.js';
import { WALLET_REPOSITORY } from './application/ports/wallet.repository.js';
import { DrizzleWalletRepository } from './infrastructure/drizzle-wallet.repository.js';
import { WalletsController } from './presentation/wallets.controller.js';

@Module({
  controllers: [WalletsController],
  providers: [
    CreateWalletHandler,
    { provide: WALLET_REPOSITORY, useClass: DrizzleWalletRepository },
  ],
})
export class WalletsModule {}
