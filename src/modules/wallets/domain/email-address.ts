import { z } from 'zod';
import { InvalidEmailError } from './errors.js';

const emailFormat = z.email();

/** Email address, trimmed and lowercased so uniqueness ignores case and spacing. */
export class EmailAddress {
  private constructor(readonly value: string) {}

  static parse(input: string): EmailAddress {
    const normalized = input.trim().toLowerCase();
    if (!emailFormat.safeParse(normalized).success) {
      throw new InvalidEmailError('Invalid email address', { email: input });
    }
    return new EmailAddress(normalized);
  }
}
