import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const DOCS_PATH = 'docs';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Harmattan API')
    .setDescription(
      'Stablecoin cross-border payment sandbox: multi-currency wallets, deposits, FX swaps, ' +
        'cross-currency transfers and transaction history.',
    )
    .setVersion('1.0.0')
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Serves Swagger UI at /docs and the raw spec at /docs/openapi.json. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(DOCS_PATH, app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: `${DOCS_PATH}/openapi.json`,
    raw: ['json'],
  });
}
