import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './shared/infrastructure/config/env.schema.js';
import { configureApp } from './shared/infrastructure/http/configure-app.js';
import { setupSwagger } from './shared/infrastructure/http/swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);
  // Handle SIGTERM/SIGINT (container stop): close the HTTP server and the DB pool.
  app.enableShutdownHooks();
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
