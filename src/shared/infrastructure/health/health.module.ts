import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DrizzleHealthIndicator } from './drizzle.health.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [TerminusModule.forRoot()],
  controllers: [HealthController],
  providers: [DrizzleHealthIndicator],
})
export class HealthModule {}
