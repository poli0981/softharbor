// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/11 — end-to-end smoke suite against the BUILT site (`astro preview`
// serves dist/ exactly as built, including the per-page meta CSP).
//
// What it exists to catch is the class of bug this project kept shipping with
// every unit test green: a script or style the CSP silently refused, a dialog
// the platform could dismiss, an island that threw on hydration. The shared
// fixture (e2e/fixtures.ts) fails any test whose page logged a console error
// or a CSP violation.
//
// `astro preview` applies neither _headers nor the Worker, so a second server
// does: `wrangler dev` on the same dist/ with the real wrangler.jsonc, for the
// `worker` project alone (e2e/worker.spec.ts — routing, the rate limits, the
// 429 page). Cloudflare's own edge is still verified on the Workers Builds
// preview URL.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
// Not wrangler's default 8787/8788: another project's `wrangler dev` may hold
// those, and reuseExistingServer would then test the wrong site.
const WORKER_PORT = 8799;
const WORKER_SPEC = /worker\.spec\.ts$/;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: WORKER_SPEC },
    // Bottom sheets, the wrapped header and touch targets live here.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: WORKER_SPEC },
    {
      name: 'worker',
      testMatch: WORKER_SPEC,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${WORKER_PORT}` },
    },
  ],
  webServer: [
    {
      command: `pnpm exec astro preview --port ${PORT} --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      // Astro ≥ 7.2 backgrounds `astro preview` when it detects an AI agent or
      // CI; Playwright needs it in the foreground to own its lifetime.
      env: { ASTRO_PREVIEW_BACKGROUND: '0' },
    },
    {
      command: `pnpm exec wrangler dev --port ${WORKER_PORT} --ip 127.0.0.1 --show-interactive-dev-session=false`,
      // An asset-first path (a negative pattern), so the readiness probes
      // spend nothing from the rate limit the tests measure.
      url: `http://127.0.0.1:${WORKER_PORT}/favicon.svg`,
      reuseExistingServer: !process.env['CI'],
      timeout: 90_000,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
  ],
});
