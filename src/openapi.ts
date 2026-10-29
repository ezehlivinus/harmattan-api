// Writes the OpenAPI spec to openapi.json without a database: the pg pool connects lazily
// and no query runs. Run with `yarn openapi`.
import { writeFile } from 'node:fs/promises';

process.env.DATABASE_URL ??= 'postgres://openapi:openapi@localhost:5432/openapi';

// Imported after DATABASE_URL is set: ConfigModule validates the env when AppModule loads.
const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('./app.module.js');
const { configureApp } = await import('./shared/infrastructure/http/configure-app.js');
const { buildOpenApiDocument } = await import('./shared/infrastructure/http/swagger.js');

const app = await NestFactory.create(AppModule, { logger: ['error'] });
configureApp(app);
await writeFile('openapi.json', `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
await app.close();
console.log('Wrote openapi.json');
