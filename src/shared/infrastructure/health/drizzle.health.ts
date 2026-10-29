import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { Database } from '../database/database.js';

/** Terminus has no built-in Drizzle indicator; this follows its custom-indicator recipe. */
@Injectable()
export class DrizzleHealthIndicator {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /** `up` if `select 1` answers within `timeoutMs`, otherwise `down`. */
  async pingCheck<const Key extends string>(
    key: Key,
    timeoutMs = 1000,
  ): Promise<HealthIndicatorResult<Key>> {
    return await this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.db.execute(sql`select 1`);
      })
      .withTimeout(timeoutMs);
  }
}
