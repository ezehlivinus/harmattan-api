import type { INestApplication } from '@nestjs/common';

export const API_PREFIX = 'v1';

/** HTTP setup shared by main.ts, e2e tests and the OpenAPI generator. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
}
