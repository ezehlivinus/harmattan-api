import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Env } from '../config/env.schema.js';
import { UNIT_OF_WORK } from '../../application/unit-of-work.js';
import { DB_CASING } from './database.js';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work.js';
import * as schema from './schema/index.js';

/** Global: every feature module can inject `UNIT_OF_WORK`. */
@Global()
@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        drizzle,
        connection: config.get('DATABASE_URL', { infer: true }),
        schema,
        casing: DB_CASING,
      }),
    }),
  ],
  providers: [{ provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork }],
  exports: [UNIT_OF_WORK],
})
export class DatabaseModule {}
