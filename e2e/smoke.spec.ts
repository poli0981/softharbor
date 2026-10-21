// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Every page type, both locales, both colour schemes: renders, no console
// errors, no CSP violations (fixture), and no serious/critical axe findings.

import AxeBuilder from '@axe-core/playwright';
import { acceptGate, expect, settled, test } from './fixtures';

const PAGES = [
  '/',
  '/apps',
  '/apps/7-zip',
  '/categories',
  '/categories/browser',
  '/legal/privacy',
  '/legal/terms',
  '/vi',
  '/vi/apps',
  '/vi/apps/7-zip',
  '/vi/categories/security-privacy',
  '/vi/legal/disclaimer',
  '/offline',
  '/contact',
  '/vi/contact',
];

for (const path of PAGES) {
  test(`${path} renders cleanly`, async ({ page }) => {
    await acceptGate(page);
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('h1').first()).toBeVisible();
    // The pre-paint script ran: a theme is always resolved.
    await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
    // Nothing pokes past the right edge. On a phone that is not a scrollbar
    // but a zoomed-out page (the layout viewport widens to fit), and it
    // happened twice in v1.1 — a grid sized by min-content, then decoration.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
  });
}

test.describe('404', () => {
  // Chrome logs every 404 document as a console error; that one is expected.
  test.use({ allowConsole: [/status of 404/] });

  test('an unknown URL gets the 404 page, without the gate', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1')).toContainText("That page isn't here");
    await expect(page.getByTestId('sh-legal-gate')).toHaveCount(0);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  for (const path of ['/', '/apps', '/apps/7-zip', '/vi/apps', '/legal/privacy']) {
    test(`${path} has no serious accessibility violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await acceptGate(page);
      await page.goto(path);
      await settled(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.nodes[0]?.target.join(' ')}`);
      expect(serious).toEqual([]);
    });
  }
}
