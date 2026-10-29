import { DomainError } from '../../../shared/domain/domain-error.js';
import { ErrorCode } from '../../../shared/domain/error-code.js';

export class AmountLimitExceededError extends DomainError {
  readonly code = ErrorCode.AMOUNT_LIMIT_EXCEEDED;
}
