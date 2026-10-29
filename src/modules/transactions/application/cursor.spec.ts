import { decodeCursor, encodeCursor } from './cursor.js';

describe('history cursor', () => {
  const position = {
    createdAt: new Date('2026-10-29T12:34:56.789Z'),
    id: '019a3b5d-0a1b-7c2d-8e3f-4a5b6c7d8e9f',
  };

  it('round-trips the position exactly (millisecond timestamps)', () => {
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('is opaque and URL-safe', () => {
    expect(encodeCursor(position)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    'not-base64!',
    Buffer.from('2026-10-29T12:34:56.789Z').toString('base64url'),
    Buffer.from('yesterday|019a3b5d-0a1b-7c2d-8e3f-4a5b6c7d8e9f').toString('base64url'),
    Buffer.from('2026-10-29T12:34:56.789Z|not-a-uuid').toString('base64url'),
  ])('returns undefined for a malformed cursor %j', (cursor) => {
    expect(decodeCursor(cursor)).toBeUndefined();
  });
});
