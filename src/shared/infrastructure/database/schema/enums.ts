import { pgEnum } from 'drizzle-orm/pg-core';
import { CURRENCIES } from '../../../domain/currency.js';

export const currencyEnum = pgEnum('currency', CURRENCIES);

export const transactionTypeEnum = pgEnum('transaction_type', ['DEPOSIT', 'SWAP', 'TRANSFER']);

/** Where an FX rate came from (ADR-004). */
export const rateSourceEnum = pgEnum('rate_source', ['LIVE', 'CACHED', 'FALLBACK']);

/**
 * Ledger account kinds (ADR-008). System accounts are not rows: an account is identified by
 * (account_type, wallet_id, currency), e.g. the cNGN FX pool is (FX_POOL, NULL, cNGN).
 */
export const accountTypeEnum = pgEnum('account_type', ['WALLET', 'EXTERNAL_SETTLEMENT', 'FX_POOL']);
