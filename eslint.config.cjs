const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**'] },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: globals.node
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error'
    }
  },
  {
    // Abstract method signatures document the contract; implementations consume the arguments.
    files: [
      'src/services/messaging/messagingAdapter.js',
      'src/services/conversation/dialogManager.js'
    ],
    rules: { 'no-unused-vars': ['error', { args: 'none' }] }
  },
  {
    // Express identifies error middleware by its four-argument function signature.
    files: ['src/middleware/errorHandler.js'],
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^next$' }] }
  }
];
