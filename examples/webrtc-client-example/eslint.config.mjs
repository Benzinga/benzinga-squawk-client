import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default defineConfig([
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'dist/*',
    'examples/*',
    'resources/*',
    'scripts/*',
    'src/__tests__/*',
    '**/*.js',
    '**/*.test.tsx',
  ]),
  {
    extends: compat.extends('eslint:recommended', 'plugin:prettier/recommended'),

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 6,
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          modules: true,
        },
      },
    },

    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'off',

      'max-len': [
        'error',
        {
          code: 120,
          ignoreUrls: true,
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],

    extends: compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
    ),

    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    rules: {
      '@typescript-eslint/ban-ts-comment': ['off'],
      '@typescript-eslint/no-inferrable-types': ['off'],
      '@typescript-eslint/no-explicit-any': ['off'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
])
