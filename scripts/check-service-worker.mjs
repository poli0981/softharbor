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
 *   5. `@vite-pwa/astro` 2.0.0 emitted a classic SW that still held ES
 *      `import` statements of bare `@vite-pwa/workbox-swkit/*` specifiers
 *      (unresolvable under pnpm's strict layout) and an empty precache — a
 *      script the browser cannot even evaluate (tried 2026-11-04, refused).
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

  // (5) A classic service worker (what registerSW.js registers) cannot
  // evaluate ES `import` statements, and every script it pulls in with
  // importScripts() must exist. These checks, and the name checks below, read
  // the unminified output — `minify: false` in astro.config.ts keeps it so.
  if (/^\s*import\s/m.test(sw)) {
    problems.push(
      'dist/sw.js still contains ES `import` statements — a classic service worker cannot\n' +
        '      evaluate them (bare @vite-pwa/workbox-swkit specifiers: that package must be a\n' +
        '      direct dependency so the SW bundler can resolve it).',
    );
  }
  for (const m of sw.matchAll(/importScripts\(\s*(["'`])(?:\.\/)?([^"'`]+)\1\s*\)/g)) {
    if (!existsSync(join(process.cwd(), 'dist', m[2]))) {
      problems.push(`dist/sw.js loads ${m[2]} with importScripts(), but the build did not emit it`);
    }
  }

  // (4) No navigation fallback route. Navigations must reach the network so
  // content stays fresh; the offline page is a failure path, not a strategy.
  if (sw.includes('NavigationRoute') || sw.includes('createHandlerBoundToURL')) {
    problems.push(
      "a NavigationRoute is registered — set `generateSW.navigateFallback: ''`.\n" +
        '      Omitting the key is not enough; vite-plugin-pwa defaults it to index.html.',
    );
  }

  // (2) Navigations are NetworkOnly, falling back to /offline only on failure.
  if (!sw.includes('NetworkOnly')) {
    problems.push(
      'no NetworkOnly navigation route — navigations would not hit the network\n' +
        '      (a minified SW drops the names this check reads: keep `minify: false`).',
    );
  }
  if (!sw.includes('/offline')) {
    problems.push('no /offline fallback — a failed navigation would show the browser error page');
  }

  // (3) The globs actually matched. An empty or near-empty precache means the
  // offline page is not there, which is invisible until you pull the cable.
  const urls = [...sw.matchAll(/url:\s*(["'`])([^"'`]+)\1/g)].map((m) => m[2]);
  if (!urls.some((u) => u.startsWith('offline'))) {
    problems.push(
      `offline.html is not precached (${urls.length} entries) — check generateSW.globPatterns\n` +
        '      against build.format; they are coupled.',
    );
  }
  if (!urls.some((u) => u.endsWith('.woff2'))) {
    problems.push('no fonts precached — the offline shell would render in fallback fonts only');
  }

  // (5) Everything the offline page itself loads must be precached, or it
  // renders broken exactly when it is shown. Checking the fonts alone missed
  // this for months: with inlineStylesheets 'never', /offline linked CSS the
  // SW never cached, so the fallback page was unstyled.
  const offlineFile = join(process.cwd(), 'dist/offline.html');
  if (existsSync(offlineFile)) {
    const offline = readFileSync(offlineFile, 'utf8');
    const needs = [
      ...[...offline.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="\/([^"]+)"/g)].map(
        (m) => m[1],
      ),
      ...[...offline.matchAll(/<script\b[^>]*\ssrc="\/(_astro\/[^"]+)"/g)].map((m) => m[1]),
    ];
    for (const asset of needs) {
      if (!urls.includes(asset)) {
        problems.push(`/offline loads /${asset} but the SW does not precache it`);
      }
    }
  } else {
    problems.push('dist/offline.html does not exist');
  }

  // (6) An updated SW must take over without waiting for every tab to close:
  // registerSW.js never posts SKIP_WAITING (generateSW.skipWaiting).
  if (!sw.includes('skipWaiting')) {
    problems.push('the SW does not call skipWaiting() — fixes would wait for every tab to close');
  }
  // (10) …and clears precaches an older Workbox format left behind
  // (generateSW.cleanupOutdatedCaches — a default in 1.x, opt-in in 2.x).
  if (!sw.includes('cleanupOutdatedCaches')) {
    problems.push(
      'the SW does not call cleanupOutdatedCaches() — old precaches would stay on disk',
    );
  }
}

// (1) The registration script must be referenced by a page, or the SW is dead
// code no matter how correct it is. (7) Same for the manifest: emitted but
// unlinked means "not installable", silently.
const home = join(process.cwd(), 'dist/index.html');
if (!existsSync(home)) {
  problems.push('dist/index.html does not exist — run `astro build` first');
} else {
  const html = readFileSync(home, 'utf8');
  if (!html.includes('registerSW.js')) {
    problems.push(
      "registerSW.js is not referenced from dist/index.html — set injectRegister: 'script'",
    );
  }
  // (9) …and the page loads it as a CLASSIC script (`<script defer src>`), so
  // one ES `import` in it is a SyntaxError and the SW never registers. 2.x
  // emitted `import "@vite-pwa/workbox-window/esm-sw-detector"` until that
  // package became a direct dependency (2026-11-09).
  const register = join(process.cwd(), 'dist/registerSW.js');
  if (!existsSync(register)) {
    problems.push('dist/registerSW.js does not exist — nothing would register the SW');
  } else if (/^\s*(import|export)\s/m.test(readFileSync(register, 'utf8'))) {
    problems.push(
      'dist/registerSW.js contains ES import/export — the page loads it as a classic script,\n' +
        '      so it throws and the SW never registers (@vite-pwa/workbox-window must be a\n' +
        '      direct dependency).',
    );
  }
  if (!html.includes('rel="manifest"')) {
    problems.push('dist/index.html does not link the web app manifest');
  }
}

if (problems.length > 0) {
  console.error(`check-service-worker — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('\n  Every one of these fails silently at build time. See docs/08 Part D.');
  process.exitCode = 1;
} else {
  console.log(
    'check-service-worker — OK (no navigation fallback; /offline and everything it loads ' +
      'precached; skipWaiting; manifest linked)',
  );
}
