import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema.js';

export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validationSchema: envSchema,
});
