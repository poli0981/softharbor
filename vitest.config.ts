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
    // `pnpm coverage`. Scoped to the code that ships to visitors; the build
    // scripts run as child processes in their tests (scripts/fixture.ts), which
    // V8 coverage cannot see, so they are judged by those tests' assertions.
    // Thresholds sit just under the measured numbers: a ratchet, not a goal —
    // raise them when coverage rises, never lower them to land a change.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/i18n/**/*.ts', 'src/components/islands/**/*.svelte'],
      exclude: ['**/*.test.ts'],
      reporter: ['text-summary', 'html', 'lcov'],
      thresholds: { statements: 93, branches: 78, functions: 90, lines: 93 },
    },
    projects: [
      {
        // Pure logic — src/lib/**. No DOM, so a DOM bug can never hide here.
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/{lib,i18n}/**/*.test.ts'],
        },
      },
      {
        // The build/CI scripts, run for real against throwaway project trees.
        extends: true,
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
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
