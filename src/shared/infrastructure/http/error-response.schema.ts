import { z } from 'zod';

/** OpenAPI schema of the error envelope (see ApiExceptionFilter). */
export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      details: z.record(z.string(), z.unknown()),
    }),
  })
  .meta({ id: 'ErrorResponse' });

/** Example error body for Swagger, e.g. `errorExample('WALLET_ALREADY_EXISTS', '...', {...})`. */
export function errorExample(code: string, message: string, details: Record<string, unknown> = {}) {
  return { error: { code, message, details } };
}
