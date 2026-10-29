import {
  type ArgumentsHost,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { ErrorCode } from '../../domain/error-code.js';
import { CurrencyMismatchError, InvalidAmountError } from '../../domain/errors.js';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { DOMAIN_ERROR_STATUS } from './domain-error-status.js';
import { RequestValidationException } from './request-validation.exception.js';

function setup(headersSent = false) {
  const replies: { body: unknown; status: number }[] = [];
  const ended: unknown[] = [];
  const response = {};
  const adapterHost = {
    httpAdapter: {
      reply: (_res: unknown, body: unknown, status: number) => replies.push({ body, status }),
      isHeadersSent: () => headersSent,
      end: (res: unknown) => ended.push(res),
    },
  } as unknown as HttpAdapterHost;
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({}) }),
  } as unknown as ArgumentsHost;
  const filter = new ApiExceptionFilter(adapterHost);
  const handle = (error: unknown) => {
    filter.catch(error, host);
    return replies[0];
  };
  return { handle, ended, response };
}

describe('ApiExceptionFilter', () => {
  it('maps a domain error to its status, code, message and details', () => {
    const reply = setup().handle(new InvalidAmountError('Bad amount', { amount: 'x' }));

    expect(reply).toEqual({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      body: { error: { code: 'INVALID_AMOUNT', message: 'Bad amount', details: { amount: 'x' } } },
    });
  });

  it('has an HTTP status for every domain error code', () => {
    expect(Object.keys(DOMAIN_ERROR_STATUS).sort()).toEqual(Object.values(ErrorCode).sort());
    expect(setup().handle(new CurrencyMismatchError('x'))?.status).toBe(422);
  });

  it('reports request validation issues as VALIDATION_ERROR', () => {
    const issues = [{ path: 'amount', message: 'Invalid input' }];
    const reply = setup().handle(new RequestValidationException(issues));

    expect(reply).toEqual({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: { issues },
        },
      },
    });
  });

  it('names a Nest HTTP exception after its status and keeps its message', () => {
    const reply = setup().handle(new NotFoundException('Wallet not found'));

    expect(reply).toEqual({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Wallet not found', details: {} } },
    });
  });

  it('keeps an object response (e.g. the Terminus health result) as details', () => {
    const health = { status: 'error', info: {}, error: { database: { status: 'down' } } };
    const reply = setup().handle(new ServiceUnavailableException(health));

    expect(reply).toEqual({
      status: 503,
      body: {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service Unavailable', details: health },
      },
    });
  });

  it('hides unexpected errors behind a generic 500', () => {
    const reply = setup().handle(new Error('password=hunter2 at db.internal:5432'));

    expect(reply).toEqual({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: {} } },
    });
  });

  it('only ends the response when headers were already sent', () => {
    const { handle, ended, response } = setup(true);

    expect(handle(new Error('late failure'))).toBeUndefined();
    expect(ended).toEqual([response]);
  });
});
