// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// ShLangSwitch — EN | VI with the current language marked, links that keep
// the visitor's query and fragment, and the one-time suggestion banner
// (docs/07 §2): VI browser AND an English page AND no stored answer. There is
// never an automatic redirect.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ShLangSwitch from './ShLangSwitch.svelte';

const PAIR = { en: '/apps', vi: '/vi/apps' };
const BANNER = {
  suggestText: 'Xem SoftHarbor bằng tiếng Việt?',
  suggestAccept: 'Chuyển sang tiếng Việt',
  suggestDismiss: 'Không, cảm ơn',
};

let app: Record<string, unknown> | undefined;
/** The page's storage, as a Map — `sh:lang` is the only key this island touches. */
let store: Map<string, string>;

function stubStorage(): Map<string, string> {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    },
  });
  return map;
}

function start(locale: 'en' | 'vi', url = PAIR[locale]): void {
  history.replaceState(null, '', url);
  const target = document.createElement('div');
  document.body.appendChild(target);
  app = mount(ShLangSwitch, {
    target,
    props: { locale, pair: PAIR, label: 'Language', ...BANNER },
  });
  flushSync();
}

function browserLanguage(lang: string): void {
  Object.defineProperty(navigator, 'language', { configurable: true, get: () => lang });
}

const banner = () => document.querySelector('[data-testid="sh-lang-suggest"]');

beforeEach(() => {
  document.body.innerHTML = '';
  store = stubStorage();
  browserLanguage('en-GB');
});

afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  Reflect.deleteProperty(navigator, 'language');
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('ShLangSwitch', () => {
  it('marks English current on an English page and links its Vietnamese pair', () => {
    start('en');
    const current = document.querySelector('[aria-current="true"]')!;
    expect(current.getAttribute('lang')).toBe('en');
    const link = document.querySelector<HTMLAnchorElement>('[data-testid="sh-lang-vi"]')!;
    expect(link.getAttribute('href')).toBe('/vi/apps');
    expect(link.getAttribute('hreflang')).toBe('vi');
    // The visible code stays in the accessible name; the endonym follows it.
    expect(link.textContent).toBe('VI — Tiếng Việt');
  });

  it('marks Vietnamese current on a Vietnamese page', () => {
    start('vi');
    expect(document.querySelector('[aria-current="true"]')?.getAttribute('lang')).toBe('vi');
    expect(document.querySelector('[data-testid="sh-lang-en"]')?.getAttribute('href')).toBe(
      '/apps',
    );
  });

  it('carries the query and fragment across, so a filtered view survives', () => {
    start('en', '/apps?q=gimp&platform=linux#search');
    expect(document.querySelector('[data-testid="sh-lang-vi"]')?.getAttribute('href')).toBe(
      '/vi/apps?q=gimp&platform=linux#search',
    );
  });

  it('suggests Vietnamese once to a Vietnamese browser on an English page', () => {
    browserLanguage('vi-VN');
    start('en');
    expect(banner()?.getAttribute('lang')).toBe('vi');

    [...banner()!.querySelectorAll('button')][0]!.click();
    flushSync();
    expect(banner()).toBeNull();
    // Dismissing is an answer too: it is never asked again.
    expect(store.get('sh:lang')).toBe('en');
  });

  it('remembers acceptance', () => {
    browserLanguage('vi');
    start('en');
    banner()!
      .querySelector('a')!
      .addEventListener('click', (e) => e.preventDefault());
    banner()!.querySelector('a')!.click();
    expect(store.get('sh:lang')).toBe('vi');
  });

  it('never suggests on a Vietnamese page, to other languages, or after an answer', () => {
    browserLanguage('vi-VN');
    start('vi');
    expect(banner()).toBeNull();

    document.body.innerHTML = '';
    store.set('sh:lang', 'en');
    start('en');
    expect(banner()).toBeNull();

    document.body.innerHTML = '';
    store.clear();
    browserLanguage('fr-FR');
    start('en');
    expect(banner()).toBeNull();
  });
});
