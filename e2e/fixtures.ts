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
import { LEGAL_VERSION } from '../src/lib/legal';

const THIRD_PARTY_NOISE = /challenges\.cloudflare\.com/;

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
        if (THIRD_PARTY_NOISE.test(msg.location().url)) return;
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

/** Pre-accept the legal gate (the current version) before the page loads. */
export async function acceptGate(page: Page): Promise<void> {
  await page.addInitScript((version) => {
    try {
      localStorage.setItem('sh:legal', version);
    } catch {
      /* storage blocked: the gate will show, and the test will say so */
    }
  }, LEGAL_VERSION);
}
