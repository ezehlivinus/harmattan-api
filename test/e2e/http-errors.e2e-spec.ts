import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { InvalidAmountError } from '../../src/shared/domain/errors.js';
import { currencyCode, decimalAmount } from '../../src/shared/infrastructure/http/schemas.js';
import { buildOpenApiDocument } from '../../src/shared/infrastructure/http/swagger.js';
import { createTestApp } from '../helpers/app.js';

const depositBody = z.object({ currency: currencyCode, amount: decimalAmount });
const itemParams = z.object({ id: z.uuid() });

/** Test-only routes that exercise every error path through the real app pipeline. */
@Controller('test-errors')
class ErrorsTestController {
  @Get('domain')
  domain(): never {
    throw new InvalidAmountError('Amount must be greater than zero', { amount: '0' });
  }

  @Get('http')
  http(): never {
    throw new NotFoundException('Wallet not found');
  }

  @Get('crash')
  crash(): never {
    throw new Error('secret internal detail');
  }

  @Post('deposits')
  deposit(@Body({ schema: depositBody }) body: z.infer<typeof depositBody>) {
    return body;
  }

  @Get('items/:id')
  item(@Param({ schema: itemParams }) params: z.infer<typeof itemParams>) {
    return params;
  }
}

describe('HTTP errors and validation (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ErrorsTestController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps a domain error to 422 with the error envelope', async () => {
    const res = await http().get('/v1/test-errors/domain').expect(422);

    expect(res.body).toEqual({
      error: {
        code: 'INVALID_AMOUNT',
        message: 'Amount must be greater than zero',
        details: { amount: '0' },
      },
    });
  });

  it('wraps Nest HTTP exceptions in the envelope', async () => {
    const res = await http().get('/v1/test-errors/http').expect(404);

    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Wallet not found', details: {} },
    });
  });

  it('answers an unknown route with the envelope', async () => {
    const res = await http().get('/v1/nope').expect(404);

    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND', details: {} } });
  });

  it('never leaks internal error details', async () => {
    const res = await http().get('/v1/test-errors/crash').expect(500);

    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: {} },
    });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('passes a valid body to the handler', async () => {
    const res = await http()
      .post('/v1/test-errors/deposits')
      .send({ currency: 'cNGN', amount: '1500.25' })
      .expect(201);

    expect(res.body).toEqual({ currency: 'cNGN', amount: '1500.25' });
  });

  it.each([
    ['a JSON number amount', { currency: 'cNGN', amount: 1500 }, 'amount'],
    ['an exponent amount', { currency: 'cNGN', amount: '1e3' }, 'amount'],
    ['a zero amount', { currency: 'cNGN', amount: '0' }, 'amount'],
    ['an unsupported currency', { currency: 'BTC', amount: '1' }, 'currency'],
    ['a missing currency', { amount: '1' }, 'currency'],
  ])('rejects %s with 400 VALIDATION_ERROR naming the field', async (_name, body, path) => {
    const res = await http().post('/v1/test-errors/deposits').send(body).expect(400);

    expect(res.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
    });
    expect(res.body).toHaveProperty(['error', 'details', 'issues', 0, 'path'], path);
  });

  it('rejects malformed JSON with 400 in the envelope', async () => {
    const res = await http()
      .post('/v1/test-errors/deposits')
      .set('Content-Type', 'application/json')
      .send('{"amount": ')
      .expect(400);

    expect(res.body).toMatchObject({ error: { code: 'BAD_REQUEST', details: {} } });
  });

  it('validates path parameters', async () => {
    const res = await http().get('/v1/test-errors/items/not-a-uuid').expect(400);

    expect(res.body).toHaveProperty(['error', 'details', 'issues', 0, 'path'], 'id');
  });

  it('documents a Zod request body in OpenAPI', () => {
    const doc = buildOpenApiDocument(app);

    expect(doc).toHaveProperty([
      'paths',
      '/v1/test-errors/deposits',
      'post',
      'requestBody',
      'content',
      'application/json',
      'schema',
    ]);
  });
});
