import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../shared/infrastructure/config/env.schema.js';
import { FX_RATES } from './application/fx-rates.port.js';
import {
  FX_CACHE_CONFIG,
  type FxCacheConfig,
  FxRatesService,
} from './application/fx-rates.service.js';
import { FX_RATE_PROVIDER } from './application/ports/fx-rate.provider.js';
import { FX_RATE_STORE } from './application/ports/fx-rate.store.js';
import { GetRatesHandler } from './application/queries/get-rates/get-rates.handler.js';
import { DrizzleFxRateStore } from './infrastructure/drizzle-fx-rate.store.js';
import { ErApiFxProvider } from './infrastructure/er-api-fx.provider.js';
import { type ErApiConfig, FX_HTTP_FETCH, FX_PROVIDER_CONFIG } from './infrastructure/fx.tokens.js';
import { FxController } from './presentation/fx.controller.js';

@Module({
  controllers: [FxController],
  providers: [
    GetRatesHandler,
    { provide: FX_HTTP_FETCH, useValue: fetch },
    {
      provide: FX_PROVIDER_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): ErApiConfig => ({
        url: config.get('FX_API_URL', { infer: true }),
        timeoutMs: config.get('FX_TIMEOUT_MS', { infer: true }),
      }),
    },
    {
      provide: FX_CACHE_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): FxCacheConfig => ({
        ttlMs: config.get('FX_CACHE_TTL_SECONDS', { infer: true }) * 1000,
        failureTtlMs: config.get('FX_FAILURE_CACHE_TTL_SECONDS', { infer: true }) * 1000,
      }),
    },
    { provide: FX_RATE_PROVIDER, useClass: ErApiFxProvider },
    { provide: FX_RATE_STORE, useClass: DrizzleFxRateStore },
    { provide: FX_RATES, useClass: FxRatesService },
  ],
  exports: [FX_RATES],
})
export class FxModule {}
