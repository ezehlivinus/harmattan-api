import { RateTable } from './rate-table.js';

const units = { USDx: '1', cNGN: '1600', cGHS: '12.5', cXAF: '600', EURx: '0.9' } as const;
const AT = new Date('2026-10-29T00:02:31.000Z');

describe('RateTable', () => {
  const table = RateTable.create(units, 'LIVE', AT);

  it('derives cross rates through USD: A→B = perUsd[B] / perUsd[A]', () => {
    expect(table.rate('USDx', 'cNGN')).toBe('1600.000000000000000000');
    expect(table.rate('cNGN', 'USDx')).toBe('0.000625000000000000');
    expect(table.rate('cNGN', 'cGHS')).toBe('0.007812500000000000');
  });

  it('truncates (never rounds up) to 18 decimal places', () => {
    // 12.5 / 600 = 0.0208333... → 0.020833333333333333
    expect(table.rate('cXAF', 'cGHS')).toBe('0.020833333333333333');
    // 0.9 / 600 = 0.0015 exactly
    expect(table.rate('cXAF', 'EURx')).toBe('0.001500000000000000');
  });

  it('uses exactly 1 for the same currency', () => {
    expect(table.rate('EURx', 'EURx')).toBe('1.000000000000000000');
  });

  it('keeps source and refresh time, and can relabel the source', () => {
    expect([table.source, table.fetchedAt]).toEqual(['LIVE', AT]);
    expect(table.withSource('CACHED').source).toBe('CACHED');
    expect(table.withSource('CACHED').rate('USDx', 'cNGN')).toBe(table.rate('USDx', 'cNGN'));
  });

  it.each([
    ['zero', { ...units, cGHS: '0' }],
    ['negative', { ...units, cGHS: '-1' }],
    ['not a number', { ...units, cGHS: 'abc' }],
  ])('rejects a %s units-per-USD value', (_name, bad) => {
    expect(() => RateTable.create(bad, 'LIVE', AT)).toThrow(/units per USD/);
  });
});
