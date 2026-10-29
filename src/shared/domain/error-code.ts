/** Stable, machine-readable error codes returned as `error.code` by the API. */
export const ErrorCode = {
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE_NUMBER: 'INVALID_PHONE_NUMBER',
  CONTACT_REQUIRED: 'CONTACT_REQUIRED',
  WALLET_ALREADY_EXISTS: 'WALLET_ALREADY_EXISTS',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
