// Conventional Commits + no attribution trailers.
// Install: yarn add -D @commitlint/cli @commitlint/config-conventional husky && yarn husky init
// .husky/commit-msg:  yarn commitlint --edit "$1"
export default {
  extends: ['@commitlint/config-conventional'],
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
    'trailer-exists': [2, 'never', 'Co-Authored-By:'],
  },
};
