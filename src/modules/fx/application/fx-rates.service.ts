import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../shared/application/clock.js';
import { FALLBACK_FETCHED_AT, FALLBACK_UNITS_PER_USD } from '../domain/fallback-rates.js';
import { RateTable } from '../domain/rate-table.js';
import type { FxRatesPort } from './fx-rates.port.js';
import { FX_RATE_PROVIDER, type FxRateProvider } from './ports/fx-rate.provider.js';
import { FX_RATE_STORE, type FxRateStore } from './ports/fx-rate.store.js';

export interface FxCacheConfig {
  /** How long live rates are reused (capped by the provider's next refresh). */
  ttlMs: number;
  /** How long a fallback answer is reused before the provider is tried again. */
  failureTtlMs: number;
}

export const FX_CACHE_CONFIG = Symbol('FxCacheConfig');

/**
 * Rate chain (ADR-004): in-memory cache → live provider → last good table in the database
 * (CACHED) → seeded or built-in table (FALLBACK). Concurrent callers share one refresh.
 */
@Injectable()
export class FxRatesService implements FxRatesPort {
  private readonly logger = new Logger(FxRatesService.name);
  private cached: { table: RateTable; expiresAt: number } | undefined;
  private refreshing: Promise<RateTable> | undefined;

  constructor(
    @Inject(FX_RATE_PROVIDER) private readonly provider: FxRateProvider,
    @Inject(FX_RATE_STORE) private readonly store: FxRateStore,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FX_CACHE_CONFIG) private readonly config: FxCacheConfig,
  ) {}

  async current(): Promise<RateTable> {
    if (this.cached !== undefined && this.now() < this.cached.expiresAt) {
      return this.cached.table;
    }
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = undefined;
    });
    return await this.refreshing;
  }

  private async refresh(): Promise<RateTable> {
    const now = this.now();
    try {
      const live = await this.provider.fetchUsdRates();
      const table = RateTable.create(live.unitsPerUsd, 'LIVE', live.fetchedAt);
      const next = live.nextRefreshAt?.getTime();
      const ttlEnd = now + this.config.ttlMs;
      this.cached = {
        table,
        expiresAt: next !== undefined && next > now ? Math.min(ttlEnd, next) : ttlEnd,
      };
      await this.store.saveLive(live).catch((error: unknown) => {
        this.logger.warn(`Could not persist live FX rates: ${String(error)}`);
      });
      return table;
    } catch (error) {
      this.logger.warn(`FX provider unavailable, using fallback rates: ${String(error)}`);
      const table = await this.fallback();
      this.cached = { table, expiresAt: now + this.config.failureTtlMs };
      return table;
    }
  }

  private async fallback(): Promise<RateTable> {
    const stored = await this.store.load().catch((error: unknown) => {
      this.logger.warn(`Could not load stored FX rates: ${String(error)}`);
      return undefined;
    });
    if (stored !== undefined) {
      const source = stored.source === 'LIVE' ? 'CACHED' : 'FALLBACK';
      return RateTable.create(stored.unitsPerUsd, source, stored.fetchedAt);
    }
    return RateTable.create(FALLBACK_UNITS_PER_USD, 'FALLBACK', FALLBACK_FETCHED_AT);
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
