import { DrizzleQueryError } from 'drizzle-orm/errors';
import { PgErrorCode, pgErrorOf } from './pg-error.js';

const pgError = (code: string, constraint?: string) =>
  Object.assign(new Error('pg'), { code, constraint });

describe('pgErrorOf', () => {
  it('reads code and constraint from the driver error Drizzle wraps in `cause`', () => {
    const wrapped = new DrizzleQueryError(
      'insert ...',
      [],
      pgError('23505', 'wallets_email_unique'),
    );

    expect(pgErrorOf(wrapped)).toEqual({ code: '23505', constraint: 'wallets_email_unique' });
  });

  it('reads an unwrapped driver error (direct pg client use)', () => {
    expect(pgErrorOf(pgError(PgErrorCode.DEADLOCK_DETECTED))).toEqual({
      code: '40P01',
      constraint: undefined,
    });
  });

  it.each([new Error('plain'), 'text', null, undefined, { code: 42 }])(
    'returns undefined for %j',
    (error) => {
      expect(pgErrorOf(error)).toBeUndefined();
    },
  );
});
