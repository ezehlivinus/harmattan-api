import { Module } from '@nestjs/common';
import { TRANSACTION_READ_MODEL } from './application/ports/transaction.read-model.js';
import { GetTransactionHandler } from './application/queries/get-transaction/get-transaction.handler.js';
import { ListWalletTransactionsHandler } from './application/queries/list-wallet-transactions/list-wallet-transactions.handler.js';
import { DrizzleTransactionReadModel } from './infrastructure/drizzle-transaction.read-model.js';
import { TransactionsController } from './presentation/transactions.controller.js';

@Module({
  controllers: [TransactionsController],
  providers: [
    ListWalletTransactionsHandler,
    GetTransactionHandler,
    { provide: TRANSACTION_READ_MODEL, useClass: DrizzleTransactionReadModel },
  ],
})
export class TransactionsModule {}
