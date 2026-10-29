import { CURRENCIES, isCurrency, parseCurrency } from './currency.js';
import { UnsupportedCurrencyError } from './errors.js';

describe('Currency', () => {
  it('supports exactly the five sandbox stablecoins', () => {
    expect(CURRENCIES).toEqual(['cNGN', 'cGHS', 'cXAF', 'USDx', 'EURx']);
  });

  it.each(['cNGN', 'cGHS', 'cXAF', 'USDx', 'EURx'])('recognises %s', (code) => {
    expect(isCurrency(code)).toBe(true);
    expect(parseCurrency(code)).toBe(code);
  });

  it.each(['NGN', 'cngn', 'USDX', 'usdx', 'BTC', '', ' cNGN'])(
    'rejects %s (case-sensitive)',
    (code) => {
      expect(isCurrency(code)).toBe(false);
      expect(() => parseCurrency(code)).toThrow(UnsupportedCurrencyError);
    },
  );
});
