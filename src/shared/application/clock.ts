/** Source of the current time, injectable so tests are deterministic. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('Clock');
