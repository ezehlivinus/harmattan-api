import { WalletNotFoundError } from '../../../../../shared/domain/errors.js';
import type { FxRatesPort } from '../../../../fx/application/fx-rates.port.js';
import { RateTable } from '../../../../fx/domain/rate-table.js';
import type { WalletReadModel, WalletRecord } from '../../ports/wallet.read-model.js';
import { GetWalletHandler } from './get-wallet.handler.js';
import { GetWalletQuery } from './get-wallet.query.js';

const RATES_AT = new Date('2026-10-29T00:02:31.000Z');
const table = RateTable.create(
  { USDx: '1', cNGN: '1600', cGHS: '12.5', cXAF: '600', EURx: '0.9' },
  'CACHED',
  RATES_AT,
);
const record: WalletRecord = {
  id: 'w1',
  email: 'ada@example.com',
  phone: null,
  createdAt: new Date('2026-10-29T12:00:00.000Z'),
  balances: [
    { currency: 'cNGN', amount: '1600.000000' },
    { currency: 'cGHS', amount: '0.000000' },
    { currency: 'cXAF', amount: '1000.000000' },
    { currency: 'USDx', amount: '1.500000' },
    { currency: 'EURx', amount: '9.000000' },
  ],
};

const handler = (found: WalletRecord | undefined) => {
  const readModel: WalletReadModel = { findById: async () => await Promise.resolve(found) };
  const fx: FxRatesPort = { current: async () => await Promise.resolve(table) };
  return new GetWalletHandler(readModel, fx);
};

describe('GetWalletHandler', () => {
  it('returns every balance with its USD value, the total and the rates used', async () => {
    const view = await handler(record).execute(new GetWalletQuery('w1'));

    expect(view).toEqual({
      id: 'w1',
      email: 'ada@example.com',
      phone: null,
      createdAt: '2026-10-29T12:00:00.000Z',
      balances: [
        { currency: 'cNGN', amount: '1600.000000', usdValue: '1.000000' },
        { currency: 'cGHS', amount: '0.000000', usdValue: '0.000000' },
        { currency: 'cXAF', amount: '1000.000000', usdValue: '1.666666' },
        { currency: 'USDx', amount: '1.500000', usdValue: '1.500000' },
        { currency: 'EURx', amount: '9.000000', usdValue: '10.000000' },
      ],
      totalUsd: '14.166666',
      ratesAsOf: '2026-10-29T00:02:31.000Z',
      ratesSource: 'CACHED',
    });
  });

  it('throws WalletNotFoundError for an unknown id', async () => {
    await expect(handler(undefined).execute(new GetWalletQuery('nope'))).rejects.toBeInstanceOf(
      WalletNotFoundError,
    );
  });
});
