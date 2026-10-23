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
    // `pnpm coverage`, also read by SonarQube Cloud (sonar-project.properties).
    // Every analysed source is measured: the code that ships to visitors, the
    // Worker, and the build scripts. Those run as child processes in their
    // tests (scripts/fixture.ts); `autoAttachSubprocess` hands each child
    // NODE_V8_COVERAGE, so their real runs count. Do not also import a script
    // in-process: Vitest merges the two kinds of coverage for one file wrongly.
    // Thresholds sit just under the measured numbers: a ratchet, not a goal —
    // raise them when coverage rises, never lower them to land a change.
    coverage: {
      provider: 'v8',
      autoAttachSubprocess: true,
      include: [
        'src/lib/**/*.ts',
        'src/i18n/**/*.ts',
        'src/scripts/**/*.js',
        'src/pages/**/*.ts',
        'src/content.config.ts',
        'src/components/islands/**/*.svelte',
        'worker/**/*.ts',
        'scripts/**/*.mjs',
      ],
      exclude: ['**/*.test.ts'],
      reporter: ['text-summary', 'html', 'lcov'],
      thresholds: { statements: 96, branches: 85, functions: 95, lines: 97 },
    },
    projects: [
      {
        // Pure logic — src/lib/** — plus the schema, the endpoints and the
        // head scripts. No DOM by default, so a DOM bug can never hide here;
        // a file that needs one says so with `@vitest-environment happy-dom`.
        // Endpoint tests sit in src/pages/ behind a leading `_`, which keeps
        // them out of Astro's routing.
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/{lib,i18n,styles,scripts}/**/*.test.ts',
            'src/pages/**/_*.test.ts',
            'src/*.test.ts',
          ],
        },
      },
      {
        // The /api/verify Worker (worker/), against a stubbed Siteverify. Node
        // has every Web API it uses (Request, FormData, streams, crypto).
        extends: true,
        test: {
          name: 'worker',
          environment: 'node',
          include: ['worker/**/*.test.ts'],
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
        // Island behavior in happy-dom: enough for focus, keyboard and
        // lifecycle assertions. Real layout, the top layer, CSP and axe are
        // the Playwright suite's job (e2e/, docs/11 §5).
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
