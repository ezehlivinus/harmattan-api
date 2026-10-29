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
import { FX_RATES, type FxRatesPort } from '../../../../fx/application/fx-rates.port.js';
import { Swap } from '../../../domain/swap.js';
import { LEDGER_REPOSITORY, type LedgerRepository } from '../../ports/ledger.repository.js';
import { SwapCommand, type SwapView } from './swap.command.js';

@CommandHandler(SwapCommand)
export class SwapHandler implements ICommandHandler<SwapCommand> {
  constructor(
    private readonly idempotency: IdempotencyService,
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepository,
    @Inject(FX_RATES) private readonly fx: FxRatesPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: SwapCommand): Promise<IdempotentResult<SwapView>> {
    const source = Money.positive(command.amount, parseCurrency(command.fromCurrency));
    const to = parseCurrency(command.toCurrency);
    // Rates are fetched before the DB transaction, so no connection waits on the network.
    const rates = await this.fx.current();
    const swap = Swap.create(command.walletId, source, to, {
      rate: rates.rate(source.currency, to),
      source: rates.source,
      fetchedAt: rates.fetchedAt,
    });

    return await this.idempotency.execute(
      {
        scope: `swap:${command.walletId}`,
        key: command.idempotencyKey,
        payload: { fromCurrency: source.currency, toCurrency: to, amount: source.toString() },
      },
      HttpStatus.CREATED,
      async (tx) => {
        const after = await this.ledger.applyBalanceChanges(swap.balanceChanges, tx);
        const transaction = await this.ledger.record(
          {
            id: newId(),
            type: 'SWAP',
            sourceWalletId: swap.walletId,
            destinationWalletId: swap.walletId,
            source: swap.source,
            destination: swap.destination,
            rate: swap.rate.rate,
            rateSource: swap.rate.source,
            rateFetchedAt: swap.rate.fetchedAt,
            createdAt: this.clock.now(),
          },
          swap.postings,
          tx,
        );
        return {
          transaction,
          balances: after.map((money) => ({ currency: money.currency, amount: money.toString() })),
        };
      },
    );
  }
}
