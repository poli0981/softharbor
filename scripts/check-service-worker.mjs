// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Build guard: the emitted service worker must match what docs/08 Part D says
 * it is.
 *
 * WHY THIS EXISTS. The SW is the single most failure-prone thing in this
 * build, and every one of its failures has been SILENT — the build reports
 * success and the behaviour is simply absent or wrong:
 *
 *   1. The SW never registered at all: `@vite-pwa/astro` emitted registerSW.js
 *      but referenced it from no page (S5).
 *   2. `navigateFallback` served the offline page to ONLINE visitors (S5).
 *   3. `globPatterns` matched nothing — they are coupled to `build.format`
 *      ('offline.html', not 'offline/**') and fonts land in `_astro/`, never
 *      `/fonts/` (M1, S5).
 *   4. Omitting `navigateFallback` did NOT disable it: vite-plugin-pwa's
 *      `defaultWorkbox` sets it to 'index.html', so the SW still registered
 *      `NavigationRoute(createHandlerBoundToURL('/'))`. Since '/' was never
 *      precached, every SW-handled navigation threw
 *      `non-precached-url :: [{"url":"/"}]` in the console (2026-07-30).
 *
 * Number 4 was the dangerous one. Had '/' been precached, that route would
 * have served the home page for EVERY navigation — failure 2 again, but
 * silently correct-looking. The exception was the only thing revealing it.
 *
 * So this asserts the shape of the output, not the shape of the config: the
 * config was "right" in all four cases.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SW = join(process.cwd(), 'dist/sw.js');
const problems = [];

if (!existsSync(SW)) {
  problems.push('dist/sw.js does not exist — the PWA integration produced no service worker');
} else {
  const sw = readFileSync(SW, 'utf8');

  // (4) No navigation fallback route. Navigations must reach the network so
  // content stays fresh; the offline page is a failure path, not a strategy.
  if (sw.includes('NavigationRoute') || sw.includes('createHandlerBoundToURL')) {
    problems.push(
      "a NavigationRoute is registered — set `workbox.navigateFallback: ''`.\n" +
        '      Omitting the key is not enough; vite-plugin-pwa defaults it to index.html.',
    );
  }

  // (2) Navigations are NetworkOnly, falling back to /offline only on failure.
  if (!sw.includes('NetworkOnly')) {
    problems.push('no NetworkOnly navigation route — navigations would not hit the network');
  }
  if (!sw.includes('/offline')) {
    problems.push('no /offline fallback — a failed navigation would show the browser error page');
  }

  // (3) The globs actually matched. An empty or near-empty precache means the
  // offline page is not there, which is invisible until you pull the cable.
  const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
  if (!urls.some((u) => u.startsWith('offline'))) {
    problems.push(
      `offline.html is not precached (${urls.length} entries) — check workbox.globPatterns\n` +
        '      against build.format; they are coupled.',
    );
  }
  if (!urls.some((u) => u.endsWith('.woff2'))) {
    problems.push('no fonts precached — the offline shell would render unstyled');
  }
}

// (1) The registration script must be referenced by a page, or the SW is dead
// code no matter how correct it is.
const home = join(process.cwd(), 'dist/index.html');
if (existsSync(home) && !readFileSync(home, 'utf8').includes('registerSW.js')) {
  problems.push(
    "registerSW.js is not referenced from dist/index.html — set injectRegister: 'script'",
  );
}

if (problems.length > 0) {
  console.error(`check-service-worker — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('\n  Every one of these fails silently at build time. See docs/08 Part D.');
  process.exitCode = 1;
} else {
  console.log('check-service-worker — OK (no navigation fallback, offline path precached)');
}
