import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';
import type { IdempotentResult } from '../../application/idempotency.service.js';
import { RequestValidationException } from './request-validation.exception.js';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';

/** 1–255 visible ASCII characters (a UUID is a good choice). */
const KEY_FORMAT = /^[\x21-\x7E]{1,255}$/;

/**
 * The required `Idempotency-Key` header. `@Headers()` takes no schema in Nest 12, so this
 * decorator validates it and fails like the validation pipe (400 VALIDATION_ERROR).
 */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const value: unknown = ctx.switchToHttp().getRequest<{ headers: Record<string, unknown> }>()
    .headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()];
  if (typeof value !== 'string' || !KEY_FORMAT.test(value)) {
    throw new RequestValidationException([
      {
        path: IDEMPOTENCY_KEY_HEADER,
        message: 'Required header: 1-255 visible ASCII characters, e.g. a UUID',
      },
    ]);
  }
  return value;
});

/** Applies the stored status and marks replays with `Idempotent-Replayed: true`. */
export function sendIdempotent<T>(response: Response, result: IdempotentResult<T>): T {
  response.status(result.status);
  if (result.replayed) {
    response.setHeader(IDEMPOTENT_REPLAYED_HEADER, 'true');
  }
  return result.body;
}
