import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { FX_HTTP_FETCH } from '../../src/modules/fx/infrastructure/fx.tokens.js';
import { configureApp } from '../../src/shared/infrastructure/http/configure-app.js';

/**
 * Boots the full application against the Testcontainers database, configured like main.ts.
 * `controllers` adds test-only routes; `fetch` stands in for the FX provider's HTTP calls.
 */
/** Tests never reach the real FX provider; by default the network looks down. */
const networkDisabled: typeof fetch = async () =>
  await Promise.reject(new TypeError('network disabled in tests'));

export async function createTestApp(
  options: { controllers?: Type[]; fetch?: typeof fetch } = {},
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(FX_HTTP_FETCH)
    .useValue(options.fetch ?? networkDisabled)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}
