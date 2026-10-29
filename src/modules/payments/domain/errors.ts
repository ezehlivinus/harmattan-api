import { DomainError } from '../../../shared/domain/domain-error.js';
import { ErrorCode } from '../../../shared/domain/error-code.js';

export class AmountLimitExceededError extends DomainError {
  readonly code = ErrorCode.AMOUNT_LIMIT_EXCEEDED;
}

export class InsufficientFundsError extends DomainError {
  readonly code = ErrorCode.INSUFFICIENT_FUNDS;

  constructor(currency: string, amount: string) {
    super(`Insufficient ${currency} balance`, { currency, amount });
  }
}

export class SameCurrencyError extends DomainError {
  readonly code = ErrorCode.SAME_CURRENCY;

  constructor(currency: string) {
    super('Source and destination currencies must differ', { currency });
  }
}

export class AmountTooSmallError extends DomainError {
  readonly code = ErrorCode.AMOUNT_TOO_SMALL;
}

export class SelfTransferError extends DomainError {
  readonly code = ErrorCode.SELF_TRANSFER;

  constructor(walletId: string) {
    super('A wallet cannot transfer to itself; use a swap to change currency', { walletId });
  }
}
