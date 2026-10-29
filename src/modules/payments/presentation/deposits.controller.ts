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
import {
  DepositCommand,
  type DepositView,
} from '../application/commands/deposit/deposit.command.js';
import {
  type DepositBody,
  depositBody,
  depositResponse,
  walletParams,
} from './payments.schemas.js';

const WALLET_ID = '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b';

@ApiTags('payments')
@Controller('wallets/:walletId/deposits')
export class DepositsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({
    summary: 'Deposit (simulated)',
    description:
      'Credits the wallet immediately and records a DEPOSIT transaction. Repeating a request with ' +
      'the same Idempotency-Key and body returns the original response without moving money again.',
  })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: 'Unique per wallet and request; 1-255 visible ASCII characters, e.g. a UUID.',
    example: '6f1c2a9e-3b7d-4e8f-9a0b-1c2d3e4f5a6b',
  })
  @ApiCreatedResponse({
    description: 'Deposited (or the replayed original response).',
    standardSchema: depositResponse,
    headers: {
      [IDEMPOTENT_REPLAYED_HEADER]: {
        description: '`true` when this is the stored response of an earlier identical request',
        schema: { type: 'string', enum: ['true'] },
      },
    },
    example: {
      transaction: {
        id: '019a3b5d-0a1b-7c2d-8e3f-4a5b6c7d8e9f',
        type: 'DEPOSIT',
        sourceWalletId: null,
        destinationWalletId: WALLET_ID,
        sourceAmount: '1500.250000',
        sourceCurrency: 'cNGN',
        destinationAmount: '1500.250000',
        destinationCurrency: 'cNGN',
        rate: '1.000000000000000000',
        rateSource: null,
        rateFetchedAt: null,
        createdAt: '2026-10-29T12:00:00.000Z',
      },
      balance: { currency: 'cNGN', amount: '1500.250000' },
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing Idempotency-Key, invalid wallet id, currency or amount.',
    standardSchema: errorResponseSchema,
    example: errorExample('VALIDATION_ERROR', 'Request validation failed', {
      issues: [{ path: 'amount', message: 'Invalid input: expected string, received number' }],
    }),
  })
  @ApiNotFoundResponse({
    description: 'No wallet with this id.',
    standardSchema: errorResponseSchema,
    example: errorExample('WALLET_NOT_FOUND', 'Wallet not found', { walletId: WALLET_ID }),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Amount above the per-request limit, or the key was used with a different body.',
    standardSchema: errorResponseSchema,
    example: errorExample(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used with a different request',
      { key: '6f1c2a9e-3b7d-4e8f-9a0b-1c2d3e4f5a6b' },
    ),
  })
  async deposit(
    @Param({ schema: walletParams }) params: z.infer<typeof walletParams>,
    @Body({ schema: depositBody }) body: DepositBody,
    @IdempotencyKey() idempotencyKey: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DepositView> {
    const result = await this.commandBus.execute(
      new DepositCommand(params.walletId, body.currency, body.amount, idempotencyKey),
    );
    return sendIdempotent(response, result);
  }
}
