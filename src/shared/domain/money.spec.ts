import { CurrencyMismatchError, InvalidAmountError } from './errors.js';
import { Money } from './money.js';

describe('Money', () => {
  describe('of: parses a decimal string', () => {
    it.each([
      ['0', '0.000000'],
      ['1', '1.000000'],
      ['1500.25', '1500.250000'],
      ['0.000001', '0.000001'],
      ['1500.250000', '1500.250000'],
      ['99999999999999999999999999999999.999999', '99999999999999999999999999999999.999999'],
    ])('accepts %s', (input, expected) => {
      expect(Money.of(input, 'cNGN').toString()).toBe(expected);
    });

    it.each([
      ['-1', 'negative'],
      ['1e3', 'exponent'],
      ['1E3', 'exponent'],
      ['1.0000001', 'more than 6 decimal places'],
      [' 5', 'leading whitespace'],
      ['5 ', 'trailing whitespace'],
      ['', 'empty'],
      ['.5', 'missing integer part'],
      ['5.', 'missing fraction digits'],
      ['01', 'leading zero'],
      ['+1', 'plus sign'],
      ['1,000', 'thousands separator'],
      ['0x10', 'hex'],
      ['NaN', 'NaN'],
      ['Infinity', 'Infinity'],
      ['100000000000000000000000000000000', 'more than 32 integer digits (numeric(38,6))'],
    ])('rejects %s (%s)', (input) => {
      expect(() => Money.of(input, 'cNGN')).toThrow(InvalidAmountError);
    });

    it.each([[1500], [1e3], [null], [undefined], [{}]])('rejects non-string %s', (input) => {
      expect(() => Money.of(input, 'cNGN')).toThrow(InvalidAmountError);
    });
  });

  describe('positive: request amounts must be greater than zero', () => {
    it('accepts the smallest unit', () => {
      expect(Money.positive('0.000001', 'USDx').toString()).toBe('0.000001');
    });

    it.each(['0', '0.000000'])('rejects %s', (input) => {
      expect(() => Money.positive(input, 'USDx')).toThrow(InvalidAmountError);
    });
  });

  describe('arithmetic is exact', () => {
    it('adds without floating-point error', () => {
      const sum = Money.of('0.1', 'USDx').add(Money.of('0.2', 'USDx'));

      expect(sum.toString()).toBe('0.300000');
    });

    it('subtracts down to zero', () => {
      const rest = Money.of('10', 'USDx').subtract(Money.of('10', 'USDx'));

      expect(rest.isZero()).toBe(true);
    });

    it('refuses to go negative', () => {
      expect(() => Money.of('1', 'USDx').subtract(Money.of('1.000001', 'USDx'))).toThrow(
        InvalidAmountError,
      );
    });

    it('refuses to overflow numeric(38,6)', () => {
      const max = Money.of('99999999999999999999999999999999.999999', 'USDx');

      expect(() => max.add(Money.of('0.000001', 'USDx'))).toThrow(InvalidAmountError);
    });

    it.each([
      ['add', (a: Money, b: Money) => a.add(b)],
      ['subtract', (a: Money, b: Money) => a.subtract(b)],
      ['compareTo', (a: Money, b: Money) => a.compareTo(b)],
    ])('%s rejects mixed currencies', (_name, op) => {
      expect(() => op(Money.of('1', 'USDx'), Money.of('1', 'EURx'))).toThrow(CurrencyMismatchError);
    });
  });

  describe('convert: dest = roundDown(source × rate, 6)', () => {
    it('converts with the exact rate', () => {
      const usd = Money.of('1000', 'cNGN').convert('0.000625', 'USDx');

      expect(usd.currency).toBe('USDx');
      expect(usd.toString()).toBe('0.625000');
    });

    it('rounds down, never up', () => {
      // 1 × 0.6666669 = 0.6666669 → 0.666666 (round half-up would give 0.666667)
      expect(Money.of('1', 'USDx').convert('0.6666669', 'EURx').toString()).toBe('0.666666');
    });

    it('keeps all 18 rate decimals before rounding', () => {
      // 1000000 × 0.000000000000000001 = 0.000000000001 → rounds down to 0
      expect(Money.of('1000000', 'cNGN').convert('0.000000000000000001', 'USDx').isZero()).toBe(
        true,
      );
      // 1234.5678 × 1.000000000000000009 = 1234.56780000000000001111... → 1234.567800
      expect(Money.of('1234.5678', 'cGHS').convert('1.000000000000000009', 'cXAF').toString()).toBe(
        '1234.567800',
      );
    });

    it('handles the largest amount × a large rate without losing integer digits', () => {
      const result = Money.of('12345678901234567890.123456', 'cXAF').convert('655.957', 'EURx');

      expect(result.toString()).toBe('8098234495017123449501.711827');
    });

    it.each(['0', '-1', '1e3', 'abc', '1.0000000000000000001'])('rejects rate %s', (rate) => {
      expect(() => Money.of('1', 'USDx').convert(rate, 'EURx')).toThrow(InvalidAmountError);
    });
  });

  describe('comparison', () => {
    it('orders amounts of the same currency', () => {
      const small = Money.of('1.5', 'cGHS');
      const big = Money.of('1.500001', 'cGHS');

      expect(small.compareTo(big)).toBe(-1);
      expect(big.compareTo(small)).toBe(1);
      expect(small.compareTo(Money.of('1.500000', 'cGHS'))).toBe(0);
      expect(big.isGreaterThan(small)).toBe(true);
    });

    it('treats equal value and currency as equal', () => {
      expect(Money.of('2', 'EURx').equals(Money.of('2.000000', 'EURx'))).toBe(true);
      expect(Money.of('2', 'EURx').equals(Money.of('2', 'USDx'))).toBe(false);
    });
  });
});
