import { HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '../../domain/error-code.js';

/** HTTP status for every domain error code; a new code without a status fails to compile. */
export const DOMAIN_ERROR_STATUS: Record<ErrorCode, HttpStatus> = {
  INVALID_AMOUNT: HttpStatus.UNPROCESSABLE_ENTITY,
  UNSUPPORTED_CURRENCY: HttpStatus.UNPROCESSABLE_ENTITY,
  CURRENCY_MISMATCH: HttpStatus.UNPROCESSABLE_ENTITY,
};
