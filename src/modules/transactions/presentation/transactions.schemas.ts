import { z } from 'zod';
import { currencyCode } from '../../../shared/infrastructure/http/schemas.js';
import { transactionResponse } from '../../../shared/infrastructure/http/transaction.schema.js';
import { decodeCursor } from '../application/cursor.js';

const ENTRY_TYPES = ['DEPOSIT', 'SWAP', 'TRANSFER_IN', 'TRANSFER_OUT'] as const;

export const walletParams = z.object({ walletId: z.uuid() });
export const transactionParams = z.object({ transactionId: z.uuid() });

export const historyQuery = z.object({
  type: z
    .enum(ENTRY_TYPES)
    .optional()
    .meta({ description: 'What the transaction was for this wallet' }),
  currency: currencyCode
    .optional()
    .meta({ description: 'Matches the source or destination currency' }),
  limit: z.coerce.number().int().min(1).max(100).default(20).meta({ description: '1-100' }),
  cursor: z
    .string()
    .transform((value, ctx) => {
      const position = decodeCursor(value);
      if (position === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid cursor; use nextCursor from a previous page',
        });
        return z.NEVER;
      }
      return position;
    })
    .optional()
    .meta({ description: 'nextCursor from the previous page' }),
});

export type HistoryQuery = z.infer<typeof historyQuery>;

export const historyPageResponse = z
  .object({
    items: z.array(
      transactionResponse.extend({
        entryType: z.enum(ENTRY_TYPES).meta({
          description:
            'DEPOSIT, SWAP, or TRANSFER_IN / TRANSFER_OUT from this wallet’s point of view',
        }),
      }),
    ),
    nextCursor: z.string().nullable().meta({ description: 'Null on the last page' }),
  })
  .meta({ id: 'TransactionHistoryPage' });
