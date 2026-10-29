import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { z } from 'zod';
import {
  errorExample,
  errorResponseSchema,
} from '../../../shared/infrastructure/http/error-response.schema.js';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_REPLAYED_HEADER,
  IdempotencyKey,
  sendIdempotent,
} from '../../../shared/infrastructure/http/idempotency-key.js';
import { SwapCommand, type SwapView } from '../application/commands/swap/swap.command.js';
import { type SwapBody, swapBody, swapResponse, walletParams } from './payments.schemas.js';

const WALLET_ID = '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b';

@ApiTags('payments')
@Controller('wallets/:walletId/swaps')
export class SwapsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({
    summary: 'Swap between two currencies of a wallet',
    description:
      'Debits `amount` of fromCurrency and credits roundDown(amount × rate, 6) of toCurrency at ' +
      'the current rate (see GET /v1/fx/rates); the rate, its source and refresh time are ' +
      'recorded. Fails without changing anything if the balance does not cover the amount.',
  })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: 'Unique per wallet and request; 1-255 visible ASCII characters, e.g. a UUID.',
  })
  @ApiCreatedResponse({
    description: 'Swapped (or the replayed original response).',
    standardSchema: swapResponse,
    headers: {
      [IDEMPOTENT_REPLAYED_HEADER]: {
        description: '`true` when this is the stored response of an earlier identical request',
        schema: { type: 'string', enum: ['true'] },
      },
    },
    example: {
      transaction: {
        id: '019a3b5d-0a1b-7c2d-8e3f-4a5b6c7d8e9f',
        type: 'SWAP',
        sourceWalletId: WALLET_ID,
        destinationWalletId: WALLET_ID,
        sourceAmount: '1000.000000',
        sourceCurrency: 'cNGN',
        destinationAmount: '0.625000',
        destinationCurrency: 'USDx',
        rate: '0.000625000000000000',
        rateSource: 'LIVE',
        rateFetchedAt: '2026-10-29T00:02:31.000Z',
        createdAt: '2026-10-29T12:00:00.000Z',
      },
      balances: [
        { currency: 'cNGN', amount: '600.000000' },
        { currency: 'USDx', amount: '0.625000' },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing Idempotency-Key, invalid wallet id, currency or amount.',
    standardSchema: errorResponseSchema,
    example: errorExample('VALIDATION_ERROR', 'Request validation failed', {
      issues: [{ path: 'toCurrency', message: 'Invalid option' }],
    }),
  })
  @ApiNotFoundResponse({
    description: 'No wallet with this id.',
    standardSchema: errorResponseSchema,
    example: errorExample('WALLET_NOT_FOUND', 'Wallet not found', { walletId: WALLET_ID }),
  })
  @ApiUnprocessableEntityResponse({
    description:
      'INSUFFICIENT_FUNDS, SAME_CURRENCY, AMOUNT_TOO_SMALL (converts to less than 0.000001) or ' +
      'IDEMPOTENCY_KEY_REUSED.',
    standardSchema: errorResponseSchema,
    example: errorExample('INSUFFICIENT_FUNDS', 'Insufficient USDx balance', {
      currency: 'USDx',
      amount: '5.000001',
    }),
  })
  async swap(
    @Param({ schema: walletParams }) params: z.infer<typeof walletParams>,
    @Body({ schema: swapBody }) body: SwapBody,
    @IdempotencyKey() idempotencyKey: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SwapView> {
    const result = await this.commandBus.execute(
      new SwapCommand(
        params.walletId,
        body.fromCurrency,
        body.toCurrency,
        body.amount,
        idempotencyKey,
      ),
    );
    return sendIdempotent(response, result);
  }
}
