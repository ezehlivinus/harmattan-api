import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, type HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { DrizzleHealthIndicator } from './drizzle.health.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DrizzleHealthIndicator,
  ) {}

  @Get()
  // Documents 200/503 in Swagger and sets Cache-Control: no-cache.
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness and database connectivity check' })
  async check(): Promise<HealthCheckResult> {
    return await this.health.check([async () => await this.database.pingCheck('database')]);
  }
}
