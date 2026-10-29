import { InvalidPhoneNumberError } from './errors.js';
import { PhoneNumber } from './phone-number.js';

describe('PhoneNumber', () => {
  it.each([
    ['08012345678', '+2348012345678'],
    ['0801 234 5678', '+2348012345678'],
    ['+234 801 234 5678', '+2348012345678'],
    ['+2348012345678', '+2348012345678'],
    ['+233 24 123 4567', '+233241234567'],
    ['+237 6 71 23 45 67', '+237671234567'],
    ['+1 202-555-0143', '+12025550143'],
  ])('normalizes %j to E.164 %j (default region NG)', (input, expected) => {
    expect(PhoneNumber.parse(input).value).toBe(expected);
  });

  it.each(['', 'abc', '0801234567', '+2340000000000', '12'])('rejects %j', (input) => {
    expect(() => PhoneNumber.parse(input)).toThrow(InvalidPhoneNumberError);
  });
});
