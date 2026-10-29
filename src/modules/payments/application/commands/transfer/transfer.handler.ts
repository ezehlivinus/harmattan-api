import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../../../shared/application/clock.js';
import {
  IdempotencyService,
  type IdempotentResult,
} from '../../../../../shared/application/idempotency.service.js';
import { parseCurrency } from '../../../../../shared/domain/currency.js';
import { WalletNotFoundError } from '../../../../../shared/domain/errors.js';
import { newId } from '../../../../../shared/domain/id.js';
import { Money } from '../../../../../shared/domain/money.js';
import { FX_RATES, type FxRatesPort } from '../../../../fx/application/fx-rates.port.js';
import type { AppliedRate } from '../../../domain/applied-rate.js';
import { SelfTransferError } from '../../../domain/errors.js';
import { Transfer } from '../../../domain/transfer.js';
import { LEDGER_REPOSITORY, type LedgerRepository } from '../../ports/ledger.repository.js';
import { TransferCommand, type TransferView } from './transfer.command.js';

@CommandHandler(TransferCommand)
export class TransferHandler implements ICommandHandler<TransferCommand> {
  constructor(
    private readonly idempotency: IdempotencyService,
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepository,
    @Inject(FX_RATES) private readonly fx: FxRatesPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: TransferCommand): Promise<IdempotentResult<TransferView>> {
    const { fromWalletId, toWalletId } = command;
    if (fromWalletId === toWalletId) {
      throw new SelfTransferError(fromWalletId);
    }
    const source = Money.positive(command.amount, parseCurrency(command.sourceCurrency));
    const to = parseCurrency(command.destinationCurrency);
    // Rates (only needed across currencies) are read before the DB transaction opens.
    const rate = source.currency === to ? undefined : await this.appliedRate(source, to);
    const transfer = Transfer.create(fromWalletId, toWalletId, source, to, rate);

    return await this.idempotency.execute(
      {
        scope: `transfer:${fromWalletId}`,
        key: command.idempotencyKey,
        payload: {
          toWalletId,
          sourceCurrency: source.currency,
          destinationCurrency: to,
          amount: source.toString(),
        },
      },
      HttpStatus.CREATED,
      async (tx) => {
        // Unknown wallets are reported before funds, whichever wallet sorts first in lock order.
        const missing = await this.ledger.findMissingWallet([fromWalletId, toWalletId], tx);
        if (missing !== undefined) {
          throw new WalletNotFoundError(missing);
        }
        const [senderBalance] = await this.ledger.applyBalanceChanges(transfer.balanceChanges, tx);
        if (senderBalance === undefined) throw new Error('No sender balance returned');
        const transaction = await this.ledger.record(
          {
            id: newId(),
            type: 'TRANSFER',
            sourceWalletId: fromWalletId,
            destinationWalletId: toWalletId,
            source: transfer.source,
            destination: transfer.destination,
            rate: transfer.rate?.rate ?? '1',
            rateSource: transfer.rate?.source ?? null,
            rateFetchedAt: transfer.rate?.fetchedAt ?? null,
            createdAt: this.clock.now(),
          },
          transfer.postings,
          tx,
        );
        return {
          transaction,
          senderBalance: { currency: senderBalance.currency, amount: senderBalance.toString() },
        };
      },
    );
  }

  private async appliedRate(source: Money, to: Money['currency']): Promise<AppliedRate> {
    const rates = await this.fx.current();
    return {
      rate: rates.rate(source.currency, to),
      source: rates.source,
      fetchedAt: rates.fetchedAt,
    };
  }
}
