import { CURRENCIES } from '../../../shared/domain/currency.js';
import { newId } from '../../../shared/domain/id.js';
import { Money } from '../../../shared/domain/money.js';
import { EmailAddress } from './email-address.js';
import { ContactRequiredError } from './errors.js';
import { PhoneNumber } from './phone-number.js';

/** A multi-currency wallet, identified by an email, a phone number or both (each unique). */
export class Wallet {
  private constructor(
    readonly id: string,
    readonly email: EmailAddress | null,
    readonly phone: PhoneNumber | null,
    readonly createdAt: Date,
  ) {}

  static create(contact: { email?: string; phone?: string }, now: Date): Wallet {
    const email = contact.email === undefined ? null : EmailAddress.parse(contact.email);
    const phone = contact.phone === undefined ? null : PhoneNumber.parse(contact.phone);
    if (email === null && phone === null) {
      throw new ContactRequiredError();
    }
    return new Wallet(newId(), email, phone, now);
  }

  /** A new wallet holds zero of every supported currency. */
  openingBalances(): Money[] {
    return CURRENCIES.map((currency) => Money.zero(currency));
  }
}
