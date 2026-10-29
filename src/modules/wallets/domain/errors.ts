import { DomainError } from '../../../shared/domain/domain-error.js';
import { ErrorCode } from '../../../shared/domain/error-code.js';

export class InvalidEmailError extends DomainError {
  readonly code = ErrorCode.INVALID_EMAIL;
}

export class InvalidPhoneNumberError extends DomainError {
  readonly code = ErrorCode.INVALID_PHONE_NUMBER;
}

export class ContactRequiredError extends DomainError {
  readonly code = ErrorCode.CONTACT_REQUIRED;

  constructor() {
    super('Provide an email, a phone number or both');
  }
}

export class WalletAlreadyExistsError extends DomainError {
  readonly code = ErrorCode.WALLET_ALREADY_EXISTS;

  constructor(readonly field: 'email' | 'phone') {
    super(`A wallet with this ${field} already exists`, { field });
  }
}
