// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/10 §3 — Prettier owns style, ESLint owns correctness. No debates.

/** @type {import("prettier").Config} */
export default {
  singleQuote: true,
  semi: true,
  printWidth: 100,
  plugins: ['prettier-plugin-astro', 'prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
  overrides: [
    { files: '*.astro', options: { parser: 'astro' } },
    { files: '*.svelte', options: { parser: 'svelte' } },
  ],
};
