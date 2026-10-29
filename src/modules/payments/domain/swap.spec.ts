import { Money } from '../../../shared/domain/money.js';
import { AmountTooSmallError, SameCurrencyError } from './errors.js';
import { Swap } from './swap.js';

const FX = { source: 'LIVE' as const, fetchedAt: new Date('2026-10-29T00:02:31.000Z') };

describe('Swap', () => {
  it('converts at the given rate, rounding the destination down', () => {
    const swap = Swap.create('w1', Money.positive('100', 'cXAF'), 'cGHS', {
      rate: '0.020833333333333333',
      ...FX,
    });

    expect(swap.destination.toString()).toBe('2.083333');
    expect(swap.destination.currency).toBe('cGHS');
  });

  it('moves money through the FX pool so each currency nets to zero', () => {
    const swap = Swap.create('w1', Money.positive('1000', 'cNGN'), 'USDx', {
      rate: '0.000625',
      ...FX,
    });

    expect(swap.postings).toEqual([
      { account: { type: 'WALLET', walletId: 'w1' }, currency: 'cNGN', amount: '-1000.000000' },
      { account: { type: 'FX_POOL' }, currency: 'cNGN', amount: '1000.000000' },
      { account: { type: 'FX_POOL' }, currency: 'USDx', amount: '-0.625000' },
      { account: { type: 'WALLET', walletId: 'w1' }, currency: 'USDx', amount: '0.625000' },
    ]);
  });

  it('rejects a swap to the same currency', () => {
    expect(() =>
      Swap.create('w1', Money.positive('1', 'USDx'), 'USDx', { rate: '1', ...FX }),
    ).toThrow(SameCurrencyError);
  });

  it('rejects an amount that converts to zero', () => {
    expect(() =>
      Swap.create('w1', Money.positive('0.000001', 'cNGN'), 'USDx', { rate: '0.000625', ...FX }),
    ).toThrow(AmountTooSmallError);
  });
});
