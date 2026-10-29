import { ParseError, parsePhoneNumberWithError } from 'libphonenumber-js/max';
import { InvalidPhoneNumberError } from './errors.js';

/** Numbers without a country code are read as Nigerian. */
const DEFAULT_REGION = 'NG';

/**
 * Phone number in E.164 (e.g. `+2348012345678`), so `0801 234 5678` and `+234 801 234 5678` are
 * the same wallet. Validated against full numbering-plan metadata (`libphonenumber-js/max`).
 */
export class PhoneNumber {
  private constructor(readonly value: string) {}

  static parse(input: string): PhoneNumber {
    try {
      const parsed = parsePhoneNumberWithError(input, DEFAULT_REGION);
      if (parsed.isValid()) {
        return new PhoneNumber(parsed.number);
      }
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
    }
    throw new InvalidPhoneNumberError('Invalid phone number', { phone: input });
  }
}
