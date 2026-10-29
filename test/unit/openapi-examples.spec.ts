import type { z } from 'zod';
import {
  depositBody,
  swapBody,
  transferBody,
} from '../../src/modules/payments/presentation/payments.schemas.js';
import { createWalletBody } from '../../src/modules/wallets/presentation/wallets.schemas.js';

// Swagger UI pre-fills "Try it out" from these examples, so each must be a valid request.
describe('documented request examples', () => {
  it.each([
    ['CreateWalletRequest', createWalletBody],
    ['DepositRequest', depositBody],
    ['SwapRequest', swapBody],
    ['TransferRequest', transferBody],
  ] as [string, z.ZodType][])('%s example passes its own schema', (_name, schema) => {
    const example: unknown = schema.meta()?.example;

    expect(example).toBeDefined();
    expect(schema.safeParse(example).success).toBe(true);
  });
});
