import { Body, Controller, Post, Res } from '@nestjs/common';
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
  TransferCommand,
  type TransferView,
} from '../application/commands/transfer/transfer.command.js';
import { type TransferBody, transferBody, transferResponse } from './payments.schemas.js';

const SENDER = '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b';
const RECEIVER = '019a3b5c-9f3a-7b21-8c5d-2e3f4a5b6c7d';

@ApiTags('payments')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({
    summary: 'Transfer to another wallet, converting if the currencies differ',
    description:
      'Debits `amount` of sourceCurrency from the sender and credits the receiver in ' +
      'destinationCurrency: the same amount when the currencies match (rate 1), otherwise ' +
      'roundDown(amount × rate, 6) at the current rate, which is recorded with its source.',
  })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: 'Unique per sender and request; 1-255 visible ASCII characters, e.g. a UUID.',
  })
  @ApiCreatedResponse({
    description: 'Transferred (or the replayed original response).',
    standardSchema: transferResponse,
    headers: {
      [IDEMPOTENT_REPLAYED_HEADER]: {
        description: '`true` when this is the stored response of an earlier identical request',
        schema: { type: 'string', enum: ['true'] },
      },
    },
    example: {
      transaction: {
        id: '019a3b5d-0a1b-7c2d-8e3f-4a5b6c7d8e9f',
        type: 'TRANSFER',
        sourceWalletId: SENDER,
        destinationWalletId: RECEIVER,
        sourceAmount: '10.000000',
        sourceCurrency: 'EURx',
        destinationAmount: '138.888888',
        destinationCurrency: 'cGHS',
        rate: '13.888888888888888888',
        rateSource: 'LIVE',
        rateFetchedAt: '2026-10-29T00:02:31.000Z',
        createdAt: '2026-10-29T12:00:00.000Z',
      },
      senderBalance: { currency: 'EURx', amount: '0.000000' },
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing Idempotency-Key, invalid wallet ids, currencies or amount.',
    standardSchema: errorResponseSchema,
    example: errorExample('VALIDATION_ERROR', 'Request validation failed', {
      issues: [{ path: 'toWalletId', message: 'Invalid UUID' }],
    }),
  })
  @ApiNotFoundResponse({
    description: 'The sender or the receiver does not exist.',
    standardSchema: errorResponseSchema,
    example: errorExample('WALLET_NOT_FOUND', 'Wallet not found', { walletId: RECEIVER }),
  })
  @ApiUnprocessableEntityResponse({
    description:
      'INSUFFICIENT_FUNDS, SELF_TRANSFER, AMOUNT_TOO_SMALL (converts to less than 0.000001) or ' +
      'IDEMPOTENCY_KEY_REUSED.',
    standardSchema: errorResponseSchema,
    example: errorExample(
      'SELF_TRANSFER',
      'A wallet cannot transfer to itself; use a swap to change currency',
      { walletId: SENDER },
    ),
  })
  async transfer(
    @Body({ schema: transferBody }) body: TransferBody,
    @IdempotencyKey() idempotencyKey: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TransferView> {
    const result = await this.commandBus.execute(
      new TransferCommand(
        body.fromWalletId,
        body.toWalletId,
        body.sourceCurrency,
        body.destinationCurrency,
        body.amount,
        idempotencyKey,
      ),
    );
    return sendIdempotent(response, result);
  }
}
