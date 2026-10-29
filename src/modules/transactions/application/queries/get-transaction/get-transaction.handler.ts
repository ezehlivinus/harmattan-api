import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { TransactionView } from '../../../../../shared/application/transaction.view.js';
import { TransactionNotFoundError } from '../../../../../shared/domain/errors.js';
import {
  TRANSACTION_READ_MODEL,
  type TransactionReadModel,
} from '../../ports/transaction.read-model.js';
import { GetTransactionQuery } from './get-transaction.query.js';

@QueryHandler(GetTransactionQuery)
export class GetTransactionHandler implements IQueryHandler<GetTransactionQuery> {
  constructor(@Inject(TRANSACTION_READ_MODEL) private readonly history: TransactionReadModel) {}

  async execute(query: GetTransactionQuery): Promise<TransactionView> {
    const transaction = await this.history.findById(query.transactionId);
    if (transaction === undefined) {
      throw new TransactionNotFoundError(query.transactionId);
    }
    return transaction;
  }
}
