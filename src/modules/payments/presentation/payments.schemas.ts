import { z } from 'zod';
import { currencyCode, decimalAmount } from '../../../shared/infrastructure/http/schemas.js';
import { transactionResponse } from '../../../shared/infrastructure/http/transaction.schema.js';

export const walletParams = z.object({ walletId: z.uuid() });

export const depositBody = z
  .object({ currency: currencyCode, amount: decimalAmount })
  .meta({ id: 'DepositRequest', example: { currency: 'cNGN', amount: '1500.25' } });

export type DepositBody = z.infer<typeof depositBody>;

const amount = z.string().meta({ example: '1500.250000' });

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
  .meta({
    id: 'SwapRequest',
    example: { fromCurrency: 'cNGN', toCurrency: 'USDx', amount: '1000' },
  });

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
  .meta({
    id: 'TransferRequest',
    example: {
      fromWalletId: '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b',
      toWalletId: '019a3b5c-9f3a-7b21-8c5d-2e3f4a5b6c7d',
      sourceCurrency: 'EURx',
      destinationCurrency: 'cGHS',
      amount: '10',
    },
  });

export type TransferBody = z.infer<typeof transferBody>;

export const transferResponse = z
  .object({
    transaction: transactionResponse,
    senderBalance: z.object({ currency: currencyCode, amount }).meta({
      description: "The sender's balance in sourceCurrency after the transfer",
    }),
  })
  .meta({ id: 'TransferResult' });
