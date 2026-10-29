import { Command } from '@nestjs/cqrs';
import type { WalletView } from '../../wallet.view.js';

export class CreateWalletCommand extends Command<WalletView> {
  constructor(
    readonly email: string | undefined,
    readonly phone: string | undefined,
  ) {
    super();
  }
}
