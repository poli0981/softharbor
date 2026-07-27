// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/10 §3. ESLint covers correctness only — Prettier owns style.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', '.astro/', 'node_modules/', 'public/theme.js'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...astro.configs.recommended,
  ...svelte.configs.recommended,
  {
    rules: {
      // T4: no raw HTML injection anywhere (docs/09 §2).
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='set:html'], Property[key.name='set:html']",
          message: 'set:html is banned — XSS surface (docs/09 T4).',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Type-aware rules run on .ts only. The svelte/astro parsers do not
    // forward parserOptions.project to @typescript-eslint reliably, and
    // `astro check` (which DOES type-check those files) already covers them.
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Everything under src/ ships to (or is compiled for) the browser.
    files: ['src/**/*.{ts,svelte,astro}'],
    languageOptions: { globals: globals.browser },
  },
  {
    // <script lang="ts"> inside .svelte needs the TS parser forwarded, or
    // `interface` is a parse error.
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tseslint.parser },
      globals: globals.browser,
    },
  },
  {
    // docs/10 §1: "no non-null `!` outside tests" — tests are the exception.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // Storage access goes through typed helpers in src/lib (docs/10 §3).
    files: ['src/**/*.{ts,svelte,astro}'],
    ignores: ['src/lib/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use the typed helpers in src/lib (docs/10 §3).' },
      ],
    },
  },
);
