import { sql } from 'drizzle-orm';
import { newId } from '../../src/shared/domain/id.js';
import {
  balances,
  fxRates,
  idempotencyKeys,
  ledgerEntries,
  transactions,
  wallets,
} from '../../src/shared/infrastructure/database/schema/index.js';
import { createTestDatabase, expectDbRejection, truncateAll } from '../helpers/database.js';

// The database is the last line of defence for money invariants (ADR-007, ADR-008):
// each test proves Postgres itself rejects a row that application code must never write.
const CHECK = '23514';
const UNIQUE = '23505';
const FOREIGN_KEY = '23503';
const NOT_NULL = '23502';

describe('database schema constraints (e2e)', () => {
  const db = createTestDatabase();

  afterAll(async () => {
    await db.$client.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  const createWallet = async (contact: { email?: string; phone?: string } = {}) => {
    const id = newId();
    await db
      .insert(wallets)
      .values({ id, email: contact.email ?? `${id}@example.com`, ...contact });
    return id;
  };

  const deposit = (
    walletId: string,
    overrides: Partial<typeof transactions.$inferInsert> = {},
  ) => ({
    id: newId(),
    type: 'DEPOSIT' as const,
    sourceWalletId: null,
    destinationWalletId: walletId,
    sourceAmount: '100.000000',
    sourceCurrency: 'USDx' as const,
    destinationAmount: '100.000000',
    destinationCurrency: 'USDx' as const,
    rate: '1',
    ...overrides,
  });

  describe('wallets', () => {
    it('requires an email or a phone', async () => {
      const err = await expectDbRejection(
        async () => await db.insert(wallets).values({ id: newId(), email: null, phone: null }),
      );
      expect(err).toMatchObject({ code: CHECK, constraint: 'wallets_contact_check' });
    });

    it('rejects a duplicate email', async () => {
      await createWallet({ email: 'ada@example.com' });
      const err = await expectDbRejection(
        async () => await createWallet({ email: 'ada@example.com' }),
      );
      expect(err).toMatchObject({ code: UNIQUE, constraint: 'wallets_email_unique' });
    });

    it('rejects a duplicate phone', async () => {
      await createWallet({ phone: '+2348012345678' });
      const err = await expectDbRejection(
        async () => await createWallet({ email: 'other@example.com', phone: '+2348012345678' }),
      );
      expect(err).toMatchObject({ code: UNIQUE, constraint: 'wallets_phone_unique' });
    });

    it.each(['Ada@Example.com', ' ada@example.com', 'ada@example.com '])(
      'rejects a non-normalized email %j',
      async (email) => {
        const err = await expectDbRejection(async () => await createWallet({ email }));
        expect(err).toMatchObject({ code: CHECK, constraint: 'wallets_email_normalized' });
      },
    );

    it.each(['08012345678', '+0123456789', '+234 801 234 5678', '+12345', '+1234567890123456'])(
      'rejects a non-E.164 phone %j',
      async (phone) => {
        const err = await expectDbRejection(async () => await createWallet({ phone }));
        expect(err).toMatchObject({ code: CHECK, constraint: 'wallets_phone_e164' });
      },
    );

    it('allows many wallets without a phone (NULLs are not duplicates)', async () => {
      await createWallet({ email: 'a@example.com' });
      await expect(createWallet({ email: 'b@example.com' })).resolves.toBeTypeOf('string');
    });
  });

  describe('balances', () => {
    it('stores amounts as exact numeric(38,6) strings', async () => {
      const walletId = await createWallet();
      await db.insert(balances).values({ walletId, currency: 'cNGN', amount: '1500.25' });

      const [row] = await db.select().from(balances);
      expect(row?.amount).toBe('1500.250000');
    });

    it('never goes negative', async () => {
      const walletId = await createWallet();
      const err = await expectDbRejection(
        async () =>
          await db.insert(balances).values({ walletId, currency: 'cNGN', amount: '-0.000001' }),
      );
      expect(err).toMatchObject({ code: CHECK, constraint: 'balances_amount_non_negative' });
    });

    it('has one row per wallet and currency', async () => {
      const walletId = await createWallet();
      await db.insert(balances).values({ walletId, currency: 'cNGN', amount: '0' });
      const err = await expectDbRejection(
        async () => await db.insert(balances).values({ walletId, currency: 'cNGN', amount: '0' }),
      );
      expect(err).toMatchObject({ code: UNIQUE, constraint: 'balances_pkey' });
    });

    it('belongs to an existing wallet', async () => {
      const err = await expectDbRejection(
        async () =>
          await db.insert(balances).values({ walletId: newId(), currency: 'cNGN', amount: '0' }),
      );
      expect(err).toMatchObject({ code: FOREIGN_KEY });
    });

    it('rejects an unsupported currency', async () => {
      const walletId = await createWallet();
      const err = await expectDbRejection(
        async () =>
          await db.insert(balances).values({ walletId, currency: 'BTC' as never, amount: '0' }),
      );
      expect(err.code).toBe('22P02'); // invalid input value for enum
    });
  });

  describe('transactions', () => {
    it('accepts a valid deposit, swap and transfer', async () => {
      const a = await createWallet();
      const b = await createWallet();
      const fx = { rateSource: 'LIVE' as const, rateFetchedAt: new Date() };

      await db.insert(transactions).values([
        deposit(a),
        {
          ...deposit(a),
          id: newId(),
          type: 'SWAP',
          sourceWalletId: a,
          destinationCurrency: 'EURx',
          destinationAmount: '92.000000',
          rate: '0.92',
          ...fx,
        },
        {
          ...deposit(b),
          id: newId(),
          type: 'TRANSFER',
          sourceWalletId: a,
          destinationCurrency: 'cNGN',
          destinationAmount: '160000.000000',
          rate: '1600',
          ...fx,
        },
        { ...deposit(b), id: newId(), type: 'TRANSFER', sourceWalletId: a },
      ]);

      expect(await db.$count(transactions)).toBe(4);
    });

    // Postgres evaluates CHECKs in alphabetical order of name and reports the first failure, so
    // the base row is a valid cross-currency transfer that breaks only the rule under test.
    it.each([
      ['sourceAmount', '0', 'transactions_source_amount_positive'],
      ['destinationAmount', '0', 'transactions_destination_amount_positive'],
      ['rate', '0', 'transactions_rate_positive'],
    ] as const)('requires %s > 0', async (field, value, constraint) => {
      const a = await createWallet();
      const b = await createWallet();
      const transfer = deposit(b, {
        type: 'TRANSFER',
        sourceWalletId: a,
        destinationCurrency: 'EURx',
        destinationAmount: '92.000000',
        rate: '0.92',
        rateSource: 'LIVE',
        rateFetchedAt: new Date(),
      });

      const err = await expectDbRejection(
        async () => await db.insert(transactions).values({ ...transfer, [field]: value }),
      );
      expect(err).toMatchObject({ code: CHECK, constraint });
    });

    it.each([
      ['a deposit with a source wallet', { sourceWalletId: 'SELF' }],
      ['a deposit that changes currency', { destinationCurrency: 'EURx' }],
      ['a deposit whose amounts differ', { destinationAmount: '99.000000' }],
      ['a swap between two wallets', { type: 'SWAP', sourceWalletId: 'OTHER' }],
      ['a swap within one currency', { type: 'SWAP', sourceWalletId: 'SELF' }],
      ['a transfer to the same wallet', { type: 'TRANSFER', sourceWalletId: 'SELF' }],
      ['a transfer without a sender', { type: 'TRANSFER' }],
    ] as const)('rejects %s', async (_name, shape) => {
      const walletId = await createWallet();
      const other = await createWallet();
      const { sourceWalletId, ...rest } = shape as { sourceWalletId?: 'SELF' | 'OTHER' };
      const resolved =
        sourceWalletId === 'SELF' ? walletId : sourceWalletId === 'OTHER' ? other : null;
      const fx = (rest as { destinationCurrency?: string }).destinationCurrency
        ? { rateSource: 'LIVE' as const, rateFetchedAt: new Date(), rate: '0.92' }
        : {};

      const err = await expectDbRejection(
        async () =>
          await db
            .insert(transactions)
            .values(deposit(walletId, { ...fx, ...rest, sourceWalletId: resolved })),
      );
      expect(err).toMatchObject({ code: CHECK, constraint: 'transactions_shape_check' });
    });

    it('records the FX source exactly when currencies differ, and rate 1 otherwise', async () => {
      const a = await createWallet();
      const b = await createWallet();
      const transfer = { type: 'TRANSFER' as const, sourceWalletId: a };

      const missingFx = await expectDbRejection(
        async () =>
          await db.insert(transactions).values(
            deposit(b, {
              ...transfer,
              destinationCurrency: 'EURx',
              destinationAmount: '92',
              rate: '0.92',
            }),
          ),
      );
      const fxOnSameCurrency = await expectDbRejection(
        async () =>
          await db
            .insert(transactions)
            .values(deposit(b, { ...transfer, rateSource: 'LIVE', rateFetchedAt: new Date() })),
      );
      const rateNotOne = await expectDbRejection(
        async () => await db.insert(transactions).values(deposit(b, { ...transfer, rate: '1.5' })),
      );

      for (const err of [missingFx, fxOnSameCurrency, rateNotOne]) {
        expect(err).toMatchObject({ code: CHECK, constraint: 'transactions_rate_check' });
      }
    });

    it('stores timestamps at millisecond precision so JS cursors round-trip exactly', async () => {
      const walletId = await createWallet();
      await db.insert(transactions).values(deposit(walletId));

      const [row] = await db.select().from(transactions);
      const [match] = await db
        .select()
        .from(transactions)
        .where(sql`${transactions.createdAt} = ${row?.createdAt}`);
      expect(match?.id).toBe(row?.id);
    });
  });

  describe('ledger_entries', () => {
    const entry = async (overrides: Partial<typeof ledgerEntries.$inferInsert> = {}) => {
      const walletId = await createWallet();
      const tx = deposit(walletId);
      await db.insert(transactions).values(tx);
      return {
        id: newId(),
        transactionId: tx.id,
        accountType: 'WALLET' as const,
        walletId,
        currency: 'USDx' as const,
        amount: '100.000000',
        ...overrides,
      };
    };

    it('accepts signed postings for wallets and system accounts', async () => {
      const credit = await entry();
      await db.insert(ledgerEntries).values([
        credit,
        {
          ...credit,
          id: newId(),
          accountType: 'EXTERNAL_SETTLEMENT',
          walletId: null,
          amount: '-100',
        },
      ]);
      expect(await db.$count(ledgerEntries)).toBe(2);
    });

    it('rejects a zero posting', async () => {
      const err = await expectDbRejection(
        async () => await db.insert(ledgerEntries).values(await entry({ amount: '0' })),
      );
      expect(err).toMatchObject({ code: CHECK, constraint: 'ledger_entries_amount_non_zero' });
    });

    it.each([
      ['a wallet posting without a wallet', { accountType: 'WALLET', walletId: null }],
      ['a system posting with a wallet', { accountType: 'FX_POOL' }],
    ] as const)('rejects %s', async (_name, overrides) => {
      const err = await expectDbRejection(
        async () => await db.insert(ledgerEntries).values(await entry(overrides)),
      );
      expect(err).toMatchObject({ code: CHECK, constraint: 'ledger_entries_account_check' });
    });

    it('belongs to an existing transaction', async () => {
      const err = await expectDbRejection(
        async () => await db.insert(ledgerEntries).values(await entry({ transactionId: newId() })),
      );
      expect(err).toMatchObject({ code: FOREIGN_KEY });
    });
  });

  describe('fx_rates', () => {
    it('keeps one positive units-per-USD rate per currency', async () => {
      const row = {
        currency: 'cNGN' as const,
        unitsPerUsd: '1600.5',
        source: 'LIVE' as const,
        fetchedAt: new Date(),
      };
      await db.insert(fxRates).values(row);

      const duplicate = await expectDbRejection(async () => await db.insert(fxRates).values(row));
      const zero = await expectDbRejection(
        async () => await db.insert(fxRates).values({ ...row, currency: 'cGHS', unitsPerUsd: '0' }),
      );

      expect(duplicate).toMatchObject({ code: UNIQUE, constraint: 'fx_rates_pkey' });
      expect(zero).toMatchObject({ code: CHECK, constraint: 'fx_rates_units_per_usd_positive' });
    });
  });

  describe('idempotency_keys', () => {
    const row = {
      scope: 'deposit',
      key: 'k-1',
      requestHash: 'a'.repeat(64),
      responseStatus: 201,
      responseBody: { ok: true },
    };

    it('is unique per (scope, key)', async () => {
      await db.insert(idempotencyKeys).values(row);
      await db.insert(idempotencyKeys).values({ ...row, scope: 'swap' });

      const err = await expectDbRejection(async () => await db.insert(idempotencyKeys).values(row));
      expect(err).toMatchObject({ code: UNIQUE, constraint: 'idempotency_keys_pkey' });
    });

    it.each([
      ['an empty key', { key: '' }, 'idempotency_keys_key_length'],
      ['a 256-character key', { key: 'k'.repeat(256) }, 'idempotency_keys_key_length'],
      ['a malformed hash', { requestHash: 'xyz' }, 'idempotency_keys_request_hash_format'],
    ] as const)('rejects %s', async (_name, overrides, constraint) => {
      const err = await expectDbRejection(
        async () => await db.insert(idempotencyKeys).values({ ...row, ...overrides }),
      );
      expect(err).toMatchObject({ code: CHECK, constraint });
    });

    it('requires the stored response', async () => {
      const err = await expectDbRejection(
        async () => await db.insert(idempotencyKeys).values({ ...row, responseBody: null }),
      );
      expect(err.code).toBe(NOT_NULL);
    });
  });
});
