import { Global, Module } from '@nestjs/common';
import { CLOCK, type Clock } from '../../application/clock.js';

const systemClock: Clock = { now: () => new Date() };

/** Global: every module can inject `CLOCK`. */
@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
