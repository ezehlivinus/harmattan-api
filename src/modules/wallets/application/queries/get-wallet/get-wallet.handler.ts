import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WalletNotFoundError } from '../../../../../shared/domain/errors.js';
import { Money } from '../../../../../shared/domain/money.js';
import { FX_RATES, type FxRatesPort } from '../../../../fx/application/fx-rates.port.js';
import { WALLET_READ_MODEL, type WalletReadModel } from '../../ports/wallet.read-model.js';
import { GetWalletQuery, type WalletDetailsView } from './get-wallet.query.js';

@QueryHandler(GetWalletQuery)
export class GetWalletHandler implements IQueryHandler<GetWalletQuery> {
  constructor(
    @Inject(WALLET_READ_MODEL) private readonly wallets: WalletReadModel,
    @Inject(FX_RATES) private readonly fx: FxRatesPort,
  ) {}

  async execute(query: GetWalletQuery): Promise<WalletDetailsView> {
    const wallet = await this.wallets.findById(query.walletId);
    if (wallet === undefined) {
      throw new WalletNotFoundError(query.walletId);
    }
    const rates = await this.fx.current();
    const balances = wallet.balances.map((balance) => ({
      ...balance,
      usdValue: rates.valueInUsd(Money.of(balance.amount, balance.currency)),
    }));
    const totalUsd = balances.reduce((sum, b) => sum.add(b.usdValue), Money.zero('USDx'));

    return {
      id: wallet.id,
      email: wallet.email,
      phone: wallet.phone,
      createdAt: wallet.createdAt.toISOString(),
      balances: balances.map((b) => ({ ...b, usdValue: b.usdValue.toString() })),
      totalUsd: totalUsd.toString(),
      ratesAsOf: rates.fetchedAt.toISOString(),
      ratesSource: rates.source,
    };
  }
}
