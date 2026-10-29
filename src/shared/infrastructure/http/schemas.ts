import { z } from 'zod';
import { CURRENCIES } from '../../domain/currency.js';
import { InvalidAmountError } from '../../domain/errors.js';
import { Money } from '../../domain/money.js';

/** A supported stablecoin code (case-sensitive). */
export const currencyCode = z
  .enum(CURRENCIES)
  .meta({ description: 'Supported stablecoin', example: 'cNGN' });

/**
 * A positive amount as a decimal string with at most 6 decimals. The rules live in `Money`
 * (single source of truth); every currency has scale 6, so the currency used to check is moot.
 */
export const decimalAmount = z
  .string()
  .superRefine((value, ctx) => {
    try {
      Money.positive(value, 'USDx');
    } catch (error) {
      if (!(error instanceof InvalidAmountError)) throw error;
      ctx.addIssue({ code: 'custom', message: error.message });
    }
  })
  .meta({
    description: 'Positive decimal string, at most 6 decimal places. JSON numbers are rejected.',
    example: '1500.25',
  });
