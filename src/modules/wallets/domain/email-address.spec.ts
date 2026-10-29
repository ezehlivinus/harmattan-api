import { InvalidEmailError } from './errors.js';
import { EmailAddress } from './email-address.js';

describe('EmailAddress', () => {
  it.each([
    ['ada@example.com', 'ada@example.com'],
    ['Ada.Lovelace@Example.COM', 'ada.lovelace@example.com'],
    ['  ada@example.com  ', 'ada@example.com'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(EmailAddress.parse(input).value).toBe(expected);
  });

  it.each(['', '   ', 'ada', 'ada@', '@example.com', 'ada@example', 'a da@example.com'])(
    'rejects %j',
    (input) => {
      expect(() => EmailAddress.parse(input)).toThrow(InvalidEmailError);
    },
  );
});
