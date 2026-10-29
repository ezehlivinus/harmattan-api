import type { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { newId } from '../../src/shared/domain/id.js';
import { balances, transactions } from '../../src/shared/infrastructure/database/schema/index.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDatabase, truncateAll } from '../helpers/database.js';
import { PROVIDER_FETCHED_AT, providerUp } from '../helpers/fx.js';
import { expectLedgerBalanced } from '../helpers/ledger.js';

describe('POST /v1/transfers (e2e)', () => {
  let app: INestApplication<App>;
  const db = createTestDatabase();
  let alice: string;
  let bob: string;

  const http = () => request(app.getHttpServer());
  const createWallet = async (email: string) => {
    const res = await http().post('/v1/wallets').send({ email }).expect(201);
    return (res.body as { id: string }).id;
  };
  const deposit = async (walletId: string, currency: string, amount: string) => {
    await http()
      .post(`/v1/wallets/${walletId}/deposits`)
      .set('Idempotency-Key', newId())
      .send({ currency, amount })
      .expect(201);
  };
  const transfer = (body: Record<string, unknown>, key = newId()) =>
    http().post('/v1/transfers').set('Idempotency-Key', key).send(body);
  const balance = async (
    walletId: string,
    currency: 'cNGN' | 'cGHS' | 'cXAF' | 'USDx' | 'EURx',
  ) => {
    const [row] = await db
      .select()
      .from(balances)
      .where(and(eq(balances.walletId, walletId), eq(balances.currency, currency)));
    return row?.amount;
  };

  beforeAll(async () => {
    app = await createTestApp({ fetch: providerUp });
  });

  afterAll(async () => {
    await app.close();
    await db.$client.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
    alice = await createWallet('alice@example.com');
    bob = await createWallet('bob@example.com');
  });

  afterEach(async () => {
    await expectLedgerBalanced(db);
  });

  it('moves the same currency between wallets with rate 1', async () => {
    await deposit(alice, 'USDx', '100');

    const res = await transfer({
      fromWalletId: alice,
      toWalletId: bob,
      sourceCurrency: 'USDx',
      destinationCurrency: 'USDx',
      amount: '25',
    }).expect(201);

    expect(res.body).toEqual({
      transaction: {
        id: expect.any(String) as unknown,
        type: 'TRANSFER',
        sourceWalletId: alice,
        destinationWalletId: bob,
        sourceAmount: '25.000000',
        sourceCurrency: 'USDx',
        destinationAmount: '25.000000',
        destinationCurrency: 'USDx',
        rate: '1.000000000000000000',
        rateSource: null,
        rateFetchedAt: null,
        createdAt: expect.any(String) as unknown,
      },
      senderBalance: { currency: 'USDx', amount: '75.000000' },
    });
    expect(await balance(bob, 'USDx')).toBe('25.000000');
  });

  it('converts across currencies at the current rate and records every field', async () => {
    await deposit(alice, 'EURx', '10');

    const res = await transfer({
      fromWalletId: alice,
      toWalletId: bob,
      sourceCurrency: 'EURx',
      destinationCurrency: 'cGHS',
      amount: '10',
    }).expect(201);

    expect(res.body).toMatchObject({
      transaction: {
        sourceWalletId: alice,
        destinationWalletId: bob,
        sourceAmount: '10.000000',
        sourceCurrency: 'EURx',
        destinationAmount: '138.888888',
        destinationCurrency: 'cGHS',
        rate: '13.888888888888888888',
        rateSource: 'LIVE',
        rateFetchedAt: PROVIDER_FETCHED_AT,
      },
      senderBalance: { currency: 'EURx', amount: '0.000000' },
    });
    expect(await balance(bob, 'cGHS')).toBe('138.888888');
    const [row] = await db.select().from(transactions).where(eq(transactions.type, 'TRANSFER'));
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it('rejects an overdraft with 422, changing nothing', async () => {
    await deposit(alice, 'USDx', '10');

    const res = await transfer({
      fromWalletId: alice,
      toWalletId: bob,
      sourceCurrency: 'USDx',
      destinationCurrency: 'USDx',
      amount: '10.000001',
    }).expect(422);

    expect(res.body).toMatchObject({ error: { code: 'INSUFFICIENT_FUNDS' } });
    expect(await balance(alice, 'USDx')).toBe('10.000000');
    expect(await balance(bob, 'USDx')).toBe('0.000000');
  });

  it('rejects a transfer to the same wallet', async () => {
    const res = await transfer({
      fromWalletId: alice,
      toWalletId: alice,
      sourceCurrency: 'USDx',
      destinationCurrency: 'EURx',
      amount: '1',
    }).expect(422);

    expect(res.body).toMatchObject({ error: { code: 'SELF_TRANSFER' } });
  });

  it.each(['sender', 'receiver'] as const)(
    'returns 404 for an unknown %s, even when the sender cannot cover the amount',
    async (side) => {
      const missing = newId();
      const res = await transfer({
        fromWalletId: side === 'sender' ? missing : alice,
        toWalletId: side === 'receiver' ? missing : bob,
        sourceCurrency: 'USDx',
        destinationCurrency: 'USDx',
        amount: '1',
      }).expect(404);

      expect(res.body).toEqual({
        error: {
          code: 'WALLET_NOT_FOUND',
          message: 'Wallet not found',
          details: { walletId: missing },
        },
      });
    },
  );

  it('rejects invalid input with 400', async () => {
    const res = await transfer({
      fromWalletId: 'not-a-uuid',
      toWalletId: bob,
      sourceCurrency: 'USDx',
      destinationCurrency: 'USDx',
      amount: '1',
    }).expect(400);

    expect(res.body).toHaveProperty(['error', 'details', 'issues', 0, 'path'], 'fromWalletId');
  });

  it('replays a repeated transfer without moving money twice', async () => {
    await deposit(alice, 'USDx', '100');
    const body = {
      fromWalletId: alice,
      toWalletId: bob,
      sourceCurrency: 'USDx',
      destinationCurrency: 'USDx',
      amount: '30',
    };

    const responses = await Promise.all(
      Array.from({ length: 10 }, async () => await transfer(body, 'transfer-1')),
    );

    expect(responses.map((r) => r.status)).toEqual(Array<number>(10).fill(201));
    expect(new Set(responses.map((r) => JSON.stringify(r.body))).size).toBe(1);
    expect(await balance(alice, 'USDx')).toBe('70.000000');
    expect(await balance(bob, 'USDx')).toBe('30.000000');
  });

  it('runs A→B and B→A in parallel without deadlocks, conserving the total', async () => {
    await deposit(alice, 'USDx', '100');
    await deposit(bob, 'USDx', '100');
    const send = (from: string, to: string) =>
      transfer({
        fromWalletId: from,
        toWalletId: to,
        sourceCurrency: 'USDx',
        destinationCurrency: 'USDx',
        amount: '1',
      });

    const responses = await Promise.all([
      ...Array.from({ length: 25 }, async () => await send(alice, bob)),
      ...Array.from({ length: 25 }, async () => await send(bob, alice)),
    ]);

    expect(responses.map((r) => r.status)).toEqual(Array<number>(50).fill(201));
    expect(await balance(alice, 'USDx')).toBe('100.000000');
    expect(await balance(bob, 'USDx')).toBe('100.000000');
  });
});
