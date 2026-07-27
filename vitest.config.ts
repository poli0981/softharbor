/// <reference types="vitest/config" />
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// getViteConfig gives the tests the same resolution/plugins as the real build
// (Svelte compilation, aliases), so a component test exercises the component
// as it actually ships.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    projects: [
      {
        // Pure logic — src/lib/**. No DOM, so a DOM bug can never hide here.
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/lib/**/*.test.ts'],
        },
      },
      {
        // Island behavior. docs/11 §1 keeps Playwright out of v1; these run in
        // happy-dom instead, which is enough for focus/keyboard/lifecycle
        // assertions. Anything needing real layout or the top layer stays a
        // manual launch-checklist item (docs/13 §2).
        extends: true,
        // Without the browser condition, Svelte 5 resolves to its SSR build
        // and mount() throws lifecycle_function_unavailable.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'islands',
          environment: 'happy-dom',
          include: ['src/components/**/*.test.ts'],
        },
      },
    ],
  },
});
