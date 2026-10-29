import type { TransactionContext } from '../../../../shared/application/unit-of-work.js';
import type { Wallet } from '../../domain/wallet.js';

export interface WalletRepository {
  /** Stores the wallet and its opening balances. Throws `WalletAlreadyExistsError`. */
  create(wallet: Wallet, tx: TransactionContext): Promise<void>;
}

export const WALLET_REPOSITORY = Symbol('WalletRepository');
