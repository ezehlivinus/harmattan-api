import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { sql } from 'drizzle-orm';
import { CURRENCIES, type Currency } from '../../../shared/domain/currency.js';
import type { Database } from '../../../shared/infrastructure/database/database.js';
import { fxRates } from '../../../shared/infrastructure/database/schema/index.js';
import type { LiveRates } from '../application/ports/fx-rate.provider.js';
import type { FxRateStore, StoredRates } from '../application/ports/fx-rate.store.js';
import { FALLBACK_FETCHED_AT, FALLBACK_UNITS_PER_USD } from '../domain/fallback-rates.js';

@Injectable()
export class DrizzleFxRateStore implements FxRateStore {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async load(): Promise<StoredRates | undefined> {
    const rows = await this.db.select().from(fxRates);
    const byCurrency = new Map(rows.map((row) => [row.currency, row]));
    if (!CURRENCIES.every((currency) => byCurrency.has(currency))) {
      return undefined;
    }
    const unitsPerUsd = {} as Record<Currency, string>;
    for (const row of rows) {
      unitsPerUsd[row.currency] = row.unitsPerUsd;
    }
    return {
      unitsPerUsd,
      source: rows.some((row) => row.source === 'FALLBACK') ? 'FALLBACK' : 'LIVE',
      fetchedAt: new Date(Math.min(...rows.map((row) => row.fetchedAt.getTime()))),
    };
  }

  async saveLive(rates: LiveRates): Promise<void> {
    await this.db
      .insert(fxRates)
      .values(
        CURRENCIES.map((currency) => ({
          currency,
          unitsPerUsd: rates.unitsPerUsd[currency],
          source: 'LIVE' as const,
          fetchedAt: rates.fetchedAt,
        })),
      )
      .onConflictDoUpdate({
        target: fxRates.currency,
        set: {
          unitsPerUsd: sql`excluded.units_per_usd`,
          source: sql`excluded.source`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }
}

/** Seeds the FALLBACK table once; never overwrites rates already stored (idempotent). */
export async function seedFallbackRates(db: Database): Promise<void> {
  await db
    .insert(fxRates)
    .values(
      CURRENCIES.map((currency) => ({
        currency,
        unitsPerUsd: FALLBACK_UNITS_PER_USD[currency],
        source: 'FALLBACK' as const,
        fetchedAt: FALLBACK_FETCHED_AT,
      })),
    )
    .onConflictDoNothing({ target: fxRates.currency });
}
