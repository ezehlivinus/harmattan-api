import { CURRENCIES } from '../../../shared/domain/currency.js';
import { ContactRequiredError } from './errors.js';
import { Wallet } from './wallet.js';

const NOW = new Date('2026-10-29T12:00:00.000Z');

describe('Wallet', () => {
  it('is created with a normalized email, a UUIDv7 id and the given time', () => {
    const wallet = Wallet.create({ email: ' Ada@Example.com ' }, NOW);

    expect(wallet.email?.value).toBe('ada@example.com');
    expect(wallet.phone).toBeNull();
    expect(wallet.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(wallet.createdAt).toBe(NOW);
  });

  it('accepts a phone only, or both contacts', () => {
    expect(Wallet.create({ phone: '08012345678' }, NOW).phone?.value).toBe('+2348012345678');
    const both = Wallet.create({ email: 'a@example.com', phone: '08012345678' }, NOW);
    expect([both.email?.value, both.phone?.value]).toEqual(['a@example.com', '+2348012345678']);
  });

  it('requires an email or a phone', () => {
    expect(() => Wallet.create({}, NOW)).toThrow(ContactRequiredError);
  });

  it('opens a zero balance in every supported currency', () => {
    const balances = Wallet.create({ email: 'a@example.com' }, NOW).openingBalances();

    expect(balances.map((b) => b.currency)).toEqual([...CURRENCIES]);
    expect(balances.every((b) => b.toString() === '0.000000')).toBe(true);
  });
});
