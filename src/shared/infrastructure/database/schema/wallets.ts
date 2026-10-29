import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestampMs } from './columns.js';

export const wallets = pgTable(
  'wallets',
  {
    id: uuid().primaryKey(),
    /** Lowercased and trimmed by the application. */
    email: text(),
    /** E.164, e.g. +2348012345678. */
    phone: text(),
    createdAt: timestampMs().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('wallets_email_unique').on(t.email),
    uniqueIndex('wallets_phone_unique').on(t.phone),
    check('wallets_contact_check', sql`${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`),
    // Backstops for the application's normalization, so the unique indexes mean "same person".
    check('wallets_email_normalized', sql`${t.email} = lower(btrim(${t.email}))`),
    // `[+]`, not `\+`: a backslash in a template literal would be dropped before reaching SQL.
    check('wallets_phone_e164', sql`${t.phone} ~ '^[+][1-9][0-9]{6,14}$'`),
  ],
);
