// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Display preferences: the typed helpers, and their parity with the pre-paint
// script that has to re-implement them (src/scripts/theme.js cannot import
// from src/lib — it ships verbatim). The parity block evaluates the REAL
// script against the same stored values, so the two cannot drift silently.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyMotion,
  applyScrollbar,
  readMotion,
  readScrollbar,
  writeMotion,
  writeScrollbar,
  type MotionChoice,
  type ScrollbarChoice,
} from './prefs';
import { readChoice, resolve } from './theme';

const THEME_JS = readFileSync(join(process.cwd(), 'src/scripts/theme.js'), 'utf8');

function stubStorage(seed: Record<string, string> = {}, mode: 'ok' | 'throws' = 'ok') {
  const map = new Map(Object.entries(seed));
  const guard = () => {
    if (mode === 'throws') throw new DOMException('denied', 'SecurityError');
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (guard(), map.get(k) ?? null),
      setItem: (k: string, v: string) => (guard(), void map.set(k, v)),
      removeItem: (k: string) => (guard(), void map.delete(k)),
    },
  });
  return map;
}

const root = () => document.documentElement;

beforeEach(() => {
  for (const a of ['data-theme', 'data-scrollbar', 'data-motion']) root().removeAttribute(a);
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('scrollbar preference', () => {
  it('defaults to auto and stores the default as no key', () => {
    const store = stubStorage();
    expect(readScrollbar()).toBe('auto');
    writeScrollbar('hidden');
    expect(store.get('sh:scrollbar')).toBe('hidden');
    writeScrollbar('auto');
    expect(store.has('sh:scrollbar')).toBe(false);
  });

  it('treats garbage as the default', () => {
    stubStorage({ 'sh:scrollbar': 'invisible' });
    expect(readScrollbar()).toBe('auto');
  });

  it('applies as a data attribute, removed for the default', () => {
    applyScrollbar('thin', root());
    expect(root().dataset['scrollbar']).toBe('thin');
    applyScrollbar('auto', root());
    expect(root().dataset['scrollbar']).toBeUndefined();
  });
});

describe('motion preference', () => {
  it('round-trips reduce and stores system as no key', () => {
    const store = stubStorage();
    expect(readMotion()).toBe('system');
    writeMotion('reduce');
    expect(readMotion()).toBe('reduce');
    writeMotion('system');
    expect(store.has('sh:motion')).toBe(false);
  });

  it('applies only the reduce choice to <html>', () => {
    applyMotion('reduce', root());
    expect(root().dataset['motion']).toBe('reduce');
    applyMotion('system', root());
    expect(root().dataset['motion']).toBeUndefined();
  });
});

describe('hostile storage', () => {
  it('never throws, and falls back to defaults', () => {
    stubStorage({}, 'throws');
    expect(readScrollbar()).toBe('auto');
    expect(readMotion()).toBe('system');
    expect(() => writeScrollbar('hidden')).not.toThrow();
    expect(() => writeMotion('reduce')).not.toThrow();
  });
});

describe('pre-paint script parity (src/scripts/theme.js)', () => {
  const cases: Array<Record<string, string>> = [
    {},
    { 'sh:theme': 'dark', 'sh:scrollbar': 'hidden', 'sh:motion': 'reduce' },
    { 'sh:theme': 'light', 'sh:scrollbar': 'thin' },
    { 'sh:theme': 'purple', 'sh:scrollbar': 'invisible', 'sh:motion': 'yes' },
  ];

  it.each(cases)('agrees with the typed helpers for %o', (seed) => {
    stubStorage(seed);
    new Function(THEME_JS)();

    const expectedScrollbar: ScrollbarChoice = readScrollbar();
    const expectedMotion: MotionChoice = readMotion();
    expect(root().dataset['theme']).toBe(resolve(readChoice()));
    expect(root().dataset['scrollbar']).toBe(
      expectedScrollbar === 'auto' ? undefined : expectedScrollbar,
    );
    expect(root().dataset['motion']).toBe(expectedMotion === 'reduce' ? 'reduce' : undefined);
  });

  it('survives storage that throws, applying a theme anyway', () => {
    stubStorage({}, 'throws');
    expect(() => new Function(THEME_JS)()).not.toThrow();
    expect(['light', 'dark']).toContain(root().dataset['theme']);
  });
});
