import { z } from 'zod';
import { CURRENCIES } from '../../../shared/domain/currency.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { currencyCode } from '../../../shared/infrastructure/http/schemas.js';
import { EmailAddress } from '../domain/email-address.js';
import { PhoneNumber } from '../domain/phone-number.js';

/** Runs a domain parser as a Zod refinement, so request validation and the domain agree. */
const viaDomain =
  (parse: (value: string) => unknown) =>
  (value: string, ctx: z.RefinementCtx): void => {
    try {
      parse(value);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      ctx.addIssue({ code: 'custom', message: error.message });
    }
  };

export const createWalletBody = z
  .object({
    email: z
      .string()
      .superRefine(viaDomain((v) => EmailAddress.parse(v)))
      .optional()
      .meta({ description: 'Trimmed and lowercased; unique', example: 'ada@example.com' }),
    phone: z
      .string()
      .superRefine(viaDomain((v) => PhoneNumber.parse(v)))
      .optional()
      .meta({
        description: 'Any common format; stored as E.164; numbers without +country are Nigerian',
        example: '0801 234 5678',
      }),
  })
  .refine((body) => body.email !== undefined || body.phone !== undefined, {
    message: 'Provide an email, a phone number or both',
  })
  .meta({
    id: 'CreateWalletRequest',
    example: { email: 'ada@example.com', phone: '0801 234 5678' },
  });

export type CreateWalletBody = z.infer<typeof createWalletBody>;

export const walletResponse = z
  .object({
    id: z.uuid().meta({ example: '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b' }),
    email: z.string().nullable().meta({ example: 'ada@example.com' }),
    phone: z.string().nullable().meta({ example: '+2348012345678' }),
    createdAt: z.iso.datetime().meta({ example: '2026-10-29T12:00:00.000Z' }),
    balances: z
      .array(z.object({ currency: currencyCode, amount: z.string().meta({ example: '0.000000' }) }))
      .meta({ description: `One entry per currency, in this order: ${CURRENCIES.join(', ')}` }),
  })
  .meta({ id: 'Wallet' });

export const walletParams = z.object({ walletId: z.uuid() });

const usdAmount = z.string().meta({ example: '14.166666' });

export const walletDetailsResponse = z
  .object({
    id: z.uuid(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    createdAt: z.iso.datetime(),
    balances: z.array(
      z.object({
        currency: currencyCode,
        amount: z.string().meta({ example: '1600.000000' }),
        usdValue: usdAmount.meta({
          description: 'amount ÷ units per USD at the current rate, rounded down to 6 decimals',
        }),
      }),
    ),
    totalUsd: usdAmount.meta({ description: 'Sum of the balances’ usdValue' }),
    ratesAsOf: z.iso.datetime().meta({ description: 'When the provider last refreshed the rates' }),
    ratesSource: z.enum(['LIVE', 'CACHED', 'FALLBACK']),
  })
  .meta({ id: 'WalletDetails' });
