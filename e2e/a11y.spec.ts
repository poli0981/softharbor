// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Accessibility beyond the page-by-page axe sweep in smoke.spec.ts
// (ACCESSIBILITY.md, docs/11 §4): axe on the OPEN dialogs, the keyboard paths
// (skip link, focus return, the "/" switch), reflow at 320 CSS px, and forced
// colours. The owner's manual keyboard + Narrator pass (2026-11-09) is the
// human half of the same checklist.

import {
  acceptGate,
  axeViolations,
  expect,
  settled,
  stubTurnstile,
  test,
  waitForIsland,
} from './fixtures';

test.describe('open dialogs pass axe', () => {
  test('the legal gate', async ({ page }) => {
    await stubTurnstile(page);
    await page.goto('/apps');
    const gate = page.getByTestId('sh-legal-gate');
    await expect(gate).toBeVisible();
    await settled(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('the filter sheet', async ({ page }) => {
    await acceptGate(page);
    await page.goto('/apps');
    await waitForIsland(page, 'ShFilterSheet');
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await settled(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('the display menu', async ({ page }) => {
    await acceptGate(page);
    await page.goto('/');
    await waitForIsland(page, 'ShPrefs');
    await page.getByRole('button', { name: 'Display settings' }).click();
    await expect(page.getByTestId('sh-prefs')).toBeVisible();
    await settled(page);
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await acceptGate(page);
  });

  test('the first Tab reaches the skip link, which jumps past the header', async ({ page }) => {
    await page.goto('/apps/7-zip');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    // The next stop is inside <main>, not the header's first link.
    expect(await page.evaluate(() => document.activeElement?.closest('main') !== null)).toBe(true);
  });

  test('closing the filter sheet with Esc returns focus to its button', async ({ page }) => {
    await page.goto('/apps');
    await waitForIsland(page, 'ShFilterSheet');
    const button = page.getByRole('button', { name: /^Filters/ });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('closing the display menu with Esc returns focus to its button', async ({ page }) => {
    await page.goto('/');
    await waitForIsland(page, 'ShPrefs');
    const button = page.getByRole('button', { name: 'Display settings' });
    await button.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByTestId('sh-prefs');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('radio', { name: 'System' }).first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('the focused choice in the display menu shows a ring of its own (2.4.7)', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForIsland(page, 'ShPrefs');
    await page.getByRole('button', { name: 'Display settings' }).click();
    await page.keyboard.press('Tab'); // the checked "System" theme radio
    const ring = await page
      .getByTestId('sh-prefs')
      .locator('input:focus-visible + span')
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { outline: s.outlineStyle, color: s.outlineColor, fill: s.backgroundColor };
      });
    expect(ring.outline).toBe('solid');
    expect(ring.color).not.toBe(ring.fill);
  });

  test('"/" can be turned off, and then does nothing (2.1.4)', async ({ page }) => {
    await page.goto('/categories');
    await waitForIsland(page, 'ShPrefs');
    await page.getByRole('button', { name: 'Display settings' }).click();
    await page.getByTestId('sh-prefs').getByRole('radio', { name: 'Off' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-keys', 'off');
    await page.keyboard.press('Escape');

    await page.keyboard.press('/');
    await expect(page).toHaveURL(/\/categories$/);

    // Restored before paint on the next page: no hint, no shortcut.
    await page.goto('/apps');
    await waitForIsland(page, 'ShSearch');
    await expect(page.locator('html')).toHaveAttribute('data-keys', 'off');
    await expect(page.locator('#sh-search')).toHaveAttribute('placeholder', 'Search apps…');
    await page.keyboard.press('/');
    await expect(page.locator('#sh-search')).not.toBeFocused();
  });
});

test.describe('reflow at 320 CSS px (1.4.10)', () => {
  // The phone project already runs at 412 px; this is the WCAG width.
  test.skip(({ isMobile }) => isMobile, 'desktop project only');
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of [
    '/',
    '/apps',
    '/apps/7-zip',
    '/categories',
    '/contact',
    '/legal/privacy',
    '/legal/third-party',
    '/legal/accessibility',
    '/vi',
    '/vi/apps',
    '/vi/apps/7-zip',
    '/vi/legal/accessibility',
    '/offline',
  ]) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await acceptGate(page);
      await page.goto(path);
      await settled(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
    });
  }
});

test.describe('forced colours (Windows contrast themes)', () => {
  test.beforeEach(async ({ page }) => {
    await acceptGate(page);
    await page.emulateMedia({ forcedColors: 'active' });
  });

  test('the current section is still marked without its accent rule', async ({ page }) => {
    await page.goto('/apps');
    const current = page.locator('header nav a[aria-current="page"]');
    await expect(current).toHaveCSS('text-decoration-line', 'underline');
  });

  test('the chosen display options and language keep a visible fill', async ({ page }) => {
    await page.goto('/');
    await waitForIsland(page, 'ShPrefs');
    await page.getByRole('button', { name: 'Display settings' }).click();
    const fills = await page.evaluate(() => {
      const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : null);
      return {
        checked: bg(document.querySelector('#sh-prefs input:checked + span')),
        unchecked: bg(document.querySelector('#sh-prefs input:not(:checked) + span')),
        lang: bg(document.querySelector('[data-testid="sh-lang-switch"] [aria-current="true"]')),
        other: bg(document.querySelector('[data-testid="sh-lang-switch"] a')),
      };
    });
    expect(fills.checked).not.toBe(fills.unchecked);
    expect(fills.lang).not.toBe(fills.other);
  });
});
