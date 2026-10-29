// @ts-check
// Conventional Commits + no co-author trailers. Runs from .husky/commit-msg.

/** Built-in `trailer-exists` is case-sensitive; this also catches `Co-authored-by:`. */
const noCoAuthorTrailer = (/** @type {{ raw?: string }} */ parsed) => {
  const found = /^co-authored-by:/im.test(parsed.raw ?? '');
  return /** @type {const} */ ([!found, 'message must not have a Co-Authored-By trailer']);
};

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [{ rules: { 'no-co-author-trailer': noCoAuthorTrailer } }],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'wallets',
        'fx',
        'payments',
        'transactions',
        'shared',
        'db',
        'docker',
        'deps',
        'config',
        'api',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 72],
    'no-co-author-trailer': [2, 'always'],
  },
};
