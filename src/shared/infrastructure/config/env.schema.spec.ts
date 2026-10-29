import { envSchema } from './env.schema.js';

describe('envSchema', () => {
  it('applies defaults when variables are absent', () => {
    expect(envSchema.parse({})).toEqual({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('coerces PORT from string to number', () => {
    expect(envSchema.parse({ PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['0', '65536', 'abc', '3000.5'])('rejects PORT=%s', (port) => {
    expect(envSchema.safeParse({ PORT: port }).success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(envSchema.safeParse({ NODE_ENV: 'staging' }).success).toBe(false);
  });
});
