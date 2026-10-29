import { Query } from '@nestjs/cqrs';
import type { Currency } from '../../../../../shared/domain/currency.js';
import type { RateSource } from '../../../../fx/domain/rate-table.js';

export interface WalletDetailsView {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  balances: { currency: Currency; amount: string; usdValue: string }[];
  /** Sum of the balances' `usdValue`. */
  totalUsd: string;
  /** When the provider last refreshed the rates used for `usdValue`. */
  ratesAsOf: string;
  ratesSource: RateSource;
}

export class GetWalletQuery extends Query<WalletDetailsView> {
  constructor(readonly walletId: string) {
    super();
  }
}
