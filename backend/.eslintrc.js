/**
 * backend/.eslintrc.js
 *
 * Shared ESLint configuration for ALL SPIS backend services.
 * Covers: base/, iam-service/, family-service/, email-service/, programme-service/
 *
 * Run from backend root:
 *   npm run lint          — report issues (no changes)
 *   npm run lint:fix      — auto-fix what ESLint can
 *   npm run eslint        — alias for lint:fix
 *
 * Rules are grouped by purpose. Severity:
 *   'error'   — blocks CI, must be fixed
 *   'warn'    — visible in editor, must be reviewed before merge
 *   'off'     — disabled
 */

'use strict'

module.exports = {
  root: true,

  env: {
    node:   true,
    es2022: true,
  },

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType:  'module',
  },

  plugins: ['import'],

  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '.nyc_output/',
    '.eslintrc.js',
  ],

  rules: {

    // ─── ARCHITECTURE GUARDS ────────────────────────────────────────────────
    // Catch the most common 4-layer violations at lint time.

    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
        message:  'Use BaseService.generateUUID() instead of crypto.randomUUID().',
      },
      {
        selector: "ImportDeclaration[source.value='uuid'] > ImportSpecifier[imported.name='v4']",
        message:  'Import uuidv4 only in base/baseService.js. Use BaseService.generateUUID() everywhere else.',
      },
    ],

    // ─── CODE QUALITY ───────────────────────────────────────────────────────

    'no-unused-vars': ['error', {
      vars:               'all',
      args:               'after-used',
      argsIgnorePattern:  '^_',
      ignoreRestSiblings: true,
    }],
    'no-var':              'error',
    'prefer-const':        ['error', { destructuring: 'all' }],
    'no-undef':            'error',
    'eqeqeq':             ['error', 'always', { null: 'ignore' }],
    'curly':               ['error', 'multi-line'],
    'block-scoped-var':    'error',
    'no-else-return':      ['error', { allowElseIf: false }],
    'consistent-return':   'warn',
    'no-dupe-keys':        'error',
    'no-unreachable':      'error',
    'no-debugger':         'error',
    'no-floating-decimal': 'error',
    'prefer-template':     'warn',
    'require-await':       'warn',
    'prefer-promise-reject-errors': ['error', { allowEmptyReject: true }],

    // Use structured logger (this.log) — not console.log
    'no-console': ['error', { allow: ['warn', 'error'] }],

    // ─── FUNCTION COMPLEXITY ────────────────────────────────────────────────

    'max-params':                   ['error', { max: 10 }],
    'max-statements-per-line':      ['warn', { max: 1 }],
    'one-var':                      ['warn', 'never'],
    'one-var-declaration-per-line': ['error', 'always'],

    // ─── STYLE / FORMATTING ────────────────────────────────────────────────

    // Semicolons — none (ASI)
    'semi': ['error', 'never'],

    // Single quotes
    'quotes': ['error', 'single', { avoidEscape: true }],

    // 2-space indentation
    'indent': ['error', 2, { SwitchCase: 1 }],

    // Brace style — 1tbs (opening brace on same line)
    'brace-style': ['error', '1tbs'],

    // camelCase is a convention enforced by code review, NOT by ESLint.
    // Turning this off prevents any risk of ESLint renaming variables.
    'camelcase': 'off',

    // No trailing whitespace
    'no-trailing-spaces': ['error', { skipBlankLines: false }],

    // Newline at end of file
    'eol-last': ['error', 'always'],

    // Object spacing: { key: val }
    'object-curly-spacing': ['error', 'always'],

    // Array spacing: no spaces inside []
    'array-bracket-spacing': ['error', 'never'],

    // Trailing comma — multiline only
    'comma-dangle': ['error', 'only-multiline'],

    // Space before function parens
    'space-before-function-paren': ['error', {
      anonymous:  'never',
      named:      'never',
      asyncArrow: 'always',
    }],

    // Max line length — 120 chars (URLs, strings, templates exempt)
    'max-len': ['warn', {
      code:                   120,
      ignoreUrls:             true,
      ignoreStrings:          true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals:   true,
    }],

    // ─── IMPORTS ────────────────────────────────────────────────────────────

    'no-duplicate-imports': 'error',

    // .js extension required for ESM imports
    'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
  },

  overrides: [
    // ─── Test files ──────────────────────────────────────────────────────────
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.js'],
      env:   { jest: true },
      rules: {
        'no-console':    'off',
        'require-await': 'off',
      },
    },
    // ─── Migration files ─────────────────────────────────────────────────────
    {
      files: ['**/migrations/**/*.js'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
    // ─── Base layer — baseService.js ─────────────────────────────────────────
    {
      files: ['base/baseService.js'],
      rules: {
        // baseService is the ONLY file allowed to import uuidv4
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
            message:  'Use uuidv4().toUpperCase() inside BaseService, not crypto.randomUUID().',
          },
        ],
      },
    },
  ],
}
