import { Module } from '@nestjs/common';
import { FxModule } from '../fx/fx.module.js';
import { DepositHandler } from './application/commands/deposit/deposit.handler.js';
import { SwapHandler } from './application/commands/swap/swap.handler.js';
import { LEDGER_REPOSITORY } from './application/ports/ledger.repository.js';
import { DrizzleLedgerRepository } from './infrastructure/drizzle-ledger.repository.js';
import { DepositsController } from './presentation/deposits.controller.js';
import { SwapsController } from './presentation/swaps.controller.js';

@Module({
  imports: [FxModule],
  controllers: [DepositsController, SwapsController],
  providers: [
    DepositHandler,
    SwapHandler,
    { provide: LEDGER_REPOSITORY, useClass: DrizzleLedgerRepository },
  ],
})
export class PaymentsModule {}
