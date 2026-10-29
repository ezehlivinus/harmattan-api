/** Keyset position in a wallet's history: rows strictly older than this come next. */
export interface HistoryPosition {
  createdAt: Date;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Opaque, URL-safe cursor: base64url of `<ISO createdAt>|<id>`. */
export function encodeCursor(position: HistoryPosition): string {
  return Buffer.from(`${position.createdAt.toISOString()}|${position.id}`).toString('base64url');
}

/** The position in `cursor`, or undefined when it is not a cursor this API issued. */
export function decodeCursor(cursor: string): HistoryPosition | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return undefined;
  const [iso, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (iso === undefined || id === undefined || rest.length > 0 || !UUID.test(id)) return undefined;
  const createdAt = new Date(iso);
  // Only exact ISO strings round-trip, which rejects "yesterday" and partial dates.
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== iso) return undefined;
  return { createdAt, id };
}
