import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../../../shared/application/clock.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work.js';
import { Wallet } from '../../../domain/wallet.js';
import { WALLET_REPOSITORY, type WalletRepository } from '../../ports/wallet.repository.js';
import { type WalletView, toWalletView } from '../../wallet.view.js';
import { CreateWalletCommand } from './create-wallet.command.js';

@CommandHandler(CreateWalletCommand)
export class CreateWalletHandler implements ICommandHandler<CreateWalletCommand> {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CreateWalletCommand): Promise<WalletView> {
    const wallet = Wallet.create({ email: command.email, phone: command.phone }, this.clock.now());
    // Duplicates are caught by the unique indexes, so concurrent requests cannot both win.
    await this.uow.run(async (tx) => {
      await this.wallets.create(wallet, tx);
    });
    return toWalletView(wallet, wallet.openingBalances());
  }
}
