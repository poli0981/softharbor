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
  { ignores: ['dist/', '.astro/', 'node_modules/'] },
  {
    // Unbundled scripts shipped verbatim from public/. They must stay plain
    // browser JS — no imports, no TypeScript — because they load before the
    // bundle and at a stable path (docs/05 §A8, §A5). Previously theme.js was
    // simply ignored; linting them is better than exempting them.
    files: ['public/*.js'],
    languageOptions: {
      globals: globals.browser,
      sourceType: 'script',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...astro.configs.recommended,
  ...svelte.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // T4 (docs/09 §2): no raw HTML injection.
    //
    // This uses eslint-plugin-astro's purpose-built rule. An earlier
    // hand-rolled `no-restricted-syntax` selector targeted JSXAttribute, which
    // astro-eslint-parser never produces for a template directive — so the ban
    // silently matched nothing and three components used set:html with a clean
    // CI. Found in M2. Do not replace this with a custom selector.
    files: ['**/*.astro'],
    rules: {
      'astro/no-set-html-directive': 'error',
    },
  },
  {
    // The ONE carve-out, scoped to exact files rather than a loose disable.
    //
    // These inline SVG from `src/lib/icon.ts`, which reads the vendored
    // @iconify-json packages. The only data-derived input is the schema-
    // constrained `logo` / `icon` string used as a lookup KEY — it is never
    // interpolated into markup, and an unknown key throws at build time.
    // The alternative is an <img> that cannot inherit currentColor, breaking
    // the monochrome theming docs/04 §2 and docs/14 §3d require.
    files: [
      'src/components/ShAppCard.astro',
      'src/components/pages/AppDetailPage.astro',
      'src/components/pages/CategoriesPage.astro',
      // ShJsonLd emits JSON.stringify() of an object it builds itself into a
      // <script type="application/ld+json">. That is a DATA block, not
      // executable script (docs/09 §4), and Astro's normal escaping would
      // corrupt the JSON — &quot; is not valid inside it. Values come from the
      // schema-validated collection, never from a request.
      'src/components/ShJsonLd.astro',
    ],
    rules: {
      'astro/no-set-html-directive': 'off',
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
    // Build/CI scripts and root config run in Node, never in a browser.
    files: ['scripts/**/*.mjs', '*.config.{ts,js,mjs}'],
    languageOptions: { globals: globals.node },
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
