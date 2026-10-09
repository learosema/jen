import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

import globals from 'globals';

export default defineConfig(
  { ignores: ['docs', '**/dist'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Browser code shipped by packs (pack-glsl's <shader-canvas>, pack-web's templates).
    files: ['packages/*/web/**/*.js', 'packages/*/templates/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    // pack-js's elements.d.ts starts as an empty augmentation of HTMLElementTagNameMap.
    files: ['packages/*/templates/**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  }
);
