import { Command } from '@nestjs/cqrs';
import type { IdempotentResult } from '../../../../../shared/application/idempotency.service.js';
import type {
  BalanceView,
  TransactionView,
} from '../../../../../shared/application/transaction.view.js';

export interface SwapView {
  transaction: TransactionView;
  /** Balances after the swap: source currency, then destination currency. */
  balances: BalanceView[];
}

export class SwapCommand extends Command<IdempotentResult<SwapView>> {
  constructor(
    readonly walletId: string,
    readonly fromCurrency: string,
    readonly toCurrency: string,
    readonly amount: string,
    readonly idempotencyKey: string,
  ) {
    super();
  }
}
