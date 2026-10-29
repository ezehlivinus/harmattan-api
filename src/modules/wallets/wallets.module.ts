import { Module } from '@nestjs/common';
import { FxModule } from '../fx/fx.module.js';
import { CreateWalletHandler } from './application/commands/create-wallet/create-wallet.handler.js';
import { WALLET_READ_MODEL } from './application/ports/wallet.read-model.js';
import { WALLET_REPOSITORY } from './application/ports/wallet.repository.js';
import { GetWalletHandler } from './application/queries/get-wallet/get-wallet.handler.js';
import { DrizzleWalletReadModel } from './infrastructure/drizzle-wallet.read-model.js';
import { DrizzleWalletRepository } from './infrastructure/drizzle-wallet.repository.js';
import { WalletsController } from './presentation/wallets.controller.js';

@Module({
  imports: [FxModule],
  controllers: [WalletsController],
  providers: [
    CreateWalletHandler,
    GetWalletHandler,
    { provide: WALLET_REPOSITORY, useClass: DrizzleWalletRepository },
    { provide: WALLET_READ_MODEL, useClass: DrizzleWalletReadModel },
  ],
})
export class WalletsModule {}
