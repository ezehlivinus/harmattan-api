import { Module } from '@nestjs/common';
import { FxModule } from '../fx/fx.module.js';
import { DepositHandler } from './application/commands/deposit/deposit.handler.js';
import { SwapHandler } from './application/commands/swap/swap.handler.js';
import { TransferHandler } from './application/commands/transfer/transfer.handler.js';
import { LEDGER_REPOSITORY } from './application/ports/ledger.repository.js';
import { DrizzleLedgerRepository } from './infrastructure/drizzle-ledger.repository.js';
import { DepositsController } from './presentation/deposits.controller.js';
import { SwapsController } from './presentation/swaps.controller.js';
import { TransfersController } from './presentation/transfers.controller.js';

@Module({
  imports: [FxModule],
  controllers: [DepositsController, SwapsController, TransfersController],
  providers: [
    DepositHandler,
    SwapHandler,
    TransferHandler,
    { provide: LEDGER_REPOSITORY, useClass: DrizzleLedgerRepository },
  ],
})
export class PaymentsModule {}
