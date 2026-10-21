// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The legal gate in a real browser: top layer, the platform's Esc handling
// (closedby="none" + re-open), persistence, and page-declared exemptions.

import { expect, test } from './fixtures';

test('blocks a first-time visitor until accepted, and remembers it', async ({ page }) => {
  await page.goto('/apps');
  const gate = page.getByRole('dialog', { name: 'Before you continue' });
  await expect(gate).toBeVisible();

  // Esc twice — Chromium's close watcher only honours preventDefault() on
  // `cancel` after user activation; the gate must survive either way.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(gate).toBeVisible();

  await page.getByTestId('sh-legal-accept').click();
  await expect(gate).toBeHidden();

  await page.reload();
  await expect(page.getByTestId('sh-legal-gate')).toHaveCount(1); // still rendered…
  await expect(gate).toBeHidden(); // …but not shown again
});

test('links the documents it asks you to accept, which are exempt', async ({ page }) => {
  await page.goto('/vi/apps');
  const gate = page.getByRole('dialog');
  await expect(gate).toBeVisible();
  await gate.getByRole('link', { name: 'Chính sách quyền riêng tư' }).click();
  await expect(page).toHaveURL(/\/vi\/legal\/privacy$/);
  // Legal pages never render the gate island at all.
  await expect(page.getByTestId('sh-legal-gate')).toHaveCount(0);
});

test.describe('exempt pages', () => {
  test.use({ allowConsole: [/status of 404/] });

  test('error and offline pages are exempt', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByTestId('sh-legal-gate')).toHaveCount(0);
    await page.goto('/no-such-page');
    await expect(page.getByTestId('sh-legal-gate')).toHaveCount(0);
  });
});
