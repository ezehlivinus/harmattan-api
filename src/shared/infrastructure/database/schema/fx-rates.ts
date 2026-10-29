import { sql } from 'drizzle-orm';
import { check, pgTable } from 'drizzle-orm/pg-core';
import { rate, timestampMs } from './columns.js';
import { currencyEnum, rateSourceEnum } from './enums.js';

/** Last known units-per-USD rate per currency (ADR-004): the fallback when the provider fails. */
export const fxRates = pgTable(
  'fx_rates',
  {
    currency: currencyEnum().primaryKey(),
    unitsPerUsd: rate().notNull(),
    source: rateSourceEnum().notNull(),
    fetchedAt: timestampMs().notNull(),
  },
  (t) => [check('fx_rates_units_per_usd_positive', sql`${t.unitsPerUsd} > 0`)],
);
