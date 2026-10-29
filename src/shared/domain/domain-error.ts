import type { ErrorCode } from './error-code.js';

/** Base class for business-rule violations; mapped to HTTP by one exception filter. */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;

  constructor(
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}
