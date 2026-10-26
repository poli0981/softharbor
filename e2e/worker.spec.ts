// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The Worker end to end (D32): `wrangler dev` serves dist/ with the real
// wrangler.jsonc — run_worker_first and its negative patterns, both rate
// limiters (simulated by Miniflare), public/_headers — so a flood can be
// thrown at it and the 429s inspected.
//
// Miniflare counts in fixed windows aligned to the wall clock, and a refused
// request does not count. So each test that needs a clean slate or a
// refusal first waits for the next window, which also makes a retried or
// re-used server start from zero.

import type { APIRequestContext } from '@playwright/test';
import { unstable_readConfig } from 'wrangler';
import { expect, test } from './fixtures';

test.describe.configure({ mode: 'serial' });

/** What this spec reads of wrangler.jsonc (wrangler's own Config type does not resolve here). */
interface WranglerConfig {
  ratelimits: { name: string; simple: { limit: number; period: number } }[];
}

const site = (
  unstable_readConfig({ config: 'wrangler.jsonc' }, { hideWarnings: true }) as WranglerConfig
).ratelimits.find((r) => r.name === 'SITE_LIMITER');
const LIMIT = site?.simple.limit ?? 0;
const PERIOD_MS = (site?.simple.period ?? 10) * 1000;

/** Resolves just after the next window starts: every count is back to zero. */
async function nextWindow(): Promise<void> {
  const wait = PERIOD_MS - (Date.now() % PERIOD_MS) + 150;
  await new Promise((resolve) => setTimeout(resolve, wait));
}

/** Spends this window's whole budget on `/`; returns every status, in order. */
async function flood(request: APIRequestContext, extra = 20): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < LIMIT + extra; i++) statuses.push((await request.get('/')).status());
  return statuses;
}

test('pages pass through the Worker with the asset server’s own handling and headers', async ({
  request,
}) => {
  expect(LIMIT).toBeGreaterThan(0);
  await nextWindow();
  const res = await request.get('/apps');
  expect(res.status()).toBe(200);
  // public/_headers still applies to what ASSETS.fetch() returns.
  expect(res.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
  expect(res.headers()['x-frame-options']).toBe('DENY');
  // not_found_handling and html_handling, unchanged.
  expect((await request.get('/apps/no-such-app')).status()).toBe(404);
  const slashed = await request.get('/apps/', { maxRedirects: 0 });
  expect(slashed.status()).toBe(307);
  expect(slashed.headers()['location']).toMatch(/\/apps$/);
});

test('a flood gets exactly the configured budget, then the site’s own 429 page', async ({
  request,
}) => {
  await nextWindow();
  const statuses = await flood(request);
  expect(statuses.filter((s) => s === 200)).toHaveLength(LIMIT);
  // Once refused, refused for the rest of the window.
  expect(statuses.slice(LIMIT).every((s) => s === 429)).toBe(true);

  const refused = await request.get('/apps/7-zip');
  expect(refused.status()).toBe(429);
  const h = refused.headers();
  expect(h['retry-after']).toBe(String(PERIOD_MS / 1000));
  expect(h['cache-control']).toBe('no-store');
  expect(h['content-type']).toContain('text/html');
  expect(h['x-frame-options']).toBe('DENY');
  expect(await refused.text()).toContain('<title>Too many requests — SoftHarbor</title>');
});

test('while refused: /api/* answers JSON, and a page’s own files still load', async ({
  request,
}) => {
  await nextWindow();
  const home = await (await request.get('/')).text();
  await flood(request);

  const data = await request.get('/api/apps.json');
  expect(data.status()).toBe(429);
  expect(await data.json()).toEqual({ error: 'rate_limited' });
  expect(data.headers()['access-control-allow-origin']).toBe('*');

  const verify = await request.post('/api/verify', { data: { token: 'x' } });
  expect(verify.status()).toBe(429);
  expect(await verify.json()).toEqual({ error: 'rate_limited' });

  // Never limited: everything a page loads after it passed.
  const css = /\/_astro\/[\w.-]+\.css/.exec(home)?.[0] ?? '/_astro/ (no stylesheet linked)';
  for (const path of [css, '/sw.js', '/registerSW.js', '/favicon.svg', '/manifest.webmanifest']) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});

test.describe('the 429 page in a browser', () => {
  // Chrome logs the document's own status; that line is expected here.
  test.use({ allowConsole: [/status of 429/] });

  test('renders whole — styled, no CSP violation, no gate', async ({ page, request }) => {
    await nextWindow();
    await flood(request);
    const res = await page.goto('/apps');
    expect(res?.status()).toBe(429);
    await expect(page.locator('h1')).toHaveText('Too many requests');
    await expect(page.locator('[lang="vi"] h2')).toHaveText('Quá nhiều yêu cầu');
    const styled = await page.evaluate(() =>
      [...document.styleSheets].every((s) => {
        try {
          return s.cssRules.length > 0;
        } catch {
          return false;
        }
      }),
    );
    expect(styled).toBe(true);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test('lets everyone back in when the window passes', async ({ request }) => {
  await nextWindow();
  await flood(request);
  expect((await request.get('/apps')).status()).toBe(429);
  await nextWindow();
  expect((await request.get('/apps')).status()).toBe(200);
});
