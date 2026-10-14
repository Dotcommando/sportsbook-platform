import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.tmp/**',
      'data/**',
      '.serena/**',
      '.git/**',
      '.idea/**',
      '**/dist-test/**',
      '**/build/**',
      '**/generated/**',
      'plans/**',
      'experiments/results/**',
      'artifacts/**',
      '.temp/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.cjs', '**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
        project: path.join(__dirname, 'tsconfig.eslint.json'),
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'simple-import-sort': simpleImportSort,
      '@stylistic': stylistic,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      'padding-line-between-statements': 'off',
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: ['const', 'let', 'var'],
          next: '*',
        },
        {
          blankLine: 'never',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          prev: '*',
          next: ['if', 'for', 'while', 'switch', 'try', 'do'],
        },
        {
          blankLine: 'always',
          prev: 'if',
          next: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
        {
          blankLine: 'never',
          prev: 'if',
          next: 'if',
        },
        { blankLine: 'always', prev: { selector: 'Program > *' }, next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
      ],
      '@stylistic/lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: 'method', next: '*' },
            { blankLine: 'always', prev: '*', next: 'method' },
          ],
        },
        { exceptAfterSingleLine: false, exceptAfterOverload: false },
      ],
      '@stylistic/no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxBOF: 0,
          maxEOF: 1,
        },
      ],
      '@stylistic/keyword-spacing': [
        'error',
        {
          before: true,
          after: true,
        },
      ],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/space-before-blocks': ['error', 'always'],
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/quotes': [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],
      'max-len': 'off',
      '@stylistic/operator-linebreak': [
        'error',
        'before',
        {
          overrides: {
            '=': 'after',
            '===': 'before',
            '?': 'before',
            ':': 'before',
            '&&': 'before',
            '||': 'before',
          },
        },
      ],
      '@stylistic/comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'always-multiline',
          enums: 'always-multiline',
          tuples: 'always-multiline',
          generics: 'always-multiline',
        },
      ],
      '@stylistic/comma-spacing': [
        'error',
        {
          before: false,
          after: true,
        },
      ],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@typescript-eslint/prefer-optional-chain': [
        'error',
        {
          allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing: true,
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: false,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MethodDefinition[kind!=constructor][kind!=set] > FunctionExpression:not([returnType])',
          message: 'Methods must declare a return type.',
        },
        { selector: 'TSObjectKeyword', message: 'Use precise interfaces.' },
        {
          selector:
            'PropertyDefinition > :matches(ArrowFunctionExpression, FunctionExpression):not([returnType])',
          message: 'Methods must declare a return type.',
        },
        {
          selector:
            'Property[method=true][kind!=set] > FunctionExpression:not([returnType])',
          message: 'Methods must declare a return type.',
        },
      ],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never',
        },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@stylistic/object-curly-newline': [
        'error',
        {
          ImportDeclaration: {
            multiline: true,
            consistent: true,
          },
          ExportDeclaration: {
            multiline: true,
            consistent: true,
          },
        },
      ],
      '@stylistic/object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: true,
        },
      ],
    },
  },
];
