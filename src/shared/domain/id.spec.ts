import { newId } from './id.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  it('returns an RFC 9562 version 7 UUID', () => {
    expect(newId()).toMatch(UUID_V7);
  });

  it('embeds the creation time, so ids sort by time across milliseconds', async () => {
    const first = newId();
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = newId();

    expect(first < second).toBe(true);
  });
});
