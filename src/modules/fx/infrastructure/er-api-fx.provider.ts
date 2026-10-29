import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CURRENCIES } from '../../../shared/domain/currency.js';
import { Dec } from '../../../shared/domain/decimal.js';
import {
  FxProviderError,
  type FxRateProvider,
  type LiveRates,
} from '../application/ports/fx-rate.provider.js';
import { FIAT_CODE } from '../domain/fiat.js';
import { type ErApiConfig, FX_HTTP_FETCH, FX_PROVIDER_CONFIG } from './fx.tokens.js';

const errorBody = z.object({ result: z.literal('error'), 'error-type': z.string().optional() });

// Numbers arrive as their source text (see `numbersAsSourceText`), hence the coercions.
const successBody = z.object({
  result: z.literal('success'),
  base_code: z.literal('USD'),
  time_last_update_unix: z.coerce.number().int().positive(),
  time_next_update_unix: z.coerce.number().int().positive().optional(),
  rates: z.record(z.string(), z.string()),
});

/**
 * JSON.parse reviver that replaces every number with its exact source text (Node ≥ 21), so rates
 * never pass through a float: `0.8972150000000000055511151231257827` stays exact.
 */
function numbersAsSourceText(_key: string, value: unknown, context?: { source?: string }): unknown {
  return typeof value === 'number' && context?.source !== undefined ? context.source : value;
}

/**
 * open.er-api.com (free, no key, USD base, refreshed daily). Errors come back as HTTP 200 with
 * `result: "error"`; rate limiting is HTTP 429. Rates are credited as "Rates By Exchange Rate API".
 */
@Injectable()
export class ErApiFxProvider implements FxRateProvider {
  constructor(
    @Inject(FX_HTTP_FETCH) private readonly fetchFn: typeof fetch,
    @Inject(FX_PROVIDER_CONFIG) private readonly config: ErApiConfig,
  ) {}

  async fetchUsdRates(): Promise<LiveRates> {
    const text = await this.download();
    let raw: unknown;
    try {
      raw = JSON.parse(text, numbersAsSourceText);
    } catch (error) {
      throw new FxProviderError('FX provider returned invalid JSON', { cause: error });
    }
    const failure = errorBody.safeParse(raw);
    if (failure.success) {
      throw new FxProviderError(`FX provider error: ${failure.data['error-type'] ?? 'unknown'}`);
    }
    const parsed = successBody.safeParse(raw);
    if (!parsed.success) {
      throw new FxProviderError(
        `Unexpected FX provider response: ${z.prettifyError(parsed.error)}`,
      );
    }
    const { rates, time_last_update_unix, time_next_update_unix } = parsed.data;
    const unitsPerUsd = Object.fromEntries(
      CURRENCIES.map((currency) => [currency, this.unitsPerUsd(rates, FIAT_CODE[currency])]),
    ) as LiveRates['unitsPerUsd'];
    return {
      unitsPerUsd,
      fetchedAt: new Date(time_last_update_unix * 1000),
      nextRefreshAt:
        time_next_update_unix === undefined ? null : new Date(time_next_update_unix * 1000),
    };
  }

  private async download(): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchFn(this.config.url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new FxProviderError(`FX provider request failed: ${reason}`, { cause: error });
    }
    if (!response.ok) {
      throw new FxProviderError(`FX provider answered HTTP ${response.status}`);
    }
    return await response.text();
  }

  private unitsPerUsd(rates: Record<string, string>, fiat: string): string {
    const source = rates[fiat];
    if (source === undefined) {
      throw new FxProviderError(`FX provider has no rate for ${fiat}`);
    }
    // Normalizes exponent notation (5.8852908e2 → 588.52908) without losing digits.
    const value = /^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(source) ? new Dec(source) : undefined;
    if (value === undefined || value.isZero()) {
      throw new FxProviderError(`FX provider returned an invalid rate for ${fiat}: ${source}`);
    }
    return value.toFixed();
  }
}
