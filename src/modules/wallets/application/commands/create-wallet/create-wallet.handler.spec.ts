import type { Clock } from '../../../../../shared/application/clock.js';
import type {
  TransactionContext,
  UnitOfWork,
} from '../../../../../shared/application/unit-of-work.js';
import { WalletAlreadyExistsError } from '../../../domain/errors.js';
import type { Wallet } from '../../../domain/wallet.js';
import type { WalletRepository } from '../../ports/wallet.repository.js';
import { CreateWalletCommand } from './create-wallet.command.js';
import { CreateWalletHandler } from './create-wallet.handler.js';

const NOW = new Date('2026-10-29T12:00:00.000Z');
const ctx = {} as TransactionContext;

function setup(create?: (wallet: Wallet) => Promise<void>) {
  const saved: Wallet[] = [];
  const contexts: TransactionContext[] = [];
  const uow: UnitOfWork = { run: async (work) => await work(ctx) };
  const wallets: WalletRepository = {
    create: async (wallet, tx) => {
      contexts.push(tx);
      saved.push(wallet);
      if (create !== undefined) await create(wallet);
    },
  };
  const clock: Clock = { now: () => NOW };
  return { handler: new CreateWalletHandler(uow, wallets, clock), saved, contexts };
}

describe('CreateWalletHandler', () => {
  it('saves the wallet inside the unit of work and returns it with zero balances', async () => {
    const { handler, saved, contexts } = setup();

    const view = await handler.execute(new CreateWalletCommand('Ada@Example.com', undefined));

    expect(saved).toHaveLength(1);
    expect(contexts).toEqual([ctx]);
    expect(view).toEqual({
      id: saved[0]?.id,
      email: 'ada@example.com',
      phone: null,
      createdAt: '2026-10-29T12:00:00.000Z',
      balances: [
        { currency: 'cNGN', amount: '0.000000' },
        { currency: 'cGHS', amount: '0.000000' },
        { currency: 'cXAF', amount: '0.000000' },
        { currency: 'USDx', amount: '0.000000' },
        { currency: 'EURx', amount: '0.000000' },
      ],
    });
  });

  it('propagates a duplicate from the repository', async () => {
    const duplicate = new WalletAlreadyExistsError('email');
    const { handler } = setup(async () => {
      await Promise.reject(duplicate);
    });

    await expect(handler.execute(new CreateWalletCommand('a@example.com', undefined))).rejects.toBe(
      duplicate,
    );
  });
});
