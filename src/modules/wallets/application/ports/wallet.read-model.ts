import type { Currency } from '../../../../shared/domain/currency.js';

/** A wallet as stored, for queries (no aggregate loading, no locks). */
export interface WalletRecord {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  /** One entry per supported currency, in `CURRENCIES` order. */
  balances: { currency: Currency; amount: string }[];
}

export interface WalletReadModel {
  findById(walletId: string): Promise<WalletRecord | undefined>;
}

export const WALLET_READ_MODEL = Symbol('WalletReadModel');
