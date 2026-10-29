import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { balances } from '../../src/shared/infrastructure/database/schema/index.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDatabase, truncateAll } from '../helpers/database.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('POST /v1/wallets (e2e)', () => {
  let app: INestApplication<App>;
  const db = createTestDatabase();
  const create = (body: unknown) =>
    request(app.getHttpServer())
      .post('/v1/wallets')
      .send(body as object);

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await db.$client.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  it('creates a wallet with a zero balance in every currency', async () => {
    const res = await create({ email: 'Ada@Example.com' }).expect(201);

    expect(res.body).toEqual({
      id: expect.stringMatching(UUID_V7) as unknown,
      email: 'ada@example.com',
      phone: null,
      createdAt: expect.any(String) as unknown,
      balances: ['cNGN', 'cGHS', 'cXAF', 'USDx', 'EURx'].map((currency) => ({
        currency,
        amount: '0.000000',
      })),
    });
    const id = (res.body as { id: string }).id;
    const rows = await db.select().from(balances).where(eq(balances.walletId, id));
    expect(rows).toHaveLength(5);
  });

  it('normalizes a local Nigerian number to E.164', async () => {
    const res = await create({ phone: '0801 234 5678' }).expect(201);

    expect(res.body).toMatchObject({ email: null, phone: '+2348012345678' });
  });

  it('accepts both an email and a phone', async () => {
    const res = await create({ email: 'a@example.com', phone: '+233241234567' }).expect(201);

    expect(res.body).toMatchObject({ email: 'a@example.com', phone: '+233241234567' });
  });

  it.each([
    [
      'the same email in another case',
      { email: 'ada@example.com' },
      { email: ' ADA@example.com ' },
      'email',
    ],
    [
      'the same phone in another format',
      { phone: '08012345678' },
      { phone: '+234 801 234 5678' },
      'phone',
    ],
    [
      'a known phone with a new email',
      { phone: '08012345678' },
      { email: 'new@example.com', phone: '08012345678' },
      'phone',
    ],
  ])('rejects %s with 409 WALLET_ALREADY_EXISTS', async (_name, first, second, field) => {
    await create(first).expect(201);

    const res = await create(second).expect(409);

    expect(res.body).toEqual({
      error: {
        code: 'WALLET_ALREADY_EXISTS',
        message: `A wallet with this ${field} already exists`,
        details: { field },
      },
    });
  });

  it.each([
    ['no contact', {}, ''],
    ['an invalid email', { email: 'not-an-email' }, 'email'],
    ['an invalid phone', { phone: '12' }, 'phone'],
    ['a numeric phone', { phone: 8012345678 }, 'phone'],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_name, body, path) => {
    const res = await create(body).expect(400);

    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(res.body).toHaveProperty(['error', 'details', 'issues', 0, 'path'], path);
  });

  it('lets exactly one of 10 concurrent identical requests win', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, async () => await create({ email: 'race@example.com' })),
    );

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, ...Array<number>(9).fill(409)]);
    expect(await db.$count(balances)).toBe(5);
  });
});
