/** Stable, machine-readable error codes returned as `error.code` by the API. */
export const ErrorCode = {
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
