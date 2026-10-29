// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'node_modules/', '.yarn/']),
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Nest modules are empty classes carrying a decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Every promise is awaited explicitly: functions returning a promise are `async`,
      // and returned promises are `return await`ed (complete stack traces, correct try/catch).
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/return-await': ['error', 'always'],
      // `import type` on constructor-injected classes breaks Nest DI (emitDecoratorMetadata).
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // Clean Architecture: the domain layer stays framework-free.
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', 'drizzle-orm', 'drizzle-orm/*', 'express', 'pg'],
              message: 'Domain code must not depend on frameworks, the ORM or HTTP.',
            },
            {
              group: ['**/infrastructure/**', '**/presentation/**', '**/application/**'],
              message: 'Domain code must not import outer layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    languageOptions: { globals: { ...globals.vitest } },
    rules: {
      // Passing mock methods to expect() is idiomatic in tests.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  prettier,
);
