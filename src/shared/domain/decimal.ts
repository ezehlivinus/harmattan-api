// Named import: the default import types as the CJS module object under nodenext.
import { Decimal } from 'decimal.js';

/**
 * Private Decimal constructor for all money and rate math: never touches decimal.js global
 * config. 100 significant digits covers numeric(38,6) × numeric(38,18) exactly; ROUND_DOWN is
 * the only rounding mode used.
 */
export const Dec = Decimal.clone({ precision: 100, rounding: Decimal.ROUND_DOWN });

export type { Decimal };
export const ROUND_DOWN = Decimal.ROUND_DOWN;
