import { HealthIndicatorService } from '@nestjs/terminus';
import type { Database } from '../database/database.js';
import { DrizzleHealthIndicator } from './drizzle.health.js';

const indicatorWith = (execute: () => Promise<unknown>) =>
  new DrizzleHealthIndicator({ execute } as unknown as Database, new HealthIndicatorService());

describe('DrizzleHealthIndicator', () => {
  it('is up when the database answers', async () => {
    const result = await indicatorWith(async () => await Promise.resolve({ rows: [] })).pingCheck(
      'database',
    );

    expect(result).toMatchObject({ database: { status: 'up' } });
  });

  it('is down when the query fails', async () => {
    const result = await indicatorWith(
      async () => await Promise.reject(new Error('connection refused')),
    ).pingCheck('database');

    expect(result).toMatchObject({ database: { status: 'down' } });
  });

  it('is down when the database does not answer within the timeout', async () => {
    const result = await indicatorWith(async () => await new Promise(() => undefined)).pingCheck(
      'database',
      20,
    );

    expect(result).toMatchObject({ database: { status: 'down' } });
  });
});
