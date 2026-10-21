// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The legal gate in a real browser: top layer, the platform's Esc handling
// (closedby="none" + re-open), persistence, page-declared exemptions — and
// step 2, the Turnstile check, with Cloudflare stood in for (fixtures.ts
// stubTurnstile): only after acceptance, remembered when it passes, and never
// a dead end when it cannot run.

import type { Page } from '@playwright/test';
import { LEGAL_VERSION } from '../src/lib/legal';
import { expect, stubTurnstile, test } from './fixtures';

const HOUR = 3_600_000;

/** Milliseconds until the stored check lapses, read from the page. */
const humanFor = (page: Page) =>
  page.evaluate(() => Number(localStorage.getItem('sh:human')) - Date.now());

test('blocks a first-time visitor until accepted and checked, and remembers both', async ({
  page,
}) => {
  const tokens = await stubTurnstile(page);
  const scripts: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).hostname === 'challenges.cloudflare.com') scripts.push(r.url());
  });

  await page.goto('/apps');
  const gate = page.getByRole('dialog', { name: 'Before you continue' });
  await expect(gate).toBeVisible();

  // Esc twice — Chromium's close watcher only honours preventDefault() on
  // `cancel` after user activation; the gate must survive either way.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(gate).toBeVisible();
  // Nothing of Cloudflare's is fetched before the documents are accepted.
  expect(scripts).toEqual([]);

  await page.getByTestId('sh-legal-accept').click();
  await expect(page.getByTestId('sh-legal-gate')).toBeHidden();
  expect(tokens).toEqual(['e2e-token']);
  expect(scripts).toHaveLength(1);
  expect(await humanFor(page)).toBeGreaterThan(47 * HOUR);

  await page.reload();
  await expect(page.getByTestId('sh-legal-gate')).toHaveCount(1); // still rendered…
  await expect(page.getByTestId('sh-legal-gate')).toBeHidden(); // …but not shown again
});

test.describe('when the check cannot run', () => {
  // The browser reports the blocked script itself; that line is the scenario.
  test.use({ allowConsole: [/ERR_BLOCKED_BY_CLIENT/] });

  test('lets the person through, says so, and asks again within the hour', async ({ page }) => {
    await stubTurnstile(page, 'blocked');
    await page.goto('/vi/apps');
    await page.getByTestId('sh-legal-accept').click();
    await expect(page.getByTestId('sh-gate-status')).toHaveText(
      'Không chạy được bước kiểm tra nên đã bỏ qua. Mời bạn vào trang.',
    );
    await expect(page.getByTestId('sh-legal-gate')).toBeHidden();
    const left = await humanFor(page);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(HOUR);
  });
});

test.describe('when /api/verify is down', () => {
  test.use({ allowConsole: [/status of 503/] });

  test('fails open the same way', async ({ page }) => {
    await stubTurnstile(page, 503);
    await page.goto('/apps');
    await page.getByTestId('sh-legal-accept').click();
    await expect(page.getByTestId('sh-legal-gate')).toBeHidden();
    expect(await humanFor(page)).toBeLessThanOrEqual(HOUR);
  });
});

test('a lapsed check re-runs step 2 only', async ({ page }) => {
  const tokens = await stubTurnstile(page);
  await page.addInitScript((version) => localStorage.setItem('sh:legal', version), LEGAL_VERSION);
  await page.goto('/categories');
  const gate = page.getByTestId('sh-legal-gate');
  await expect(gate).toHaveAttribute('data-step', 'verify');
  await expect(page.getByTestId('sh-legal-accept')).toHaveCount(0);
  await expect(gate).toBeHidden();
  expect(tokens).toEqual(['e2e-token']);
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
