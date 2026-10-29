import { Money } from '../../../shared/domain/money.js';
import { AmountLimitExceededError } from './errors.js';
import { Deposit } from './deposit.js';

describe('Deposit', () => {
  it('credits the wallet and debits external settlement by the same amount', () => {
    const deposit = Deposit.create('w1', Money.positive('1500.25', 'cNGN'));

    expect(deposit.postings).toEqual([
      { account: { type: 'WALLET', walletId: 'w1' }, amount: '1500.250000', currency: 'cNGN' },
      { account: { type: 'EXTERNAL_SETTLEMENT' }, amount: '-1500.250000', currency: 'cNGN' },
    ]);
  });

  it('accepts exactly the per-request limit', () => {
    expect(() => Deposit.create('w1', Money.positive('1000000000000', 'USDx'))).not.toThrow();
  });

  it('rejects more than 1,000,000,000,000 per request', () => {
    expect(() => Deposit.create('w1', Money.positive('1000000000000.000001', 'USDx'))).toThrow(
      AmountLimitExceededError,
    );
  });
});
