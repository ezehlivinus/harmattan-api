import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../../../shared/application/clock.js';
import {
  IdempotencyService,
  type IdempotentResult,
} from '../../../../../shared/application/idempotency.service.js';
import { parseCurrency } from '../../../../../shared/domain/currency.js';
import { newId } from '../../../../../shared/domain/id.js';
import { Money } from '../../../../../shared/domain/money.js';
import { Deposit } from '../../../domain/deposit.js';
import { LEDGER_REPOSITORY, type LedgerRepository } from '../../ports/ledger.repository.js';
import { DepositCommand, type DepositView } from './deposit.command.js';

@CommandHandler(DepositCommand)
export class DepositHandler implements ICommandHandler<DepositCommand> {
  constructor(
    private readonly idempotency: IdempotencyService,
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: DepositCommand): Promise<IdempotentResult<DepositView>> {
    const amount = Money.positive(command.amount, parseCurrency(command.currency));
    const deposit = Deposit.create(command.walletId, amount);

    return await this.idempotency.execute(
      {
        scope: `deposit:${command.walletId}`,
        key: command.idempotencyKey,
        // Normalized, so "100" and "100.0" are the same request.
        payload: { currency: amount.currency, amount: amount.toString() },
      },
      HttpStatus.CREATED,
      async (tx) => {
        const balance = await this.ledger.credit(deposit.walletId, deposit.amount, tx);
        const transaction = await this.ledger.record(
          {
            id: newId(),
            type: 'DEPOSIT',
            sourceWalletId: null,
            destinationWalletId: deposit.walletId,
            source: deposit.amount,
            destination: deposit.amount,
            rate: '1',
            rateSource: null,
            rateFetchedAt: null,
            createdAt: this.clock.now(),
          },
          deposit.postings,
          tx,
        );
        return { transaction, balance: { currency: balance.currency, amount: balance.toString() } };
      },
    );
  }
}
