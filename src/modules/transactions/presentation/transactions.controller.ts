import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { z } from 'zod';
import type { TransactionView } from '../../../shared/application/transaction.view.js';
import {
  errorExample,
  errorResponseSchema,
} from '../../../shared/infrastructure/http/error-response.schema.js';
import { transactionResponse } from '../../../shared/infrastructure/http/transaction.schema.js';
import { GetTransactionQuery } from '../application/queries/get-transaction/get-transaction.query.js';
import {
  type HistoryPage,
  ListWalletTransactionsQuery,
} from '../application/queries/list-wallet-transactions/list-wallet-transactions.query.js';
import {
  type HistoryQuery,
  historyPageResponse,
  historyQuery,
  transactionParams,
  walletParams,
} from './transactions.schemas.js';

const WALLET_ID = '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b';
const TRANSACTION_ID = '019a3b5d-0a1b-7c2d-8e3f-4a5b6c7d8e9f';
const EXAMPLE = {
  id: TRANSACTION_ID,
  type: 'TRANSFER',
  sourceWalletId: WALLET_ID,
  destinationWalletId: '019a3b5c-9f3a-7b21-8c5d-2e3f4a5b6c7d',
  sourceAmount: '800.000000',
  sourceCurrency: 'cNGN',
  destinationAmount: '0.450000',
  destinationCurrency: 'EURx',
  rate: '0.000562500000000000',
  rateSource: 'LIVE',
  rateFetchedAt: '2026-10-29T00:02:31.000Z',
  createdAt: '2026-10-29T12:00:00.000Z',
};

@ApiTags('transactions')
@Controller()
export class TransactionsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('wallets/:walletId/transactions')
  @ApiOperation({
    summary: "List a wallet's transactions, newest first",
    description:
      'Deposits, swaps, and transfers sent and received. Cursor-paginated (stable while new ' +
      'transactions arrive); filter by `type` and by `currency` (source or destination).',
  })
  @ApiOkResponse({
    standardSchema: historyPageResponse,
    example: { items: [{ ...EXAMPLE, entryType: 'TRANSFER_OUT' }], nextCursor: null },
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet id, type, currency, limit or cursor.',
    standardSchema: errorResponseSchema,
    example: errorExample('VALIDATION_ERROR', 'Request validation failed', {
      issues: [{ path: 'limit', message: 'Too big: expected number to be <=100' }],
    }),
  })
  @ApiNotFoundResponse({
    description: 'No wallet with this id.',
    standardSchema: errorResponseSchema,
    example: errorExample('WALLET_NOT_FOUND', 'Wallet not found', { walletId: WALLET_ID }),
  })
  async list(
    @Param({ schema: walletParams }) params: z.infer<typeof walletParams>,
    @Query({ schema: historyQuery }) query: HistoryQuery,
  ): Promise<HistoryPage> {
    return await this.queryBus.execute(
      new ListWalletTransactionsQuery(params.walletId, {
        entryType: query.type,
        currency: query.currency,
        limit: query.limit,
        after: query.cursor,
      }),
    );
  }

  @Get('transactions/:transactionId')
  @ApiOperation({ summary: 'Get a transaction by id' })
  @ApiOkResponse({ standardSchema: transactionResponse, example: EXAMPLE })
  @ApiBadRequestResponse({
    description: 'The id is not a UUID.',
    standardSchema: errorResponseSchema,
    example: errorExample('VALIDATION_ERROR', 'Request validation failed', {
      issues: [{ path: 'transactionId', message: 'Invalid UUID' }],
    }),
  })
  @ApiNotFoundResponse({
    description: 'No transaction with this id.',
    standardSchema: errorResponseSchema,
    example: errorExample('TRANSACTION_NOT_FOUND', 'Transaction not found', {
      transactionId: TRANSACTION_ID,
    }),
  })
  async get(
    @Param({ schema: transactionParams }) params: z.infer<typeof transactionParams>,
  ): Promise<TransactionView> {
    return await this.queryBus.execute(new GetTransactionQuery(params.transactionId));
  }
}
