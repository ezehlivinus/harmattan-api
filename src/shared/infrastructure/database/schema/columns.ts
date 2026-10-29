import { numeric, timestamp } from 'drizzle-orm/pg-core';

/** Money: exact, 6 decimal places, read and written as strings (ADR-007). */
export const amount = () => numeric({ precision: 38, scale: 6, mode: 'string' });

/** FX rate: exact, 18 decimal places. */
export const rate = () => numeric({ precision: 38, scale: 18, mode: 'string' });

/** Millisecond precision so values round-trip through JS `Date` (cursor pagination). */
export const timestampMs = () => timestamp({ withTimezone: true, precision: 3, mode: 'date' });
