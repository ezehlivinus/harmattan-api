import { and, eq, sql } from 'drizzle-orm';
import { newId } from '../../src/shared/domain/id.js';
import {
  DrizzleUnitOfWork,
  drizzleTx,
} from '../../src/shared/infrastructure/database/drizzle-unit-of-work.js';
import { balances, wallets } from '../../src/shared/infrastructure/database/schema/index.js';
import { createTestDatabase, truncateAll } from '../helpers/database.js';

describe('DrizzleUnitOfWork on Postgres (e2e)', () => {
  const db = createTestDatabase();
  const uow = new DrizzleUnitOfWork(db);

  afterAll(async () => {
    await db.$client.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  const createWallet = async () => {
    const id = newId();
    await db.insert(wallets).values({ id, email: `${id}@example.com` });
    await db.insert(balances).values({ walletId: id, currency: 'USDx', amount: '100' });
    return id;
  };

  const balanceOf = async (walletId: string) => {
    const [row] = await db.select().from(balances).where(eq(balances.walletId, walletId));
    return row?.amount;
  };

  it('commits every write when the work resolves', async () => {
    const id = newId();

    await uow.run(async (ctx) => {
      await drizzleTx(ctx)
        .insert(wallets)
        .values({ id, email: `${id}@example.com` });
      await drizzleTx(ctx).insert(balances).values({ walletId: id, currency: 'USDx', amount: '5' });
    });

    expect(await balanceOf(id)).toBe('5.000000');
  });

  it('rolls back every write when the work throws', async () => {
    const id = newId();

    await expect(
      uow.run(async (ctx) => {
        await drizzleTx(ctx)
          .insert(wallets)
          .values({ id, email: `${id}@example.com` });
        throw new Error('business rule failed');
      }),
    ).rejects.toThrow('business rule failed');

    expect(await db.$count(wallets)).toBe(0);
  });

  it('survives a real deadlock: the victim is retried and both transfers commit', async () => {
    const a = await createWallet();
    const b = await createWallet();
    const attempts = { total: 0 };

    // Each transaction locks its first row, waits until the other has locked its own, then
    // updates the other's row: a classic lock-order deadlock. Postgres aborts one with 40P01.
    let lockedFirst = 0;
    const bothLocked = new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (lockedFirst >= 2) {
          clearInterval(check);
          resolve();
        }
      }, 5);
    });

    const move = async (from: string, to: string): Promise<void> => {
      await uow.run(async (ctx) => {
        attempts.total += 1;
        const tx = drizzleTx(ctx);
        const debit = (walletId: string) =>
          and(eq(balances.walletId, walletId), eq(balances.currency, 'USDx'));
        await tx
          .update(balances)
          .set({ amount: sql`${balances.amount} - 10` })
          .where(debit(from));
        if (attempts.total <= 2) {
          lockedFirst += 1;
          await bothLocked;
        }
        await tx
          .update(balances)
          .set({ amount: sql`${balances.amount} + 10` })
          .where(debit(to));
      });
    };

    await Promise.all([move(a, b), move(b, a)]);

    expect(attempts.total).toBe(3); // two first attempts, one retry of the deadlock victim
    expect(await balanceOf(a)).toBe('100.000000');
    expect(await balanceOf(b)).toBe('100.000000');
  });
});
