import { Module } from '@nestjs/common';
import { DepositHandler } from './application/commands/deposit/deposit.handler.js';
import { LEDGER_REPOSITORY } from './application/ports/ledger.repository.js';
import { DrizzleLedgerRepository } from './infrastructure/drizzle-ledger.repository.js';
import { DepositsController } from './presentation/deposits.controller.js';

@Module({
  controllers: [DepositsController],
  providers: [DepositHandler, { provide: LEDGER_REPOSITORY, useClass: DrizzleLedgerRepository }],
})
export class PaymentsModule {}
