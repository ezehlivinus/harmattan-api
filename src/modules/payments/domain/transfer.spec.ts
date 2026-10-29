import { Money } from '../../../shared/domain/money.js';
import { AmountTooSmallError, SelfTransferError } from './errors.js';
import { Transfer } from './transfer.js';

const FX = { source: 'LIVE' as const, fetchedAt: new Date('2026-10-29T00:02:31.000Z') };

describe('Transfer', () => {
  it('moves the same currency wallet to wallet, with no FX', () => {
    const transfer = Transfer.create('a', 'b', Money.positive('25', 'USDx'), 'USDx', undefined);

    expect(transfer.destination.toString()).toBe('25.000000');
    expect(transfer.rate).toBeNull();
    expect(transfer.postings).toEqual([
      { account: { type: 'WALLET', walletId: 'a' }, currency: 'USDx', amount: '-25.000000' },
      { account: { type: 'WALLET', walletId: 'b' }, currency: 'USDx', amount: '25.000000' },
    ]);
  });

  it('converts across currencies through the FX pool, rounding down', () => {
    const transfer = Transfer.create('a', 'b', Money.positive('10', 'EURx'), 'cGHS', {
      rate: '13.888888888888888888',
      ...FX,
    });

    expect(transfer.destination.toString()).toBe('138.888888');
    expect(transfer.postings).toEqual([
      { account: { type: 'WALLET', walletId: 'a' }, currency: 'EURx', amount: '-10.000000' },
      { account: { type: 'FX_POOL' }, currency: 'EURx', amount: '10.000000' },
      { account: { type: 'FX_POOL' }, currency: 'cGHS', amount: '-138.888888' },
      { account: { type: 'WALLET', walletId: 'b' }, currency: 'cGHS', amount: '138.888888' },
    ]);
  });

  it('debits the sender and credits the receiver', () => {
    const transfer = Transfer.create('a', 'b', Money.positive('1', 'USDx'), 'USDx', undefined);

    expect(transfer.balanceChanges.map((c) => [c.walletId, c.direction])).toEqual([
      ['a', 'DEBIT'],
      ['b', 'CREDIT'],
    ]);
  });

  it('rejects a transfer to the same wallet, even across currencies', () => {
    expect(() => Transfer.create('a', 'a', Money.positive('1', 'USDx'), 'USDx', undefined)).toThrow(
      SelfTransferError,
    );
    expect(() =>
      Transfer.create('a', 'a', Money.positive('1', 'USDx'), 'EURx', { rate: '0.9', ...FX }),
    ).toThrow(SelfTransferError);
  });

  it('requires a rate exactly when the currencies differ', () => {
    expect(() => Transfer.create('a', 'b', Money.positive('1', 'USDx'), 'EURx', undefined)).toThrow(
      /rate/,
    );
  });

  it('rejects an amount that converts to zero', () => {
    expect(() =>
      Transfer.create('a', 'b', Money.positive('0.000001', 'cNGN'), 'USDx', {
        rate: '0.000625',
        ...FX,
      }),
    ).toThrow(AmountTooSmallError);
  });
});
