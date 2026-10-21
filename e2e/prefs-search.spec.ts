// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Display preferences and search, end to end.

import { acceptGate, expect, test, waitForIsland } from './fixtures';

test.beforeEach(async ({ page }) => {
  await acceptGate(page);
});

test('display choices apply at once and are restored before paint', async ({ page }) => {
  await page.goto('/');
  await waitForIsland(page, 'ShPrefs');
  await page.getByRole('button', { name: 'Display settings' }).click();
  const panel = page.getByTestId('sh-prefs');
  await expect(panel).toBeVisible();

  await panel.getByRole('radio', { name: 'Dark' }).check();
  await panel.getByRole('radio', { name: 'Hidden' }).check();
  await panel.getByRole('radio', { name: 'Reduce' }).check();

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-scrollbar', 'hidden');
  await expect(html).toHaveAttribute('data-motion', 'reduce');

  // A fresh document: theme.js must re-apply all three before any island.
  await page.goto('/apps');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-scrollbar', 'hidden');
  await expect(html).toHaveAttribute('data-motion', 'reduce');
});

test('"/" from any page goes to search', async ({ page }) => {
  await page.goto('/categories');
  await waitForIsland(page, 'ShPrefs');
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/\/apps#search$/);
  await expect(page.locator('#sh-search')).toBeFocused();
});

test('Vietnamese search ignores diacritics and lands in the URL', async ({ page }) => {
  await page.goto('/vi/apps');
  await waitForIsland(page, 'ShSearch');
  const box = page.locator('#sh-search');
  await box.fill('trinh duyet');
  await expect(page.locator('[data-slug="firefox"]')).toBeVisible();
  await expect(page.locator('[data-slug="7-zip"]')).toBeHidden();
  await expect(page).toHaveURL(/\?q=trinh\+duyet/);
  await expect(page.locator('#sh-sort')).toHaveValue('relevance');
});

test('a shared URL restores the view, and "Clear all" really clears it', async ({ page }) => {
  await page.goto('/apps?q=gimp&platform=linux');
  await waitForIsland(page, 'ShSearch');
  await waitForIsland(page, 'ShFilterSheet');
  await expect(page.locator('#sh-search')).toHaveValue('gimp');
  await expect(page.locator('[data-slug="gimp"]')).toBeVisible();
  await expect(page.locator('[data-slug="7-zip"]')).toBeHidden();

  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.keyboard.press('Escape');

  await expect(page.locator('#sh-search')).toHaveValue('');
  await expect(page.locator('[data-slug="7-zip"]')).toBeVisible();
  // Every card is back (no hard-coded total: the catalogue grows).
  await expect(page.locator('#sh-grid [data-slug][hidden]')).toHaveCount(0);
});
