import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Env } from '../config/env.schema.js';
import { DB_CASING } from './database.js';
import * as schema from './schema/index.js';

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
})
export class DatabaseModule {}
