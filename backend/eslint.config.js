import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Express error handlers must keep the 4-argument signature.
      'no-unused-vars': ['error', { argsIgnorePattern: '^(_|next$)', caughtErrors: 'none' }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  // Formatting is Prettier's job - switch off the rules that would fight it.
  prettier,
];
