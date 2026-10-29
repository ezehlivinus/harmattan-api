import { readFile } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  buildOpenApiDocument,
  setupSwagger,
} from '../../src/shared/infrastructure/http/swagger.js';
import { createTestApp } from '../helpers/app.js';

describe('OpenAPI (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
    setupSwagger(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the spec at /docs/openapi.json', async () => {
    const res = await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);

    expect(res.body).toHaveProperty('openapi');
    expect(res.body).toHaveProperty(['paths', '/health', 'get']);
  });

  it('matches the committed openapi.json (run `yarn openapi` after API changes)', async () => {
    const committed: unknown = JSON.parse(await readFile('openapi.json', 'utf8'));

    expect(buildOpenApiDocument(app)).toEqual(committed);
  });
});
