import { currencyCode, decimalAmount } from './schemas.js';

describe('request schemas', () => {
  describe('decimalAmount', () => {
    it.each(['1500.25', '0.000001', '1', '99999999999999999999999999999999.999999'])(
      'accepts %s',
      (value) => {
        expect(decimalAmount.safeParse(value)).toEqual({ success: true, data: value });
      },
    );

    it.each([
      ['0', 'zero'],
      ['0.000000', 'zero with decimals'],
      ['-1', 'negative'],
      ['1e3', 'exponent'],
      ['1.0000001', 'more than 6 decimals'],
      [' 5', 'whitespace'],
      ['', 'empty'],
      [1500, 'a JSON number'],
      [null, 'null'],
    ])('rejects %j (%s)', (value, _reason) => {
      expect(decimalAmount.safeParse(value).success).toBe(false);
    });
  });

  describe('currencyCode', () => {
    it('accepts a supported stablecoin', () => {
      expect(currencyCode.parse('cNGN')).toBe('cNGN');
    });

    it.each(['NGN', 'usdx', ''])('rejects %j', (value) => {
      expect(currencyCode.safeParse(value).success).toBe(false);
    });
  });
});
