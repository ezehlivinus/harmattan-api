import { z } from 'zod';
import { currencyCode } from './schemas.js';

const amount = z.string().meta({ example: '1500.250000' });

/** OpenAPI schema of `TransactionView` (payments results and history). */
export const transactionResponse = z
  .object({
    id: z.uuid(),
    type: z.enum(['DEPOSIT', 'SWAP', 'TRANSFER']),
    sourceWalletId: z.uuid().nullable().meta({ description: 'Null for deposits' }),
    destinationWalletId: z.uuid(),
    sourceAmount: amount,
    sourceCurrency: currencyCode,
    destinationAmount: amount,
    destinationCurrency: currencyCode,
    rate: z.string().meta({
      description: 'Units of destination per unit of source (18 decimals); 1 when currencies match',
      example: '1.000000000000000000',
    }),
    rateSource: z.enum(['LIVE', 'CACHED', 'FALLBACK']).nullable(),
    rateFetchedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Transaction' });
