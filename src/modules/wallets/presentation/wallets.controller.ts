import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  errorExample,
  errorResponseSchema,
} from '../../../shared/infrastructure/http/error-response.schema.js';
import { CreateWalletCommand } from '../application/commands/create-wallet/create-wallet.command.js';
import type { WalletView } from '../application/wallet.view.js';
import { type CreateWalletBody, createWalletBody, walletResponse } from './wallets.schemas.js';

@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly commandBus: CommandBus) {}

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
}
