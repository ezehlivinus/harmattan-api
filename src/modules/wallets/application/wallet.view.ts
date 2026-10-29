import type { Money } from '../../../shared/domain/money.js';
import type { Currency } from '../../../shared/domain/currency.js';
import type { Wallet } from '../domain/wallet.js';

/** Wallet as returned by the API. */
export interface WalletView {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  balances: { currency: Currency; amount: string }[];
}

export function toWalletView(wallet: Wallet, balances: Money[]): WalletView {
  return {
    id: wallet.id,
    email: wallet.email?.value ?? null,
    phone: wallet.phone?.value ?? null,
    createdAt: wallet.createdAt.toISOString(),
    balances: balances.map((b) => ({ currency: b.currency, amount: b.toString() })),
  };
}
