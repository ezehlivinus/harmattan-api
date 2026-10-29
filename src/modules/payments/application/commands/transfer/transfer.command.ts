import { Command } from '@nestjs/cqrs';
import type { IdempotentResult } from '../../../../../shared/application/idempotency.service.js';
import type {
  BalanceView,
  TransactionView,
} from '../../../../../shared/application/transaction.view.js';

export interface TransferView {
  transaction: TransactionView;
  /** The sender's balance in the source currency after the transfer (never the receiver's). */
  senderBalance: BalanceView;
}

export class TransferCommand extends Command<IdempotentResult<TransferView>> {
  constructor(
    readonly fromWalletId: string,
    readonly toWalletId: string,
    readonly sourceCurrency: string,
    readonly destinationCurrency: string,
    readonly amount: string,
    readonly idempotencyKey: string,
  ) {
    super();
  }
}
