// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// ShFilterSheet — facets in a native <dialog>. Checkboxes and the stores stay
// in step in BOTH directions, and the submit button's text (its accessible
// name) is pluralised and number-formatted in the page language.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { categories, clearAll, pricing, query, visibleCount } from '../../lib/stores';
import ShFilterSheet from './ShFilterSheet.svelte';

const PROPS = {
  openLabel: 'Filters',
  clearLabel: 'Clear all',
  showLabel: 'Show {n} apps',
  showLabelOne: 'Show {n} app',
  headings: { categories: 'Category', platforms: 'Platform', pricing: 'Pricing' },
  options: {
    categories: [
      { value: 'browser', label: 'Browsers' },
      { value: 'office', label: 'Office' },
    ],
    platforms: [{ value: 'linux', label: 'Linux' }],
    pricing: [{ value: 'free', label: 'Free' }],
  },
};

let app: Record<string, unknown> | undefined;

function start(lang = 'en'): void {
  document.documentElement.lang = lang;
  const target = document.createElement('div');
  document.body.appendChild(target);
  app = mount(ShFilterSheet, { target, props: PROPS });
  flushSync();
}

const box = (label: string) =>
  [...document.querySelectorAll('label')]
    .find((l) => l.textContent?.trim() === label)
    ?.querySelector('input') as HTMLInputElement;
const button = (text: RegExp) =>
  [...document.querySelectorAll('button')].find((b) => text.test(b.textContent ?? ''))!;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  clearAll();
  visibleCount.set(0);
});

describe('ShFilterSheet', () => {
  it('opens as a modal dialog named by its heading', () => {
    start();
    button(/^\s*Filters/).click();
    const dialog = document.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!);
    expect(title?.textContent?.trim()).toBe('Filters');
  });

  it('toggles facets and counts them on the opening button', () => {
    start();
    box('Browsers').click();
    box('Free').click();
    flushSync();
    expect(categories.get()).toEqual(new Set(['browser']));
    expect(pricing.get()).toEqual(new Set(['free']));
    expect(button(/^\s*Filters/).textContent).toContain('2');
  });

  it('"Clear all" is only enabled with something to clear, and clears it everywhere', () => {
    start();
    const clear = button(/Clear all/);
    expect(clear.disabled).toBe(true);

    box('Office').click();
    query.set('gimp');
    flushSync();
    expect(clear.disabled).toBe(false);

    clear.click();
    flushSync();
    expect(categories.get().size).toBe(0);
    expect(query.get()).toBe('');
    expect(box('Office').checked).toBe(false);
  });

  it('follows the stores when they change from outside', () => {
    start();
    categories.set(new Set(['office']));
    flushSync();
    expect(box('Office').checked).toBe(true);
    expect(box('Browsers').checked).toBe(false);
  });

  it('pluralises and formats the count in the page language', () => {
    start('en');
    visibleCount.set(1);
    flushSync();
    expect(button(/^\s*Show/).textContent?.trim()).toBe('Show 1 app');
    visibleCount.set(1234);
    flushSync();
    expect(button(/^\s*Show/).textContent?.trim()).toBe('Show 1,234 apps');
  });

  it('uses the single Vietnamese plural form and Vietnamese digit grouping', () => {
    start('vi');
    visibleCount.set(1);
    flushSync();
    expect(button(/^\s*Show/).textContent?.trim()).toBe('Show 1 apps');
    visibleCount.set(1234);
    flushSync();
    expect(button(/^\s*Show/).textContent?.trim()).toBe('Show 1.234 apps');
  });
});
