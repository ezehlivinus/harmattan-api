import { envSchema } from './env.schema.js';

const DATABASE_URL = 'postgres://harmattan:harmattan@localhost:5432/harmattan';

describe('envSchema', () => {
  it('applies defaults when optional variables are absent', () => {
    expect(envSchema.parse({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
    });
  });

  it('coerces PORT from string to number', () => {
    expect(envSchema.parse({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['0', '65536', 'abc', '3000.5'])('rejects PORT=%s', (port) => {
    expect(envSchema.safeParse({ DATABASE_URL, PORT: port }).success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(envSchema.safeParse({ DATABASE_URL, NODE_ENV: 'staging' }).success).toBe(false);
  });

  it('requires DATABASE_URL', () => {
    expect(envSchema.safeParse({}).success).toBe(false);
  });

  it.each(['postgresql://localhost/harmattan', DATABASE_URL])('accepts DATABASE_URL=%s', (url) => {
    expect(envSchema.safeParse({ DATABASE_URL: url }).success).toBe(true);
  });

  it.each(['mysql://localhost/harmattan', 'localhost:5432', ''])(
    'rejects DATABASE_URL=%s',
    (url) => {
      expect(envSchema.safeParse({ DATABASE_URL: url }).success).toBe(false);
    },
  );
});
