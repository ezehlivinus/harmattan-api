import { Command } from '@nestjs/cqrs';
import type { IdempotentResult } from '../../../../../shared/application/idempotency.service.js';
import type { BalanceView, TransactionView } from '../../transaction.view.js';

export interface DepositView {
  transaction: TransactionView;
  /** The wallet's balance in the deposited currency after this deposit. */
  balance: BalanceView;
}

export class DepositCommand extends Command<IdempotentResult<DepositView>> {
  constructor(
    readonly walletId: string,
    readonly currency: string,
    readonly amount: string,
    readonly idempotencyKey: string,
  ) {
    super();
  }
}
