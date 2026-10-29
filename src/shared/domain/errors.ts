import { DomainError } from './domain-error.js';
import { ErrorCode } from './error-code.js';

export class InvalidAmountError extends DomainError {
  readonly code = ErrorCode.INVALID_AMOUNT;
}

export class UnsupportedCurrencyError extends DomainError {
  readonly code = ErrorCode.UNSUPPORTED_CURRENCY;
}

export class CurrencyMismatchError extends DomainError {
  readonly code = ErrorCode.CURRENCY_MISMATCH;
}

export class WalletNotFoundError extends DomainError {
  readonly code = ErrorCode.WALLET_NOT_FOUND;

  constructor(walletId: string) {
    super('Wallet not found', { walletId });
  }
}
