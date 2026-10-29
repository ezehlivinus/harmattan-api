import { Query } from '@nestjs/cqrs';
import type { TransactionView } from '../../../../../shared/application/transaction.view.js';

export class GetTransactionQuery extends Query<TransactionView> {
  constructor(readonly transactionId: string) {
    super();
  }
}
