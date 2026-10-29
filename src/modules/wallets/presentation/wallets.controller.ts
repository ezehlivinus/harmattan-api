import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  errorExample,
  errorResponseSchema,
} from '../../../shared/infrastructure/http/error-response.schema.js';
import { CreateWalletCommand } from '../application/commands/create-wallet/create-wallet.command.js';
import {
  GetWalletQuery,
  type WalletDetailsView,
} from '../application/queries/get-wallet/get-wallet.query.js';
import type { WalletView } from '../application/wallet.view.js';
import type { z } from 'zod';
import {
  type CreateWalletBody,
  createWalletBody,
  walletDetailsResponse,
  walletParams,
  walletResponse,
} from './wallets.schemas.js';

@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a wallet',
    description:
      'Identified by an email, a phone number or both; each must be unique. ' +
      'Opens a zero balance in every supported currency.',
  })
  @ApiCreatedResponse({
    description: 'The new wallet.',
    standardSchema: walletResponse,
    example: {
      id: '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b',
      email: 'ada@example.com',
      phone: '+2348012345678',
      createdAt: '2026-10-29T12:00:00.000Z',
      balances: ['cNGN', 'cGHS', 'cXAF', 'USDx', 'EURx'].map((currency) => ({
        currency,
        amount: '0.000000',
      })),
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing contact, invalid email or invalid phone number.',
    standardSchema: errorResponseSchema,
    example: errorExample('VALIDATION_ERROR', 'Request validation failed', {
      issues: [{ path: 'phone', message: 'Invalid phone number' }],
    }),
  })
  @ApiConflictResponse({
    description: 'A wallet with this email or phone already exists.',
    standardSchema: errorResponseSchema,
    example: errorExample('WALLET_ALREADY_EXISTS', 'A wallet with this email already exists', {
      field: 'email',
    }),
  })
  async create(@Body({ schema: createWalletBody }) body: CreateWalletBody): Promise<WalletView> {
    return await this.commandBus.execute(new CreateWalletCommand(body.email, body.phone));
  }

  @Get(':walletId')
  @ApiOperation({
    summary: 'Get a wallet with balances and total value in USD',
    description:
      'Every balance with its USD value at the current rates, and the total. `ratesAsOf` and ' +
      '`ratesSource` say which rates were used (see GET /v1/fx/rates).',
  })
  @ApiOkResponse({
    standardSchema: walletDetailsResponse,
    example: {
      id: '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b',
      email: 'ada@example.com',
      phone: '+2348012345678',
      createdAt: '2026-10-29T12:00:00.000Z',
      balances: [
        { currency: 'cNGN', amount: '1600.000000', usdValue: '1.000000' },
        { currency: 'cGHS', amount: '0.000000', usdValue: '0.000000' },
        { currency: 'cXAF', amount: '1000.000000', usdValue: '1.666666' },
        { currency: 'USDx', amount: '1.500000', usdValue: '1.500000' },
        { currency: 'EURx', amount: '9.000000', usdValue: '10.000000' },
      ],
      totalUsd: '14.166666',
      ratesAsOf: '2026-10-29T00:02:31.000Z',
      ratesSource: 'LIVE',
    },
  })
  @ApiBadRequestResponse({
    description: 'The wallet id is not a UUID.',
    standardSchema: errorResponseSchema,
    example: errorExample('VALIDATION_ERROR', 'Request validation failed', {
      issues: [{ path: 'walletId', message: 'Invalid UUID' }],
    }),
  })
  @ApiNotFoundResponse({
    description: 'No wallet with this id.',
    standardSchema: errorResponseSchema,
    example: errorExample('WALLET_NOT_FOUND', 'Wallet not found', {
      walletId: '019a3b5c-7d2e-7f10-8a4b-1c2d3e4f5a6b',
    }),
  })
  async get(
    @Param({ schema: walletParams }) params: z.infer<typeof walletParams>,
  ): Promise<WalletDetailsView> {
    return await this.queryBus.execute(new GetWalletQuery(params.walletId));
  }
}
