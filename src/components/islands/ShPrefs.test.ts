// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// ShPrefs — the display menu. Drives the real component in happy-dom: the
// choices apply to <html> at once and persist. Popover placement, light
// dismiss and the `/` shortcut's navigation need a real browser and are
// covered by the Playwright suite.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ShPrefs from './ShPrefs.svelte';

const PROPS = {
  label: 'Display settings',
  themeLabel: 'Theme',
  themes: { system: 'System', light: 'Light', dark: 'Dark' },
  scrollbarLabel: 'Scrollbar',
  scrollbars: { auto: 'Default', thin: 'Thin', hidden: 'Hidden' },
  motionLabel: 'Motion',
  motions: { system: 'System', reduce: 'Reduce' },
  searchHref: '/apps#search',
};

function stubStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  });
  return map;
}

let target: HTMLElement;
let app: Record<string, unknown> | undefined;

const radio = (name: string, value: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!;

function choose(name: string, value: string) {
  const input = radio(name, value);
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}

beforeEach(() => {
  document.body.innerHTML = '';
  for (const a of ['data-theme', 'data-scrollbar', 'data-motion']) {
    document.documentElement.removeAttribute(a);
  }
  target = document.createElement('div');
  document.body.appendChild(target);
});

afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('ShPrefs', () => {
  it('renders an icon button that names the panel it opens', () => {
    stubStorage();
    app = mount(ShPrefs, { target, props: PROPS });
    flushSync();
    const button = document.querySelector('[data-testid="sh-prefs-button"]')!;
    expect(button.getAttribute('aria-label')).toBe('Display settings');
    expect(button.getAttribute('popovertarget')).toBe('sh-prefs');
    expect(document.getElementById('sh-prefs')?.getAttribute('popover')).toBe('auto');
  });

  it('reflects stored choices once mounted', () => {
    stubStorage({ 'sh:theme': 'dark', 'sh:scrollbar': 'thin', 'sh:motion': 'reduce' });
    app = mount(ShPrefs, { target, props: PROPS });
    flushSync();
    expect(radio('sh-theme', 'dark').checked).toBe(true);
    expect(radio('sh-scrollbar', 'thin').checked).toBe(true);
    expect(radio('sh-motion', 'reduce').checked).toBe(true);
  });

  it('applies and persists each choice immediately', () => {
    const store = stubStorage();
    app = mount(ShPrefs, { target, props: PROPS });
    flushSync();

    choose('sh-theme', 'dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(store.get('sh:theme')).toBe('dark');

    choose('sh-scrollbar', 'hidden');
    expect(document.documentElement.dataset['scrollbar']).toBe('hidden');
    expect(store.get('sh:scrollbar')).toBe('hidden');

    choose('sh-motion', 'reduce');
    expect(document.documentElement.dataset['motion']).toBe('reduce');
    expect(store.get('sh:motion')).toBe('reduce');

    choose('sh-scrollbar', 'auto');
    expect(document.documentElement.dataset['scrollbar']).toBeUndefined();
    expect(store.has('sh:scrollbar')).toBe(false);
  });
});
