import { z } from 'zod';

/** Environment variables, validated once at boot by `ConfigModule`. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  FX_API_URL: z.url().default('https://open.er-api.com/v6/latest/USD'),
  FX_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  /** The provider refreshes daily and rate-limits more than about hourly (ADR-004). */
  FX_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  FX_FAILURE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;
