// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Shared e2e fixture: every test fails if its page logged a console error, an
// uncaught exception or a Content-Security-Policy violation.
//
// CSP violations are collected from the `securitypolicyviolation` event — the
// policy is a <meta> tag, which cannot carry report-uri/report-to, so the
// event is the only signal (errors.js records the same thing for bug reports).
//
// Messages from inside Cloudflare's Turnstile iframe are ignored: that frame
// enforces its own CSP and logs violations for probes it makes itself
// (hagen./brunhild.challenges.cloudflare.com), which no page can change.

import { expect, test as base, type Page } from '@playwright/test';
import { PASS_TTL_MS } from '../src/lib/human';
import { LEGAL_VERSION } from '../src/lib/legal';

/** Cloudflare's challenge hosts (the Turnstile frame and its probes). */
function fromTurnstileFrame(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'challenges.cloudflare.com' || host.endsWith('.challenges.cloudflare.com');
  } catch {
    return false; // no location at all — not the frame's
  }
}

declare global {
  interface Window {
    __shCsp?: string[];
  }
}

export const test = base.extend<{ issues: string[]; allowConsole: RegExp[] }>({
  /**
   * Console errors a test EXPECTS, e.g. Chrome's "status of 404" line for a
   * 404 document. Set with `test.use({ allowConsole: [/…/] })`.
   */
  allowConsole: [[], { option: true }],
  issues: [
    async ({ page, allowConsole }, use) => {
      const issues: string[] = [];
      await page.addInitScript(() => {
        window.__shCsp = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          window.__shCsp?.push(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'}`);
        });
      });
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        if (fromTurnstileFrame(msg.location().url)) return;
        if (allowConsole.some((re) => re.test(msg.text()))) return;
        issues.push(`console: ${msg.text()}`);
      });
      page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));

      await use(issues);

      const csp = await page.evaluate(() => window.__shCsp ?? []).catch(() => []);
      expect(
        [...issues, ...csp.map((c) => `csp: ${c}`)],
        'console errors / CSP violations',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Waits until an island has hydrated (Astro removes `ssr` from its
 * <astro-island>). `client:idle` islands hydrate after load, so acting on
 * them straight after `goto` races the hydration.
 */
export async function waitForIsland(page: Page, name: string): Promise<void> {
  await page.waitForFunction((n) => {
    const island = document.querySelector(`astro-island[component-url*="${n}"]`);
    return island !== null && !island.hasAttribute('ssr');
  }, name);
}

/**
 * Resolves once every finite animation on the page has finished. The pages
 * rise into place on load (global.css `sh-rise`); axe measures colour
 * contrast with the element's CURRENT opacity, so scanning mid-fade reports
 * contrast failures that no settled page has.
 */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/**
 * Pre-accept the legal gate (the current version) AND its human check, before
 * the page loads — for tests about something other than the gate.
 */
export async function acceptGate(page: Page): Promise<void> {
  await page.addInitScript(
    ([version, ttl]) => {
      try {
        localStorage.setItem('sh:legal', version);
        localStorage.setItem('sh:human', String(Date.now() + ttl));
      } catch {
        /* storage blocked: the gate will show, and the test will say so */
      }
    },
    [LEGAL_VERSION, PASS_TTL_MS - 60_000] as const,
  );
}

/** A stand-in for Cloudflare's api.js: a widget that hands over a token at once. */
const FAKE_TURNSTILE = `window.turnstile = {
  render(el, options) { setTimeout(() => options.callback('e2e-token'), 50); return 'w1'; },
  reset() {},
  remove() {},
};`;

/**
 * Stands in for Cloudflare in the gate's step 2: api.js becomes FAKE_TURNSTILE
 * (served from its real URL, so the page's CSP is still exercised), and
 * /api/verify — which `astro preview` does not run — answers `status`.
 * `'blocked'` makes api.js fail to load instead. Returns the tokens posted.
 */
export async function stubTurnstile(
  page: Page,
  status: number | 'blocked' = 200,
): Promise<string[]> {
  const tokens: string[] = [];
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) =>
    status === 'blocked'
      ? route.abort('blockedbyclient')
      : route.fulfill({ contentType: 'text/javascript', body: FAKE_TURNSTILE }),
  );
  await page.route('**/api/verify', async (route) => {
    tokens.push(String((route.request().postDataJSON() as { token?: unknown }).token));
    await route.fulfill({
      status: status === 'blocked' ? 503 : status,
      contentType: 'application/json',
      body: status === 200 ? '{"ok":true}' : '{"error":"unavailable"}',
    });
  });
  return tokens;
}
