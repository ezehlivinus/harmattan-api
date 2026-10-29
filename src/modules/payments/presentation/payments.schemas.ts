import { z } from 'zod';
import { currencyCode, decimalAmount } from '../../../shared/infrastructure/http/schemas.js';

export const walletParams = z.object({ walletId: z.uuid() });

export const depositBody = z
  .object({ currency: currencyCode, amount: decimalAmount })
  .meta({ id: 'DepositRequest' });

export type DepositBody = z.infer<typeof depositBody>;

const amount = z.string().meta({ example: '1500.250000' });

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

export const depositResponse = z
  .object({
    transaction: transactionResponse,
    balance: z.object({ currency: currencyCode, amount }).meta({
      description: "The wallet's balance in this currency after the deposit",
    }),
  })
  .meta({ id: 'DepositResult' });

export const swapBody = z
  .object({
    fromCurrency: currencyCode,
    toCurrency: currencyCode,
    amount: decimalAmount.meta({ description: 'Amount of fromCurrency to convert' }),
  })
  .meta({ id: 'SwapRequest' });

export type SwapBody = z.infer<typeof swapBody>;

export const swapResponse = z
  .object({
    transaction: transactionResponse,
    balances: z
      .array(z.object({ currency: currencyCode, amount }))
      .meta({ description: 'Balances after the swap: source currency, then destination currency' }),
  })
  .meta({ id: 'SwapResult' });

export const transferBody = z
  .object({
    fromWalletId: z.uuid(),
    toWalletId: z.uuid(),
    sourceCurrency: currencyCode,
    destinationCurrency: currencyCode,
    amount: decimalAmount.meta({ description: 'Amount of sourceCurrency debited from the sender' }),
  })
  .meta({ id: 'TransferRequest' });

export type TransferBody = z.infer<typeof transferBody>;

export const transferResponse = z
  .object({
    transaction: transactionResponse,
    senderBalance: z.object({ currency: currencyCode, amount }).meta({
      description: "The sender's balance in sourceCurrency after the transfer",
    }),
  })
  .meta({ id: 'TransferResult' });
